import { useEffect, useMemo, useState } from 'react';
import type { Resource, ResourceStatus, EmploymentType } from '@engine';
import { Modal } from '../ui/Modal';
import { Field, Select } from '../ui/Field';
import { useReference } from '../../hooks/useReference';
import { resourcesH, useSettings } from '../../hooks/useData';
import { composeFullName } from '../../lib/naming';
import { useAppStore } from '../../store/appStore';

const STATUSES: ResourceStatus[] = ['Active', 'On Leave', 'Future Joiner', 'Resigned', 'Inactive'];
const EMPLOYMENT: EmploymentType[] = ['In House', 'Agency'];

interface Draft {
  forename: string;
  full_name: string;
  employee_code: string;
  role_title: string;
  discipline_id: string;
  grade_id: string;
  team_id: string;
  location_id: string;
  employment_type: EmploymentType;
  email: string;
  weekly_capacity_hours: number;
  status: ResourceStatus;
  join_date: string;
  notes: string;
}

function toDraft(r: Resource | null, defaultCapacity: number): Draft {
  return {
    forename: r?.forename ?? '',
    full_name: r?.full_name ?? '',
    employee_code: r?.employee_code ?? '',
    role_title: r?.role_title ?? '',
    discipline_id: r?.discipline_id ?? '',
    grade_id: r?.grade_id ?? '',
    team_id: r?.team_id ?? '',
    location_id: r?.location_id ?? '',
    employment_type: r?.employment_type ?? 'In House',
    email: r?.email ?? '',
    weekly_capacity_hours: r?.weekly_capacity_hours ?? defaultCapacity,
    status: r?.status ?? 'Active',
    join_date: r?.join_date ?? '',
    notes: r?.notes ?? '',
  };
}

export function ResourceModal({
  open, resource, onClose,
}: {
  open: boolean;
  resource: Resource | null;
  onClose: () => void;
}) {
  const ref = useReference();
  const { data: settings } = useSettings();
  const create = resourcesH.useCreate();
  const update = resourcesH.useUpdate();
  const toast = useAppStore((s) => s.toast);

  const defaultCapacity = settings?.weekly_capacity_hours ?? 42.5;
  const [draft, setDraft] = useState<Draft>(() => toDraft(resource, defaultCapacity));
  const [autoName, setAutoName] = useState(!resource); // auto-compose for new records
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(toDraft(resource, defaultCapacity));
      setAutoName(!resource);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resource]);

  const composed = useMemo(() => composeFullName({
    team: ref.teamById.get(draft.team_id)?.name,
    discipline: ref.disciplineById.get(draft.discipline_id)?.name ?? (draft.role_title || undefined),
    grade: ref.gradeById.get(draft.grade_id)?.name,
    forename: draft.forename,
  }), [draft.team_id, draft.discipline_id, draft.grade_id, draft.forename, draft.role_title, ref]);

  // Keep full_name in sync while in auto mode.
  useEffect(() => {
    if (autoName) setDraft((d) => ({ ...d, full_name: composed }));
  }, [composed, autoName]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!draft.forename.trim()) { setError('Forename is required'); return; }
    if (!(draft.weekly_capacity_hours > 0)) { setError('Weekly capacity must be greater than 0'); return; }
    const payload = {
      forename: draft.forename.trim(),
      full_name: (draft.full_name || composed).trim(),
      discipline_id: draft.discipline_id || null,
      grade_id: draft.grade_id || null,
      team_id: draft.team_id || null,
      location_id: draft.location_id || null,
      employment_type: draft.employment_type,
      employee_code: draft.employee_code.trim() || null,
      email: draft.email.trim() || null,
      role_title: draft.role_title.trim() || null,
      weekly_capacity_hours: Number(draft.weekly_capacity_hours),
      status: draft.status,
      join_date: draft.join_date || null,
      notes: draft.notes.trim() || null,
    };
    try {
      if (resource) {
        await update.mutateAsync({ id: resource.id, patch: payload });
        toast(`Updated ${payload.forename}`, 'success');
      } else {
        await create.mutateAsync(payload);
        toast(`Added ${payload.forename}`, 'success');
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={resource ? 'Edit person' : 'Add person'}
      size="lg"
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            <i className="ti ti-check" /> {resource ? 'Save changes' : 'Add person'}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}><i className="ti ti-alert-circle" />{error}</div>}

      <div className="form-row">
        <Field label="Forename" required>
          <input className="form-control" value={draft.forename} onChange={(e) => set('forename', e.target.value)} autoFocus />
        </Field>
        <Field label="Employee code">
          <input className="form-control" value={draft.employee_code} onChange={(e) => set('employee_code', e.target.value)} placeholder="FOC-001" />
        </Field>
      </div>

      <div className="form-row">
        <Field label="Discipline">
          <Select value={draft.discipline_id} onChange={(v) => set('discipline_id', v)} placeholder="— None (management) —"
            options={ref.disciplines.map((d) => ({ value: d.id, label: d.name }))} />
        </Field>
        <Field label="Grade">
          <Select value={draft.grade_id} onChange={(v) => set('grade_id', v)} placeholder="— Select grade —"
            options={ref.grades.map((g) => {
              const cat = g.discipline_category;
              const show = cat && !g.name.toLowerCase().includes(cat.toLowerCase());
              return { value: g.id, label: show ? `${g.name} (${cat})` : g.name };
            })} />
        </Field>
      </div>

      <div className="form-row">
        <Field label="Team">
          <Select value={draft.team_id} onChange={(v) => set('team_id', v)} placeholder="— Select team —"
            options={ref.teams.map((t) => ({ value: t.id, label: t.name }))} />
        </Field>
        <Field label="Location">
          <Select value={draft.location_id} onChange={(v) => set('location_id', v)} placeholder="— Select location —"
            options={ref.locations.map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))} />
        </Field>
      </div>

      <div className="form-row">
        <Field label="Employment type">
          <Select value={draft.employment_type} onChange={(v) => set('employment_type', v as EmploymentType)}
            options={EMPLOYMENT.map((e) => ({ value: e, label: e }))} />
        </Field>
        <Field label="Status" hint="Inactive/Resigned are hidden from allocation dropdowns (history kept)">
          <Select value={draft.status} onChange={(v) => set('status', v as ResourceStatus)}
            options={STATUSES.map((s) => ({ value: s, label: s }))} />
        </Field>
      </div>

      <div className="form-row">
        <Field label="Weekly capacity (hours)" hint="100% = 42.5h">
          <input type="number" step="0.5" min="0" className="form-control"
            value={draft.weekly_capacity_hours}
            onChange={(e) => set('weekly_capacity_hours', e.target.value === '' ? 0 : Number(e.target.value))} />
        </Field>
        <Field label="Join date">
          <input type="date" className="form-control" value={draft.join_date} onChange={(e) => set('join_date', e.target.value)} />
        </Field>
      </div>

      <div className="form-row">
        <Field label="Work email" hint="When they sign up with this email, their login auto-links to this person">
          <input type="email" className="form-control" value={draft.email} onChange={(e) => set('email', e.target.value)} placeholder="name@focalpm.com" />
        </Field>
        <Field label="Role title">
          <input className="form-control" value={draft.role_title} onChange={(e) => set('role_title', e.target.value)} placeholder="e.g. Design Manager" />
        </Field>
      </div>

      <Field label="Full name (display label)" hint="Auto-composed from team · discipline · grade · forename">
        <div className="row" style={{ gap: 8 }}>
          <input className="form-control" value={draft.full_name}
            onChange={(e) => { setAutoName(false); set('full_name', e.target.value); }} />
          <button type="button" className="btn btn-sm" onClick={() => { setAutoName(true); set('full_name', composed); }}>
            <i className="ti ti-wand" /> Auto
          </button>
        </div>
      </Field>

      <Field label="Notes">
        <textarea className="form-control" value={draft.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
      </Field>
    </Modal>
  );
}
