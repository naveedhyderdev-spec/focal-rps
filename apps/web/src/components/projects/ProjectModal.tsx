import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { durationWeeks, type Project, type ProjectStage, type ProjectStatus } from '@engine';
import { Modal } from '../ui/Modal';
import { Field, Select } from '../ui/Field';
import { projectsH } from '../../hooks/useData';
import { useReference } from '../../hooks/useReference';
import { provider } from '../../data';
import { qk } from '../../lib/queryClient';
import { useAppStore } from '../../store/appStore';

const STATUSES: ProjectStatus[] = ['Active', 'On Hold', 'Archived'];

interface StageDraft {
  id?: string;
  stage_type_id: string;
  stage_name: string;
  start_date: string;
  end_date: string;
}

interface Draft {
  code: string; name: string; client: string; location_id: string;
  project_manager: string; project_type: string; status: ProjectStatus;
  notes: string;
}

function toDraft(p: Project | null): Draft {
  return {
    code: p?.code ?? '',
    name: p?.name ?? '',
    client: p?.client ?? '',
    location_id: p?.location_id ?? '',
    project_manager: p?.project_manager ?? '',
    project_type: p?.project_type ?? '',
    status: p?.status ?? 'Active',
    notes: p?.notes ?? '',
  };
}

export function ProjectModal({
  open, project, existingStages, onClose,
}: {
  open: boolean;
  project: Project | null;
  existingStages: ProjectStage[];
  onClose: () => void;
}) {
  const ref = useReference();
  const qc = useQueryClient();
  const create = projectsH.useCreate();
  const update = projectsH.useUpdate();
  const toast = useAppStore((s) => s.toast);

  const [draft, setDraft] = useState<Draft>(() => toDraft(project));
  const [stages, setStages] = useState<StageDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(toDraft(project));
    setStages(existingStages
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ id: s.id, stage_type_id: s.stage_type_id ?? '', stage_name: s.stage_name, start_date: s.start_date, end_date: s.end_date })));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project, existingStages]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const addStage = () => setStages((s) => [...s, { stage_type_id: '', stage_name: '', start_date: '', end_date: '' }]);
  const removeStage = (i: number) => setStages((s) => s.filter((_, idx) => idx !== i));
  const setStage = (i: number, patch: Partial<StageDraft>) =>
    setStages((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));

  const onPickStageType = (i: number, id: string) => {
    setStage(i, { stage_type_id: id, stage_name: ref.stageTypeById.get(id)?.name ?? '' });
  };

  const save = async () => {
    if (!draft.code.trim() && !draft.name.trim()) { setError('Project needs a code or a name'); return; }
    for (const s of stages) {
      if (!s.stage_name.trim()) { setError('Every stage needs a name'); return; }
      if (!s.start_date || !s.end_date) { setError(`Stage "${s.stage_name}" needs start and end dates`); return; }
      if (s.end_date < s.start_date) { setError(`Stage "${s.stage_name}" ends before it starts`); return; }
    }
    const fields = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      client: draft.client.trim() || null,
      location_id: draft.location_id || null,
      project_manager: draft.project_manager.trim() || null,
      project_type: draft.project_type || null,
      status: draft.status,
      start_date: null,
      end_date: null,
      notes: draft.notes.trim() || null,
    };
    setBusy(true);
    try {
      let projectId: string;
      if (project) {
        await update.mutateAsync({ id: project.id, patch: fields });
        projectId = project.id;
      } else {
        const created = await create.mutateAsync(fields);
        projectId = created.id;
      }
      // Sync stages
      const draftIds = new Set(stages.filter((s) => s.id).map((s) => s.id));
      for (const ex of existingStages) {
        if (!draftIds.has(ex.id)) await provider.stages.remove(ex.id);
      }
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        const payload = {
          project_id: projectId,
          stage_type_id: s.stage_type_id || null,
          stage_name: s.stage_name.trim(),
          start_date: s.start_date,
          end_date: s.end_date,
          duration_weeks: durationWeeks(s.start_date, s.end_date),
          sort_order: i,
        };
        if (s.id) await provider.stages.update(s.id, payload);
        else await provider.stages.create(payload);
      }
      await qc.invalidateQueries({ queryKey: qk.stages });
      await qc.invalidateQueries({ queryKey: qk.projects });
      toast(project ? `Updated ${fields.code || fields.name}` : `Created ${fields.code || fields.name}`, 'success');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Configurable project-type options (Admin → Project Types). Keep a currently-set
  // value visible even if it was later deactivated/removed, so editing doesn't lose it.
  const activeTypes = ref.projectTypes.filter((t) => t.is_active);
  const typeOptions = activeTypes.map((t) => ({ value: t.name, label: t.name }));
  if (draft.project_type && !activeTypes.some((t) => t.name === draft.project_type)) {
    typeOptions.unshift({ value: draft.project_type, label: `${draft.project_type} (inactive)` });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      size="lg"
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            <i className="ti ti-check" /> {project ? 'Save changes' : 'Create project'}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}><i className="ti ti-alert-circle" />{error}</div>}

      <div className="form-row">
        <Field label="Project code"><input className="form-control" value={draft.code} onChange={(e) => set('code', e.target.value)} placeholder="26001M" autoFocus /></Field>
        <Field label="Project name"><input className="form-control" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Discovery Condos" /></Field>
      </div>
      <div className="form-row">
        <Field label="Client"><input className="form-control" value={draft.client} onChange={(e) => set('client', e.target.value)} /></Field>
        <Field label="Project manager"><input className="form-control" value={draft.project_manager} onChange={(e) => set('project_manager', e.target.value)} /></Field>
      </div>
      <div className="form-row-3">
        <Field label="Location">
          <Select value={draft.location_id} onChange={(v) => set('location_id', v)} placeholder="—"
            options={ref.locations.map((l) => ({ value: l.id, label: l.code }))} />
        </Field>
        <Field label="Type">
          <Select value={draft.project_type} onChange={(v) => set('project_type', v)} placeholder="—"
            options={typeOptions} />
        </Field>
        <Field label="Status">
          <Select value={draft.status} onChange={(v) => set('status', v as ProjectStatus)}
            options={STATUSES.map((s) => ({ value: s, label: s }))} />
        </Field>
      </div>
      <Field label="Notes"><textarea className="form-control" value={draft.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></Field>

      {/* Inline stage builder */}
      <div style={{ marginTop: 'var(--space-4)' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="form-label" style={{ margin: 0 }}>Stages</div>
          <button type="button" className="btn btn-sm" onClick={addStage}><i className="ti ti-plus" /> Add stage</button>
        </div>
        {stages.length === 0 && <div className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 8 }}>No stages yet — add Concept → IFC stages with dates; duration auto-calculates.</div>}
        {stages.map((s, i) => (
          <div key={i} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 2 }}>
              <Select value={s.stage_type_id} onChange={(id) => onPickStageType(i, id)} placeholder="Stage…"
                options={ref.stageTypes.map((t) => ({ value: t.id, label: t.name }))} />
            </div>
            <input type="date" className="form-control" style={{ flex: 1.4 }} value={s.start_date} onChange={(e) => setStage(i, { start_date: e.target.value })} />
            <input type="date" className="form-control" style={{ flex: 1.4 }} value={s.end_date} onChange={(e) => setStage(i, { end_date: e.target.value })} />
            <div className="badge badge-gray nowrap" style={{ minWidth: 56, justifyContent: 'center' }}>
              {s.start_date && s.end_date && s.end_date >= s.start_date ? `${durationWeeks(s.start_date, s.end_date)}w` : '—'}
            </div>
            <button type="button" className="btn btn-icon btn-sm btn-ghost" onClick={() => removeStage(i)} title="Remove stage"><i className="ti ti-trash" /></button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
