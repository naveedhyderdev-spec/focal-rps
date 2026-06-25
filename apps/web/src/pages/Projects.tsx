import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { todayISO, type Project, type ProjectStage } from '@engine';
import { PageHeader } from '../components/ui/PageHeader';
import { Loading } from '../components/ui/Loading';
import { DataTable, type Column } from '../components/ui/DataTable';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Select } from '../components/ui/Field';
import { ProjectModal } from '../components/projects/ProjectModal';
import { projectsH, stagesH } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useAppStore } from '../store/appStore';
import { can } from '../lib/permissions';
import { projectStatusBadge, fmtDate } from '../lib/format';
import { projectSpan, projectStatusInfo } from '../lib/projects';
import { provider } from '../data';
import { qk } from '../lib/queryClient';

const TONE_BADGE: Record<string, string> = { gray: 'badge-gray', blue: 'badge-blue', green: 'badge-green', amber: 'badge-amber' };

export function Projects() {
  const { data: projects, isLoading } = projectsH.useList();
  const { data: allStages } = stagesH.useList();
  const ref = useReference();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const role = useAppStore((s) => s.role);
  const toast = useAppStore((s) => s.toast);
  const remove = projectsH.useRemove();
  const update = projectsH.useUpdate();

  const canEdit = can(role, 'edit_projects');
  const canDelete = can(role, 'delete_projects');
  const today = todayISO();

  const stagesByProject = useMemo(() => {
    const m = new Map<string, ProjectStage[]>();
    for (const s of allStages ?? []) {
      const arr = m.get(s.project_id) ?? [];
      arr.push(s);
      m.set(s.project_id, arr);
    }
    return m;
  }, [allStages]);

  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fLoc, setFLoc] = useState('');
  const [fPM, setFPM] = useState('');
  const [fType, setFType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [toDelete, setToDelete] = useState<Project | null>(null);

  const pmOptions = useMemo(() => {
    const set = new Set((projects ?? []).map((p) => p.project_manager).filter(Boolean) as string[]);
    return [...set].sort();
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects ?? []).filter((p) => {
      if (q && !`${p.code} ${p.name} ${p.client ?? ''}`.toLowerCase().includes(q)) return false;
      if (fStatus && p.status !== fStatus) return false;
      if (fLoc && p.location_id !== fLoc) return false;
      if (fPM && p.project_manager !== fPM) return false;
      if (fType && p.project_type !== fType) return false;
      return true;
    });
  }, [projects, search, fStatus, fLoc, fPM, fType]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: Project) => { setEditing(p); setModalOpen(true); };

  const toggleArchive = async (p: Project) => {
    try {
      await update.mutateAsync({ id: p.id, patch: { status: p.status === 'Archived' ? 'Active' : 'Archived' } });
      toast(p.status === 'Archived' ? `Restored ${p.code || p.name}` : `Archived ${p.code || p.name}`, 'success');
    } catch (e) { toast((e as Error).message, 'danger'); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      // delete stages + allocations for the project, then the project
      const stages = stagesByProject.get(toDelete.id) ?? [];
      for (const s of stages) await provider.stages.remove(s.id);
      const allocs = await provider.allocations.listByProject(toDelete.id);
      await provider.allocations.removeMany(allocs.map((a) => a.id));
      await remove.mutateAsync(toDelete.id);
      await qc.invalidateQueries({ queryKey: qk.stages });
      await qc.invalidateQueries({ queryKey: qk.allocations });
      toast(`Deleted ${toDelete.code || toDelete.name}`, 'success');
      setToDelete(null);
    } catch (e) { toast((e as Error).message, 'danger'); }
  };

  const columns: Column<Project>[] = [
    {
      key: 'code', header: 'Project', sortValue: (p) => (p.code || p.name).toLowerCase(),
      render: (p) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{p.code || p.name}</div>
          {p.code && p.name && <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{p.name}</div>}
        </div>
      ),
    },
    { key: 'client', header: 'Client', sortValue: (p) => p.client ?? '', render: (p) => p.client ?? <span className="muted">—</span> },
    { key: 'location', header: 'Location', sortValue: (p) => ref.locationById.get(p.location_id ?? '')?.code ?? '', render: (p) => ref.locationById.get(p.location_id ?? '')?.code ?? <span className="muted">—</span> },
    { key: 'pm', header: 'PM', sortValue: (p) => p.project_manager ?? '', render: (p) => p.project_manager ?? <span className="muted">—</span> },
    {
      key: 'stage', header: 'Stage status',
      render: (p) => {
        const info = projectStatusInfo(stagesByProject.get(p.id) ?? [], today);
        return <span className={`badge ${TONE_BADGE[info.tone]}`}>{info.label}</span>;
      },
    },
    {
      key: 'start', header: 'Start', sortValue: (p) => projectSpan(p, stagesByProject.get(p.id) ?? []).start ?? '',
      render: (p) => fmtDate(projectSpan(p, stagesByProject.get(p.id) ?? []).start),
    },
    {
      key: 'end', header: 'End', sortValue: (p) => projectSpan(p, stagesByProject.get(p.id) ?? []).end ?? '',
      render: (p) => fmtDate(projectSpan(p, stagesByProject.get(p.id) ?? []).end),
    },
    {
      key: 'status', header: 'Status', sortValue: (p) => p.status,
      render: (p) => <span className={`badge ${projectStatusBadge(p.status)}`}>{p.status}</span>,
    },
  ];

  if (canEdit || canDelete) {
    columns.push({
      key: 'actions', header: '', align: 'right', width: '120px',
      render: (p) => (
        <div className="cell-actions" onClick={(e) => e.stopPropagation()}>
          {canEdit && <button className="btn btn-icon btn-sm btn-ghost" title="Edit" onClick={() => openEdit(p)}><i className="ti ti-pencil" /></button>}
          {canEdit && <button className="btn btn-icon btn-sm btn-ghost" title={p.status === 'Archived' ? 'Restore' : 'Archive'} onClick={() => toggleArchive(p)}><i className={`ti ${p.status === 'Archived' ? 'ti-archive-off' : 'ti-archive'}`} /></button>}
          {canDelete && <button className="btn btn-icon btn-sm btn-ghost" title="Delete" onClick={() => setToDelete(p)}><i className="ti ti-trash" /></button>}
        </div>
      ),
    });
  }

  if (isLoading) return <div className="page-container"><Loading /></div>;

  return (
    <div className="page-container">
      <PageHeader title="Projects" subtitle={`${filtered.length} of ${projects?.length ?? 0} programmes`}>
        {canEdit && <button className="btn btn-primary" onClick={openAdd}><i className="ti ti-plus" /> New project</button>}
      </PageHeader>

      <div className="card">
        <div className="filter-bar">
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 14 }} />
            <input type="text" className="form-control" placeholder="Search code, name, client…" style={{ paddingLeft: 30 }} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={fStatus} onChange={setFStatus} placeholder="All statuses" options={['Active', 'On Hold', 'Archived'].map((s) => ({ value: s, label: s }))} />
          <Select value={fLoc} onChange={setFLoc} placeholder="All locations" options={ref.locations.map((l) => ({ value: l.id, label: l.code }))} />
          <Select value={fPM} onChange={setFPM} placeholder="All PMs" options={pmOptions.map((p) => ({ value: p, label: p }))} />
          <Select value={fType} onChange={setFType} placeholder="All types" options={['ENG', 'MULTI', 'C', 'M'].map((t) => ({ value: t, label: t }))} />
          <div className="filter-spacer" />
          {(search || fStatus || fLoc || fPM || fType) && (
            <button className="btn btn-sm btn-ghost" onClick={() => { setSearch(''); setFStatus(''); setFLoc(''); setFPM(''); setFType(''); }}><i className="ti ti-x" /> Clear</button>
          )}
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(p) => p.id}
          initialSort={{ key: 'code', dir: 'asc' }}
          onRowClick={(p) => navigate(`/projects/${p.id}`)}
          empty={{
            icon: 'ti-folder',
            title: projects?.length ? 'No projects match your filters' : 'No projects yet',
            message: projects?.length ? 'Try clearing the filters.' : 'Create your first project and define its stages.',
            action: canEdit && !projects?.length ? <button className="btn btn-primary" onClick={openAdd}><i className="ti ti-plus" /> New project</button> : undefined,
          }}
        />
      </div>

      <ProjectModal open={modalOpen} project={editing} existingStages={editing ? stagesByProject.get(editing.id) ?? [] : []} onClose={() => setModalOpen(false)} />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete project"
        message={`Delete ${toDelete?.code || toDelete?.name}? Its stages and all allocations will be removed. This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        busy={remove.isPending}
      />
    </div>
  );
}
