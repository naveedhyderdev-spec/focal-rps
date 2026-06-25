import { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Field, Select } from '../ui/Field';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { useAppStore } from '../../store/appStore';
import { fmtDate } from '../../lib/format';

export type FieldType = 'text' | 'number' | 'date' | 'color' | 'toggle' | 'select';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  default?: unknown;
  required?: boolean;
  width?: string;
}

// Loosely typed to bridge the generic CrudInput shapes; the editor builds payloads
// from the field defs, so runtime values match each entity's real fields.
/* eslint-disable @typescript-eslint/no-explicit-any */
interface CrudHooks<T> {
  useList: () => { data?: T[] };
  useCreate: () => { mutateAsync: (input: any) => Promise<T>; isPending: boolean };
  useUpdate: () => { mutateAsync: (a: { id: string; patch: any }) => Promise<T>; isPending: boolean };
  useRemove: () => { mutateAsync: (id: string) => Promise<void>; isPending: boolean };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const COLOR_PRESETS = [
  'var(--disc-mech)', 'var(--disc-elec)', 'var(--disc-bim)', 'var(--disc-arch)',
  'var(--disc-civil)', 'var(--disc-plumb)', 'var(--color-info)', 'var(--color-success)',
  'var(--color-warning)', 'var(--color-purple)', 'var(--disc-pm)',
];

export function MasterEditor<T extends { id: string }>({
  title, description, hooks, fields, sortBy, labelField = 'name',
}: {
  title: string;
  description?: string;
  hooks: CrudHooks<T>;
  fields: FieldDef[];
  sortBy?: (a: T, b: T) => number;
  labelField?: string;
}) {
  const { data } = hooks.useList();
  const create = hooks.useCreate();
  const update = hooks.useUpdate();
  const remove = hooks.useRemove();
  const toast = useAppStore((s) => s.toast);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<T | null>(null);

  const rows = useMemo(() => {
    const list = [...(data ?? [])] as T[];
    if (sortBy) list.sort(sortBy);
    return list;
  }, [data, sortBy]);

  const openAdd = () => {
    const d: Record<string, unknown> = {};
    for (const f of fields) d[f.key] = f.default ?? (f.type === 'toggle' ? true : f.type === 'number' ? 0 : '');
    setDraft(d);
    setEditing(null);
    setError(null);
    setOpen(true);
  };
  const openEdit = (row: T) => {
    const d: Record<string, unknown> = {};
    for (const f of fields) d[f.key] = (row as Record<string, unknown>)[f.key] ?? (f.type === 'toggle' ? false : '');
    setDraft(d);
    setEditing(row);
    setError(null);
    setOpen(true);
  };

  const setVal = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    for (const f of fields) {
      if (f.required && (draft[f.key] === '' || draft[f.key] == null)) {
        setError(`${f.label} is required`);
        return;
      }
    }
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      let v = draft[f.key];
      if (f.type === 'number') v = Number(v) || 0;
      if (f.type === 'select' && v === '') v = null;
      payload[f.key] = v;
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload });
        toast(`Updated`, 'success');
      } else {
        await create.mutateAsync(payload);
        toast(`Added`, 'success');
      }
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const renderCell = (row: T, f: FieldDef) => {
    const v = (row as Record<string, unknown>)[f.key];
    if (f.type === 'color') return <span className="row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: String(v), display: 'inline-block' }} />{String(v).replace('var(--', '').replace(')', '')}</span>;
    if (f.type === 'toggle') return <span className={`badge ${v ? 'badge-green' : 'badge-gray'}`}>{v ? 'Active' : 'Inactive'}</span>;
    if (f.type === 'date') return fmtDate(v as string);
    if (f.type === 'select') { const sv = (v ?? '') as string; return f.options?.find((o) => o.value === sv)?.label ?? (sv ? String(sv) : <span className="muted">—</span>); }
    if (v === '' || v == null) return <span className="muted">—</span>;
    return String(v);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {description && <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>{description}</div>}
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}><i className="ti ti-plus" /> Add</button>
      </div>
      {rows.length === 0 ? (
        <div className="card-body"><EmptyState icon="ti-database" title={`No ${title.toLowerCase()} yet`} message="Add the first one." /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{fields.map((f) => <th key={f.key} style={{ width: f.width }}>{f.label}</th>)}<th style={{ width: 80 }}></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {fields.map((f) => <td key={f.key} style={{ fontWeight: f.key === labelField ? 500 : 400, color: f.key === labelField ? 'var(--gray-900)' : undefined }}>{renderCell(row, f)}</td>)}
                  <td>
                    <div className="cell-actions">
                      <button className="btn btn-icon btn-sm btn-ghost" title="Edit" onClick={() => openEdit(row)}><i className="ti ti-pencil" /></button>
                      <button className="btn btn-icon btn-sm btn-ghost" title="Delete" onClick={() => setToDelete(row)}><i className="ti ti-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${title}` : `Add ${title}`}
        footer={<>
          <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={create.isPending || update.isPending}><i className="ti ti-check" /> Save</button>
        </>}>
        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}><i className="ti ti-alert-circle" />{error}</div>}
        {fields.map((f) => (
          <Field key={f.key} label={f.label} required={f.required}>
            {f.type === 'select' ? (
              <Select value={String(draft[f.key] ?? '')} onChange={(v) => setVal(f.key, v)} placeholder={f.placeholder ?? '—'} options={f.options ?? []} />
            ) : f.type === 'toggle' ? (
              <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!draft[f.key]} onChange={(e) => setVal(f.key, e.target.checked)} />
                <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>{draft[f.key] ? 'Active' : 'Inactive'}</span>
              </label>
            ) : f.type === 'color' ? (
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {COLOR_PRESETS.map((c) => (
                  <button key={c} type="button" onClick={() => setVal(f.key, c)}
                    style={{ width: 26, height: 26, borderRadius: 6, background: c, border: draft[f.key] === c ? '2px solid var(--text-strong, #fff)' : '2px solid transparent', cursor: 'pointer', outline: '1px solid var(--border-subtle)' }} />
                ))}
              </div>
            ) : (
              <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} className="form-control"
                value={String(draft[f.key] ?? '')} placeholder={f.placeholder}
                onChange={(e) => setVal(f.key, e.target.value)} />
            )}
          </Field>
        ))}
      </Modal>

      <ConfirmDialog open={!!toDelete} title={`Delete ${title}`}
        message={`Delete "${String((toDelete as Record<string, unknown> | null)?.[labelField] ?? '')}"? This cannot be undone.`}
        onConfirm={async () => { if (toDelete) { try { await remove.mutateAsync(toDelete.id); toast('Deleted', 'success'); } catch (e) { toast((e as Error).message, 'danger'); } setToDelete(null); } }}
        onCancel={() => setToDelete(null)} busy={remove.isPending} />
    </div>
  );
}
