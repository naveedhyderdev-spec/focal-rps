import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  generateWeeks, startOfWeek, percentToFactor, factorToHours,
  type Resource, type Project,
} from '@engine';
import { Modal } from '../ui/Modal';
import { Field, Select } from '../ui/Field';
import { useSettings, enforce } from '../../hooks/useData';
import { provider } from '../../data';
import { qk } from '../../lib/queryClient';
import { useAppStore } from '../../store/appStore';
import { fmtHours } from '../../lib/format';

export interface BoardDialogState {
  resource: Resource;
  lockedProjectId: string | null; // set when editing an existing bar
  start: string;
  end: string;
  percent: number;
}

export function BoardAllocationDialog({
  state, projects, onClose,
}: {
  state: BoardDialogState | null;
  projects: Project[];
  onClose: () => void;
}) {
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const toast = useAppStore((s) => s.toast);
  const weekStart = settings?.week_start_day ?? 6;

  const [projectId, setProjectId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [percent, setPercent] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) return;
    setProjectId(state.lockedProjectId ?? '');
    setStart(state.start);
    setEnd(state.end);
    setPercent(state.percent);
    setError(null);
  }, [state]);

  const factor = percentToFactor(percent);
  const cap = state?.resource.weekly_capacity_hours ?? settings?.weekly_capacity_hours ?? 42.5;
  const weeks = useMemo(
    () => (start && end && end >= start ? generateWeeks(startOfWeek(start, weekStart), end, weekStart) : []),
    [start, end, weekStart],
  );

  if (!state) return null;
  const isEdit = !!state.lockedProjectId;

  const write = async () => {
    if (!projectId) { setError('Pick a project'); return; }
    if (weeks.length === 0) { setError('Date range covers no weeks'); return; }
    if (percent < 0) { setError('Percent cannot be negative'); return; }
    setBusy(true);
    try {
      enforce('edit_allocations');
      await provider.allocations.removeForAssignment(state.resource.id, projectId);
      await provider.allocations.bulkUpsert(weeks.map((w) => ({
        resource_id: state.resource.id, project_id: projectId, stage_id: null,
        week_start_date: w, allocation_factor: factor, created_by: useAppStore.getState().currentUserId,
      })));
      await provider.activity.log({ user_id: useAppStore.getState().currentUserId, action: isEdit ? 'update' : 'create', entity: 'allocation', entity_id: projectId, details: { resource: state.resource.id, weeks: weeks.length, percent } });
      await qc.invalidateQueries({ queryKey: qk.allocations });
      await qc.invalidateQueries({ queryKey: qk.activity });
      toast(`${isEdit ? 'Updated' : 'Created'} allocation · ${weeks.length} week(s)`, 'success');
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const del = async () => {
    if (!state.lockedProjectId) return;
    setBusy(true);
    try {
      enforce('edit_allocations');
      await provider.allocations.removeForAssignment(state.resource.id, state.lockedProjectId);
      await provider.activity.log({ user_id: useAppStore.getState().currentUserId, action: 'delete', entity: 'allocation', entity_id: state.lockedProjectId, details: { resource: state.resource.id } });
      await qc.invalidateQueries({ queryKey: qk.allocations });
      toast('Allocation removed', 'success');
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'New'} allocation — ${state.resource.forename}`}
      footer={
        <>
          {isEdit && <button className="btn btn-danger" onClick={del} disabled={busy} style={{ marginRight: 'auto' }}><i className="ti ti-trash" /> Remove</button>}
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={write} disabled={busy}><i className="ti ti-check" /> Save</button>
        </>
      }
    >
      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}><i className="ti ti-alert-circle" />{error}</div>}
      <Field label="Project" required>
        <Select value={projectId} onChange={setProjectId} placeholder="— Select project —"
          options={projects.filter((p) => p.status !== 'Archived').map((p) => ({ value: p.id, label: p.code || p.name }))} />
      </Field>
      <div className="form-row">
        <Field label="Start date" required><input type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="End date" required><input type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <div className="form-row">
        <Field label="Allocation %" hint="100% = 42.5h"><input type="number" step="5" min="0" className="form-control" value={percent} onChange={(e) => setPercent(e.target.value === '' ? 0 : Number(e.target.value))} /></Field>
        <Field label="Weekly hours (auto)"><input className="form-control" value={fmtHours(factorToHours(factor, cap))} disabled /></Field>
      </div>
      <div className="muted" style={{ fontSize: 'var(--text-sm)' }}><i className="ti ti-calendar-week" /> Spans <strong>{weeks.length}</strong> week(s) · factor <strong>{factor.toFixed(2)}</strong></div>
    </Modal>
  );
}
