import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { todayISO, type Resource, type Allocation } from '@engine';
import { Loading } from '../components/ui/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DisciplineTag } from '../components/ui/DisciplineTag';
import { ProjectModal } from '../components/projects/ProjectModal';
import { AllocationEditor } from '../components/projects/AllocationEditor';
import { MiniGantt } from '../components/projects/MiniGantt';
import { projectsH, stagesH, useAllocations, resourcesH } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useAppStore } from '../store/appStore';
import { can } from '../lib/permissions';
import { fmtDate, projectStatusBadge, fmtHours, fmtPercent, utilTextClass } from '../lib/format';
import { projectSpan, projectStatusInfo, assignmentsForProject, type ResourceAssignment } from '../lib/projects';
import { provider } from '../data';
import { qk } from '../lib/queryClient';

const TONE_BADGE: Record<string, string> = { gray: 'badge-gray', blue: 'badge-blue', green: 'badge-green', amber: 'badge-amber' };

export function ProjectDetails() {
  const { id } = useParams();
  const { data: project, isLoading } = projectsH.useItem(id);
  const { data: allStages } = stagesH.useList();
  const { data: allAllocations } = useAllocations();
  const { data: resources } = resourcesH.useList();
  const ref = useReference();
  const qc = useQueryClient();
  const role = useAppStore((s) => s.role);
  const toast = useAppStore((s) => s.toast);
  const canEditProject = can(role, 'edit_projects');
  const canAllocate = can(role, 'edit_allocations');

  const stages = useMemo(
    () => (allStages ?? []).filter((s) => s.project_id === id).sort((a, b) => a.sort_order - b.sort_order),
    [allStages, id],
  );
  const projectAllocations = useMemo(
    () => (allAllocations ?? []).filter((a) => a.project_id === id),
    [allAllocations, id],
  );
  const resourceById = useMemo(() => new Map((resources ?? []).map((r) => [r.id, r])), [resources]);
  const assignments = useMemo(
    () => assignmentsForProject(projectAllocations, resourceById),
    [projectAllocations, resourceById],
  );

  const [editProject, setEditProject] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocResource, setAllocResource] = useState<Resource | null>(null);
  const [toRemove, setToRemove] = useState<ResourceAssignment | null>(null);

  if (isLoading) return <div className="page-container"><Loading /></div>;
  if (!project) {
    return (
      <div className="page-container">
        <div className="card"><div className="card-body">
          <EmptyState icon="ti-folder-off" title="Project not found" action={<Link to="/projects" className="btn btn-primary">Back to Projects</Link>} />
        </div></div>
      </div>
    );
  }

  const span = projectSpan(project, stages);
  const status = projectStatusInfo(stages, todayISO());

  const openAdd = () => { setAllocResource(null); setAllocOpen(true); };
  const openEditAlloc = (r: Resource) => { setAllocResource(r); setAllocOpen(true); };

  const existingForResource = (resourceId: string): Allocation[] =>
    projectAllocations.filter((a) => a.resource_id === resourceId);

  const confirmRemove = async () => {
    if (!toRemove) return;
    try {
      await provider.allocations.removeForAssignment(toRemove.resource.id, project.id);
      await provider.activity.log({ user_id: useAppStore.getState().currentUserId, action: 'delete', entity: 'allocation', entity_id: project.id, details: { resource: toRemove.resource.id } });
      await qc.invalidateQueries({ queryKey: qk.allocations });
      toast(`Removed ${toRemove.resource.forename} from project`, 'success');
      setToRemove(null);
    } catch (e) { toast((e as Error).message, 'danger'); }
  };

  const info: { label: string; value: React.ReactNode }[] = [
    { label: 'Client', value: project.client ?? '—' },
    { label: 'Project manager', value: project.project_manager ?? '—' },
    { label: 'Location', value: ref.locationById.get(project.location_id ?? '')?.name ?? '—' },
    { label: 'Type', value: project.project_type ?? '—' },
    { label: 'Start', value: fmtDate(span.start) },
    { label: 'End', value: fmtDate(span.end) },
  ];

  return (
    <div className="page-container">
      <div style={{ marginBottom: 12 }}>
        <Link to="/projects" className="btn btn-sm btn-ghost"><i className="ti ti-arrow-left" /> Back to Projects</Link>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{project.code || project.name}</h1>
          <div className="page-subtitle">{project.code && project.name ? project.name : ''}</div>
        </div>
        <div className="page-header-right">
          <span className={`badge ${projectStatusBadge(project.status)}`}>{project.status}</span>
          <span className={`badge ${TONE_BADGE[status.tone]}`}>{status.label}</span>
          {canEditProject && <button className="btn" onClick={() => setEditProject(true)}><i className="ti ti-pencil" /> Edit project</button>}
        </div>
      </div>

      {/* Info block */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-body">
          <div className="metric-grid metric-grid-3" style={{ gap: 'var(--space-4)' }}>
            {info.map((i) => (
              <div key={i.label}>
                <div className="metric-label" style={{ marginBottom: 2 }}>{i.label}</div>
                <div style={{ fontWeight: 500 }}>{i.value}</div>
              </div>
            ))}
          </div>
          {project.notes && <p className="muted" style={{ marginTop: 16, fontSize: 'var(--text-sm)' }}>{project.notes}</p>}
        </div>
      </div>

      <div className="dashboard-grid-2" style={{ marginBottom: 'var(--space-5)' }}>
        {/* Stages */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Stages ({stages.length})</div>
            {canEditProject && <button className="btn btn-sm" onClick={() => setEditProject(true)}><i className="ti ti-pencil" /> Edit stages</button>}
          </div>
          {stages.length === 0 ? (
            <div className="card-body"><span className="muted">No stages defined. Edit the project to add them.</span></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Stage</th><th>Start</th><th>End</th><th style={{ textAlign: 'right' }}>Weeks</th></tr></thead>
                <tbody>
                  {stages.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.stage_name}</td>
                      <td>{fmtDate(s.start_date)}</td>
                      <td>{fmtDate(s.end_date)}</td>
                      <td style={{ textAlign: 'right' }}>{s.duration_weeks}w</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="card">
          <div className="card-header"><div className="card-title">Timeline</div></div>
          <div className="card-body">
            <MiniGantt span={span} stages={stages} assignments={assignments} />
          </div>
        </div>
      </div>

      {/* Assigned resources */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Assigned Resources ({assignments.length})</div>
          {canAllocate && <button className="btn btn-primary btn-sm" onClick={openAdd}><i className="ti ti-user-plus" /> Add resource</button>}
        </div>
        {assignments.length === 0 ? (
          <div className="card-body">
            <EmptyState icon="ti-users" title="No resources allocated"
              message="Add engineers to this project and set their weekly %."
              action={canAllocate ? <button className="btn btn-primary" onClick={openAdd}><i className="ti ti-user-plus" /> Add resource</button> : undefined} />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Resource</th><th>Discipline</th><th>Team</th>
                  <th style={{ textAlign: 'right' }}>Allocation</th><th style={{ textAlign: 'right' }}>Weekly hrs</th>
                  <th>Start</th><th>End</th><th style={{ textAlign: 'right' }}>Weeks</th>
                  {canAllocate && <th></th>}
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.resource.id}>
                    <td style={{ fontWeight: 500 }}>{a.resource.forename}</td>
                    <td><DisciplineTag discipline={ref.disciplineById.get(a.resource.discipline_id ?? '')} /></td>
                    <td>{ref.teamById.get(a.resource.team_id ?? '')?.name ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={utilTextClass(a.displayPercent)}>
                        {a.uniformFactor == null ? `${fmtPercent(a.displayPercent)} *` : fmtPercent(a.displayPercent)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtHours(a.displayHours)}</td>
                    <td>{fmtDate(a.start)}</td>
                    <td>{fmtDate(a.end)}</td>
                    <td style={{ textAlign: 'right' }}>{a.weeks}w</td>
                    {canAllocate && (
                      <td>
                        <div className="cell-actions">
                          <button className="btn btn-icon btn-sm btn-ghost" title="Edit allocation" onClick={() => openEditAlloc(a.resource)}><i className="ti ti-pencil" /></button>
                          <button className="btn btn-icon btn-sm btn-ghost" title="Remove" onClick={() => setToRemove(a)}><i className="ti ti-trash" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {assignments.some((a) => a.uniformFactor == null) && (
          <div className="card-footer muted" style={{ fontSize: 'var(--text-xs)' }}>* allocation % varies by week — peak shown. Use the Allocation Board (M4) for per-week editing.</div>
        )}
      </div>

      <ProjectModal open={editProject} project={project} existingStages={stages} onClose={() => setEditProject(false)} />
      {allocOpen && (
        <AllocationEditor
          open={allocOpen}
          project={project}
          stages={stages}
          fixedResource={allocResource}
          existing={allocResource ? existingForResource(allocResource.id) : []}
          onClose={() => setAllocOpen(false)}
        />
      )}
      <ConfirmDialog
        open={!!toRemove}
        title="Remove resource"
        message={`Remove ${toRemove?.resource.forename} and all their allocations on this project?`}
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
