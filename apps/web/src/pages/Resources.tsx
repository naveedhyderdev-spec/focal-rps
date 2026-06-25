import { useMemo, useState } from 'react';
import type { Resource } from '@engine';
import { PageHeader } from '../components/ui/PageHeader';
import { Loading } from '../components/ui/Loading';
import { DataTable, type Column } from '../components/ui/DataTable';
import { DisciplineTag } from '../components/ui/DisciplineTag';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ResourceModal } from '../components/resources/ResourceModal';
import { Select } from '../components/ui/Field';
import { resourcesH } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useAppStore } from '../store/appStore';
import { can } from '../lib/permissions';
import { statusBadgeClass, fmtHours, initials } from '../lib/format';

const STATUS_OPTS = ['Active', 'On Leave', 'Future Joiner', 'Resigned', 'Inactive'];

export function Resources() {
  const { data: resources, isLoading } = resourcesH.useList();
  const ref = useReference();
  const role = useAppStore((s) => s.role);
  const toast = useAppStore((s) => s.toast);
  const remove = resourcesH.useRemove();

  const canEdit = can(role, 'edit_employees');
  const canDelete = can(role, 'delete_employees');

  const [search, setSearch] = useState('');
  const [fTeam, setFTeam] = useState('');
  const [fDisc, setFDisc] = useState('');
  const [fGrade, setFGrade] = useState('');
  const [fLoc, setFLoc] = useState('');
  const [fStatus, setFStatus] = useState('');

  const [editing, setEditing] = useState<Resource | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Resource | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (resources ?? []).filter((r) => {
      if (q && !(`${r.forename} ${r.full_name} ${r.employee_code ?? ''} ${r.role_title ?? ''}`.toLowerCase().includes(q))) return false;
      if (fTeam && r.team_id !== fTeam) return false;
      if (fDisc && r.discipline_id !== fDisc) return false;
      if (fGrade && r.grade_id !== fGrade) return false;
      if (fLoc && r.location_id !== fLoc) return false;
      if (fStatus && r.status !== fStatus) return false;
      return true;
    });
  }, [resources, search, fTeam, fDisc, fGrade, fLoc, fStatus]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: Resource) => { setEditing(r); setModalOpen(true); };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast(`Deleted ${toDelete.forename}`, 'success');
      setToDelete(null);
    } catch (e) {
      toast((e as Error).message, 'danger');
    }
  };

  const columns: Column<Resource>[] = [
    {
      key: 'name', header: 'Employee Name', sortValue: (r) => r.forename.toLowerCase(),
      render: (r) => (
        <div className="row" style={{ gap: 10 }}>
          <div className="avatar avatar-sm">{initials(r.forename)}</div>
          <div>
            <div style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{r.forename}</div>
            <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{r.full_name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'discipline', header: 'Discipline',
      sortValue: (r) => ref.disciplineById.get(r.discipline_id ?? '')?.name ?? 'zzz',
      render: (r) => <DisciplineTag discipline={ref.disciplineById.get(r.discipline_id ?? '')} />,
    },
    {
      key: 'grade', header: 'Grade', sortValue: (r) => ref.gradeById.get(r.grade_id ?? '')?.name ?? '',
      render: (r) => ref.gradeById.get(r.grade_id ?? '')?.name ?? <span className="muted">—</span>,
    },
    {
      key: 'team', header: 'Team', sortValue: (r) => ref.teamById.get(r.team_id ?? '')?.name ?? '',
      render: (r) => ref.teamById.get(r.team_id ?? '')?.name ?? <span className="muted">—</span>,
    },
    {
      key: 'location', header: 'Location', sortValue: (r) => ref.locationById.get(r.location_id ?? '')?.code ?? '',
      render: (r) => ref.locationById.get(r.location_id ?? '')?.code ?? <span className="muted">—</span>,
    },
    { key: 'employment', header: 'Type', sortValue: (r) => r.employment_type, render: (r) => r.employment_type },
    {
      key: 'status', header: 'Status', sortValue: (r) => r.status,
      render: (r) => <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>,
    },
    {
      key: 'capacity', header: 'Capacity', align: 'right', sortValue: (r) => r.weekly_capacity_hours,
      render: (r) => fmtHours(r.weekly_capacity_hours),
    },
  ];

  if (canEdit || canDelete) {
    columns.push({
      key: 'actions', header: '', align: 'right', width: '90px',
      render: (r) => (
        <div className="cell-actions">
          {canEdit && (
            <button className="btn btn-icon btn-sm btn-ghost" title="Edit" onClick={() => openEdit(r)}>
              <i className="ti ti-pencil" />
            </button>
          )}
          {canDelete && (
            <button className="btn btn-icon btn-sm btn-ghost" title="Delete" onClick={() => setToDelete(r)}>
              <i className="ti ti-trash" />
            </button>
          )}
        </div>
      ),
    });
  }

  if (isLoading) return <div className="page-container"><Loading /></div>;

  return (
    <div className="page-container">
      <PageHeader title="People" subtitle={`${filtered.length} of ${resources?.length ?? 0} engineers, leads & support staff`}>
        {canEdit && <button className="btn btn-primary" onClick={openAdd}><i className="ti ti-plus" /> Add person</button>}
      </PageHeader>

      <div className="card">
        <div className="filter-bar">
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 14 }} />
            <input type="text" className="form-control" placeholder="Search name, code, role…"
              style={{ paddingLeft: 30 }} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={fTeam} onChange={setFTeam} placeholder="All teams" options={ref.teams.map((t) => ({ value: t.id, label: t.name }))} />
          <Select value={fDisc} onChange={setFDisc} placeholder="All disciplines" options={ref.disciplines.map((d) => ({ value: d.id, label: d.name }))} />
          <Select value={fGrade} onChange={setFGrade} placeholder="All grades" options={ref.grades.map((g) => ({ value: g.id, label: g.name }))} />
          <Select value={fLoc} onChange={setFLoc} placeholder="All locations" options={ref.locations.map((l) => ({ value: l.id, label: l.code }))} />
          <Select value={fStatus} onChange={setFStatus} placeholder="All statuses" options={STATUS_OPTS.map((s) => ({ value: s, label: s }))} />
          <div className="filter-spacer" />
          {(fTeam || fDisc || fGrade || fLoc || fStatus || search) && (
            <button className="btn btn-sm btn-ghost" onClick={() => { setSearch(''); setFTeam(''); setFDisc(''); setFGrade(''); setFLoc(''); setFStatus(''); }}>
              <i className="ti ti-x" /> Clear
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          empty={{
            icon: 'ti-users',
            title: resources?.length ? 'No people match your filters' : 'No people yet',
            message: resources?.length ? 'Try clearing the filters.' : 'Add your first engineer to start planning allocations.',
            action: canEdit && !resources?.length ? <button className="btn btn-primary" onClick={openAdd}><i className="ti ti-plus" /> Add person</button> : undefined,
          }}
        />
      </div>

      <ResourceModal open={modalOpen} resource={editing} onClose={() => setModalOpen(false)} />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete person"
        message={`Delete ${toDelete?.forename}? Their allocation history will also be removed. This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        busy={remove.isPending}
      />
    </div>
  );
}
