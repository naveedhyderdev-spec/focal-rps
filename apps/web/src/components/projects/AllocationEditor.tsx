import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  generateWeeks, startOfWeek, percentToFactor, factorToHours, factorToPercent,
  ALLOCATABLE_EXCLUDED_STATUSES,
  type Project, type ProjectStage, type Resource, type Allocation,
} from '@engine';
import { Modal } from '../ui/Modal';
import { Field, Select } from '../ui/Field';
import { resourcesH, useSettings, enforce } from '../../hooks/useData';
import { provider } from '../../data';
import { qk } from '../../lib/queryClient';
import { useAppStore } from '../../store/appStore';
import { fmtHours } from '../../lib/format';

const schema = z.object({
  resourceId: z.string().min(1, 'Pick a resource'),
  percent: z.number().min(0, 'Percent cannot be negative').max(500, 'That seems too high — max 500%'),
  start: z.string().min(1, 'Start date required'),
  end: z.string().min(1, 'End date required'),
}).refine((d) => d.end >= d.start, { message: 'End date must be on or after start date', path: ['end'] });

export function AllocationEditor({
  open, project, stages, fixedResource, existing, onClose,
}: {
  open: boolean;
  project: Project;
  stages: ProjectStage[];
  /** When editing an existing assignment the resource is fixed. */
  fixedResource: Resource | null;
  /** Existing allocations for (fixedResource, project) to prefill from. */
  existing: Allocation[];
  onClose: () => void;
}) {
  const { data: resources } = resourcesH.useList();
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const toast = useAppStore((s) => s.toast);

  const [resourceId, setResourceId] = useState('');
  const [stageId, setStageId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [percent, setPercent] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const capacity = settings?.weekly_capacity_hours ?? 42.5;
  const weekStart = settings?.week_start_day ?? 6;

  const allocatable = useMemo(
    () => (resources ?? []).filter((r) => !ALLOCATABLE_EXCLUDED_STATUSES.includes(r.status)),
    [resources],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (fixedResource) {
      setResourceId(fixedResource.id);
      const sorted = [...existing].sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
      if (sorted.length) {
        setStart(sorted[0].week_start_date);
        setEnd(sorted[sorted.length - 1].week_start_date);
        const max = Math.max(...sorted.map((a) => a.allocation_factor));
        setPercent(Math.round(factorToPercent(max)));
        setStageId(sorted[0].stage_id ?? '');
      }
    } else {
      setResourceId('');
      setStageId('');
      // default to first stage span if available
      const s = [...stages].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
      setStart(s?.start_date ?? '');
      setEnd(s?.end_date ?? '');
      setPercent(50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedResource, existing, stages]);

  const onPickStage = (id: string) => {
    setStageId(id);
    const s = stages.find((x) => x.id === id);
    if (s) { setStart(s.start_date); setEnd(s.end_date); }
  };

  const factor = percentToFactor(percent);
  const resource = (resources ?? []).find((r) => r.id === resourceId);
  const cap = resource?.weekly_capacity_hours ?? capacity;
  const weeklyHours = factorToHours(factor, cap);
  const weeks = useMemo(
    () => (start && end && end >= start ? generateWeeks(startOfWeek(start, weekStart), end, weekStart) : []),
    [start, end, weekStart],
  );

  // Soft warning: allocation outside all stage ranges
  const outsideStages = useMemo(() => {
    if (stages.length === 0 || weeks.length === 0) return false;
    return weeks.some((w) => !stages.some((s) => w >= s.start_date && w <= s.end_date));
  }, [weeks, stages]);

  const save = async () => {
    const parsed = schema.safeParse({ resourceId, percent, start, end });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (weeks.length === 0) { setError('Date range covers no weeks'); return; }
    setBusy(true);
    try {
      enforce('edit_allocations');
      await provider.allocations.removeForAssignment(resourceId, project.id);
      await provider.allocations.bulkUpsert(
        weeks.map((w) => ({
          resource_id: resourceId,
          project_id: project.id,
          stage_id: stageId || null,
          week_start_date: w,
          allocation_factor: factor,
          created_by: useAppStore.getState().currentUserId,
        })),
      );
      await provider.activity.log({
        user_id: useAppStore.getState().currentUserId,
        action: fixedResource ? 'update' : 'create',
        entity: 'allocation', entity_id: project.id,
        details: { resource: resourceId, weeks: weeks.length, percent },
      });
      await qc.invalidateQueries({ queryKey: qk.allocations });
      await qc.invalidateQueries({ queryKey: qk.activity });
      toast(`${fixedResource ? 'Updated' : 'Added'} allocation across ${weeks.length} week(s)`, 'success');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fixedResource ? `Edit allocation — ${fixedResource.forename}` : 'Add resource to project'}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}><i className="ti ti-check" /> Save allocation</button>
        </>
      }
    >
      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}><i className="ti ti-alert-circle" />{error}</div>}

      <Field label="Resource" required>
        {fixedResource ? (
          <input className="form-control" value={fixedResource.full_name || fixedResource.forename} disabled />
        ) : (
          <Select value={resourceId} onChange={setResourceId} placeholder="— Select resource —"
            options={allocatable.map((r) => ({ value: r.id, label: r.full_name || r.forename }))} />
        )}
      </Field>

      <Field label="Stage (optional)" hint="Selecting a stage fills the date range below">
        <Select value={stageId} onChange={onPickStage} placeholder="— Custom range —"
          options={[...stages].sort((a, b) => a.start_date.localeCompare(b.start_date)).map((s) => ({ value: s.id, label: `${s.stage_name} (${s.start_date} → ${s.end_date})` }))} />
      </Field>

      <div className="form-row">
        <Field label="Start date" required><input type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="End date" required><input type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>

      <div className="form-row">
        <Field label="Allocation %" hint="1.0 factor = 100% = 42.5h">
          <input type="number" step="5" min="0" className="form-control" value={percent}
            onChange={(e) => setPercent(e.target.value === '' ? 0 : Number(e.target.value))} />
        </Field>
        <Field label="Weekly hours (auto)">
          <input className="form-control" value={fmtHours(weeklyHours)} disabled />
        </Field>
      </div>

      <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>
        <i className="ti ti-calendar-week" /> Spans <strong>{weeks.length}</strong> week(s) · factor <strong>{factor.toFixed(2)}</strong>
        {percent > 100 && <span className="util-over"> · over-allocates this resource if combined with other work</span>}
      </div>
      {outsideStages && (
        <div className="alert alert-warning" style={{ marginTop: 12 }}>
          <i className="ti ti-alert-triangle" /> Some weeks fall outside the project's defined stage dates.
        </div>
      )}
    </Modal>
  );
}
