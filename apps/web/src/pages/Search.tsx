import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { DisciplineTag } from '../components/ui/DisciplineTag';
import { resourcesH, projectsH, stagesH } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { fmtDate } from '../lib/format';

export function Search() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const ql = q.toLowerCase();
  const navigate = useNavigate();
  const { data: resources } = resourcesH.useList();
  const { data: projects } = projectsH.useList();
  const { data: stages } = stagesH.useList();
  const ref = useReference();

  const results = useMemo(() => {
    if (!ql) return { projects: [], resources: [], stages: [] };
    const projById = new Map((projects ?? []).map((p) => [p.id, p]));
    return {
      projects: (projects ?? []).filter((p) => `${p.code} ${p.name} ${p.client ?? ''} ${p.project_manager ?? ''}`.toLowerCase().includes(ql)).slice(0, 20),
      resources: (resources ?? []).filter((r) => `${r.forename} ${r.full_name} ${r.employee_code ?? ''} ${r.role_title ?? ''}`.toLowerCase().includes(ql)).slice(0, 20),
      stages: (stages ?? []).filter((s) => s.stage_name.toLowerCase().includes(ql)).map((s) => ({ s, project: projById.get(s.project_id) })).slice(0, 20),
    };
  }, [ql, projects, resources, stages]);

  const total = results.projects.length + results.resources.length + results.stages.length;

  return (
    <div className="page-container">
      <PageHeader title="Search" subtitle={q ? `${total} result${total === 1 ? '' : 's'} for "${q}"` : 'Type in the top bar to search projects, people and stages'} />

      {!q && <div className="card"><div className="card-body"><EmptyState icon="ti-search" title="Search the workspace" message="Find projects, people and stages by name, code, client or role." /></div></div>}

      {q && total === 0 && <div className="card"><div className="card-body"><EmptyState icon="ti-mood-empty" title="No matches" message={`Nothing matched "${q}".`} /></div></div>}

      {results.projects.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-header"><div className="card-title"><i className="ti ti-folder" /> Projects ({results.projects.length})</div></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)' }}>
            {results.projects.map((p) => (
              <button key={p.id} className="search-row" onClick={() => navigate(`/projects/${p.id}`)}>
                <i className="ti ti-folder" style={{ color: 'var(--brand-accent)' }} />
                <span style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{p.code || p.name}</span>
                <span className="muted">{p.code && p.name ? p.name : ''}</span>
                <span className="spacer" />
                <span className="badge badge-gray">{p.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {results.resources.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card-header"><div className="card-title"><i className="ti ti-users" /> People ({results.resources.length})</div></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)' }}>
            {results.resources.map((r) => (
              <button key={r.id} className="search-row" onClick={() => navigate('/resources')}>
                <i className="ti ti-user" style={{ color: 'var(--brand-accent)' }} />
                <span style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{r.forename}</span>
                <DisciplineTag discipline={ref.disciplineById.get(r.discipline_id ?? '')} />
                <span className="spacer" />
                <span className="muted">{ref.teamById.get(r.team_id ?? '')?.name ?? ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {results.stages.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title"><i className="ti ti-timeline" /> Stages ({results.stages.length})</div></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--space-2)' }}>
            {results.stages.map(({ s, project }) => (
              <button key={s.id} className="search-row" onClick={() => project && navigate(`/projects/${project.id}`)}>
                <i className="ti ti-timeline" style={{ color: 'var(--brand-accent)' }} />
                <span style={{ fontWeight: 500, color: 'var(--gray-900)' }}>{s.stage_name}</span>
                <span className="muted">{project?.code || project?.name || ''}</span>
                <span className="spacer" />
                <span className="muted">{fmtDate(s.start_date)} → {fmtDate(s.end_date)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
