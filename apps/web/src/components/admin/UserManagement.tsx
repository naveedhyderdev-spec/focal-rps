import { useMemo, useState } from 'react';
import type { AppUser, AppRole } from '@engine';
import { Modal } from '../ui/Modal';
import { Field, Select } from '../ui/Field';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { usersH, resourcesH } from '../../hooks/useData';
import { useAppStore } from '../../store/appStore';
import { roleLabel, ALL_ROLES } from '../../lib/permissions';
import { usingSupabase, ALLOWED_EMAIL_DOMAIN } from '../../lib/auth';

const ROLE_BADGE: Record<AppRole, string> = { master_admin: 'badge-purple', admin: 'badge-blue', staff: 'badge-gray' };

interface Draft { name: string; email: string; role: AppRole; status: 'Active' | 'Inactive'; resource_id: string }

/**
 * Master-Admin-only user management (RBAC §5): promote/demote, activate/deactivate,
 * link Staff to a resource. Guard rails: at least one active Master Admin must
 * always remain; role changes are written to the activity log (via the hooks).
 */
export function UserManagement() {
  const { data: users } = usersH.useList();
  const { data: resources } = resourcesH.useList();
  const create = usersH.useCreate();
  const update = usersH.useUpdate();
  const remove = usersH.useRemove();
  const createResource = resourcesH.useCreate();
  const toast = useAppStore((s) => s.toast);

  /** One-click: turn an account into an allocatable Person and link them. */
  const createPerson = async (u: AppUser) => {
    try {
      const forename = (u.name?.trim() || u.email.split('@')[0]).replace(/[._-]+/g, ' ').trim();
      const res = await createResource.mutateAsync({
        forename, full_name: forename, discipline_id: null, grade_id: null, team_id: null, location_id: null,
        employment_type: 'In House', employee_code: null, email: u.email, role_title: null,
        weekly_capacity_hours: 42.5, status: 'Active', join_date: null, notes: null,
      });
      await update.mutateAsync({ id: u.id, patch: { resource_id: res.id } });
      toast(`Created Person “${forename}” — set their discipline/team in People`, 'success');
    } catch (e) { toast((e as Error).message, 'danger'); }
  };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', email: '', role: 'staff', status: 'Active', resource_id: '' });
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AppUser | null>(null);
  const [inviteInfo, setInviteInfo] = useState(false);

  const activeMasters = useMemo(() => (users ?? []).filter((u) => u.role === 'master_admin' && u.status === 'Active'), [users]);

  // Unified roster: every login account, PLUS every imported Person who has no
  // login yet — so the Master sees the whole org and who can actually sign in.
  const { accountRows, importedRows } = useMemo(() => {
    const accts = users ?? [];
    const ppl = resources ?? [];
    const personById = new Map(ppl.map((p) => [p.id, p]));
    const linkedIds = new Set(accts.map((a) => a.resource_id).filter(Boolean) as string[]);
    const linkedEmails = new Set(accts.map((a) => a.email.toLowerCase()));
    const accountRows = [...accts]
      .sort((a, b) => ALL_ROLES.indexOf(a.role) - ALL_ROLES.indexOf(b.role) || a.name.localeCompare(b.name))
      .map((a) => ({
        account: a,
        person: (a.resource_id ? personById.get(a.resource_id) : undefined)
          ?? ppl.find((p) => p.email && p.email.toLowerCase() === a.email.toLowerCase()),
      }));
    const importedRows = ppl
      .filter((p) => !linkedIds.has(p.id) && !(p.email && linkedEmails.has(p.email.toLowerCase())))
      .sort((a, b) => (a.full_name || a.forename).localeCompare(b.full_name || b.forename));
    return { accountRows, importedRows };
  }, [users, resources]);

  const isLastMaster = (u: AppUser) => u.role === 'master_admin' && u.status === 'Active' && activeMasters.length <= 1;

  const openAdd = () => { setEditing(null); setDraft({ name: '', email: '', role: 'staff', status: 'Active', resource_id: '' }); setError(null); setOpen(true); };
  const openEdit = (u: AppUser) => { setEditing(u); setDraft({ name: u.name, email: u.email, role: u.role, status: u.status, resource_id: u.resource_id ?? '' }); setError(null); setOpen(true); };

  const save = async () => {
    if (!draft.name.trim() || !draft.email.trim()) { setError('Name and email are required'); return; }
    // Guard: don't demote/deactivate the last active Master Admin.
    if (editing && isLastMaster(editing) && (draft.role !== 'master_admin' || draft.status !== 'Active')) {
      setError('At least one active Master Admin must remain.'); return;
    }
    const payload = { name: draft.name.trim(), email: draft.email.trim(), role: draft.role, status: draft.status, resource_id: draft.resource_id || null };
    try {
      if (editing) { await update.mutateAsync({ id: editing.id, patch: payload }); toast('User updated', 'success'); }
      else { await create.mutateAsync(payload); toast('User invited', 'success'); }
      setOpen(false);
    } catch (e) { setError((e as Error).message); }
  };

  const setRoleQuick = async (u: AppUser, role: AppRole) => {
    if (isLastMaster(u) && role !== 'master_admin') { toast('At least one active Master Admin must remain.', 'danger'); return; }
    try { await update.mutateAsync({ id: u.id, patch: { role } }); toast(`${u.name} is now ${roleLabel(role)}`, 'success'); }
    catch (e) { toast((e as Error).message, 'danger'); }
  };

  const toggleActive = async (u: AppUser) => {
    const next = u.status === 'Active' ? 'Inactive' : 'Active';
    if (isLastMaster(u) && next === 'Inactive') { toast('At least one active Master Admin must remain.', 'danger'); return; }
    try { await update.mutateAsync({ id: u.id, patch: { status: next } }); toast(`${u.name} ${next === 'Active' ? 'activated' : 'deactivated'}`, 'success'); }
    catch (e) { toast((e as Error).message, 'danger'); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    if (isLastMaster(toDelete)) { toast('At least one active Master Admin must remain.', 'danger'); setToDelete(null); return; }
    try { await remove.mutateAsync(toDelete.id); toast('User removed', 'success'); setToDelete(null); }
    catch (e) { toast((e as Error).message, 'danger'); }
  };

  const resourceOptions = [{ value: '', label: '— Not linked —' }, ...[...(resources ?? [])].sort((a, b) => a.forename.localeCompare(b.forename)).map((r) => ({ value: r.id, label: r.full_name || r.forename }))];

  return (
    <div className="card">
      <div className="card-header">
        <div><div className="card-title">Users &amp; Access</div><div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>{accountRows.length} signed-up · {importedRows.length} imported (no login yet). Imported people get a login when they sign up with their email.</div></div>
        <button className="btn btn-primary btn-sm" onClick={() => (usingSupabase ? setInviteInfo(true) : openAdd())}><i className="ti ti-user-plus" /> Invite user</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Employee ID</th><th>Access</th><th>Role</th><th>Status</th><th style={{ width: 190 }}>Actions</th></tr></thead>
          <tbody>
            {/* Signed-up login accounts */}
            {accountRows.map(({ account: u, person: p }) => (
              <tr key={`a-${u.id}`}>
                <td style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{p?.full_name || u.name}</td>
                <td className="muted">{u.email}</td>
                <td className="muted">{p?.employee_code ?? '—'}</td>
                <td><span className="badge badge-green badge-dot">Signed up</span></td>
                <td><span className={`badge ${ROLE_BADGE[u.role]}`}>{roleLabel(u.role)}</span></td>
                <td><span className={`badge ${u.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>{u.status}</span></td>
                <td>
                  <div className="cell-actions" style={{ justifyContent: 'flex-start', gap: 4 }}>
                    {u.role !== 'admin' && u.role !== 'master_admin' && <button className="btn btn-sm" title="Promote to Admin" onClick={() => setRoleQuick(u, 'admin')}><i className="ti ti-arrow-up" /> Admin</button>}
                    {u.role === 'admin' && <button className="btn btn-sm" title="Demote to Staff" onClick={() => setRoleQuick(u, 'staff')}><i className="ti ti-arrow-down" /> Staff</button>}
                    {!p && <button className="btn btn-icon btn-sm btn-ghost" title="Create a Person for this account" onClick={() => createPerson(u)} disabled={createResource.isPending}><i className="ti ti-user-plus" /></button>}
                    <button className="btn btn-icon btn-sm btn-ghost" title="Edit" onClick={() => openEdit(u)}><i className="ti ti-pencil" /></button>
                    <button className="btn btn-icon btn-sm btn-ghost" title={u.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(u)}><i className={`ti ${u.status === 'Active' ? 'ti-user-off' : 'ti-user-check'}`} /></button>
                    <button className="btn btn-icon btn-sm btn-ghost" title="Delete" onClick={() => setToDelete(u)}><i className="ti ti-trash" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {/* Imported people with no login yet */}
            {importedRows.map((p) => (
              <tr key={`p-${p.id}`}>
                <td style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{p.full_name || p.forename}</td>
                <td className="muted">{p.email ?? '—'}</td>
                <td className="muted">{p.employee_code ?? '—'}</td>
                <td><span className="badge badge-amber badge-dot">Imported · no login</span></td>
                <td className="muted">—</td>
                <td><span className="badge badge-gray">{p.status}</span></td>
                <td><span className="muted" style={{ fontSize: 'var(--text-xs)' }}>Gets a login when they sign up</span></td>
              </tr>
            ))}
            {accountRows.length === 0 && importedRows.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>No users or people yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit user' : 'Invite user'}
        footer={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={create.isPending || update.isPending}><i className="ti ti-check" /> Save</button></>}>
        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}><i className="ti ti-alert-circle" />{error}</div>}
        <div className="form-row">
          <Field label="Name" required><input className="form-control" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Email" required><input className="form-control" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Role"><Select value={draft.role} onChange={(v) => setDraft({ ...draft, role: v as AppRole })} options={ALL_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))} /></Field>
          <Field label="Status"><Select value={draft.status} onChange={(v) => setDraft({ ...draft, status: v as 'Active' | 'Inactive' })} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} /></Field>
        </div>
        <Field label="Linked resource (for Staff 'My Allocation')" hint="Links this account to a person so they see their own allocation.">
          <Select value={draft.resource_id} onChange={(v) => setDraft({ ...draft, resource_id: v })} options={resourceOptions} />
        </Field>
      </Modal>

      <ConfirmDialog open={!!toDelete} title="Remove user"
        message={usingSupabase
          ? `Remove ${toDelete?.name}'s access? They'll be blocked from the app. Their Supabase sign-in still exists — delete it under Authentication → Users to remove the login entirely.`
          : `Remove ${toDelete?.name}'s account? This cannot be undone.`}
        onConfirm={confirmDelete} onCancel={() => setToDelete(null)} busy={remove.isPending} />

      <Modal open={inviteInfo} onClose={() => setInviteInfo(false)} title="How to add a user"
        footer={<>
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(window.location.origin + window.location.pathname); toast('App link copied', 'success'); }}><i className="ti ti-link" /> Copy app link</button>
          <button className="btn btn-primary" onClick={() => setInviteInfo(false)}>Got it</button>
        </>}>
        <p className="muted" style={{ marginBottom: 12 }}>
          Accounts are created by sign-up (a secure Supabase Auth user) — they can't be created here directly.
        </p>
        <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--gray-700)' }}>
          <li>Share the app link and ask the person to <strong>Sign up</strong> with their <strong>@{ALLOWED_EMAIL_DOMAIN}</strong> email (and verify it).</li>
          <li>They appear in this list as <strong>Staff</strong> — set their role here (promote to Admin) and link or <strong>Create Person</strong>.</li>
          <li><strong>Tip:</strong> pre-create their Person in <strong>People</strong> with the same email and their account auto-links on sign-up.</li>
        </ol>
      </Modal>
    </div>
  );
}
