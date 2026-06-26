import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  factorsByResourceWeek, factorToPercent, startOfWeek, todayISO, weekLabelMap,
} from '@engine';
import { PageHeader } from '../components/ui/PageHeader';
import { Loading } from '../components/ui/Loading';
import { Sparkline } from '../components/ui/Sparkline';
import { UtilDonut } from '../components/charts/UtilDonut';
import { DemandLine } from '../components/charts/DemandLine';
import { cssVar } from '../lib/charts';
import { ExecutiveDashboard } from '../components/dashboard/ExecutiveDashboard';
import { useSettings, useAllocations, resourcesH, projectsH, useActivity } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useWarnings, useHorizonWeeks } from '../hooks/useDerived';
import { fmtPercent, utilTextClass } from '../lib/format';
import { useAppStore, type Persona } from '../store/appStore';

const PERSONAS: { key: Persona; label: string }[] = [
  { key: 'resource_manager', label: 'Resource Manager' },
  { key: 'executive', label: 'Executive' },
  { key: 'project_manager', label: 'Project Manager' },
  { key: 'discipline_lead', label: 'Discipline Lead' },
];

const PERSONA_SECTIONS: Record<Persona, Set<string>> = {
  resource_manager: new Set(['top10', 'warnings', 'demand', 'activity']),
  executive: new Set(['demand', 'donut']),
  project_manager: new Set(['demand', 'warnings', 'activity']),
  discipline_lead: new Set(['donut', 'top10']),
};

function resolveColor(c: string): string {
  return c.startsWith('var(') ? cssVar(c.slice(4, -1)) : c;
}

export function Dashboard() {
  const { data: settings } = useSettings();
  const { data: resources } = resourcesH.useList();
  const { data: projects } = projectsH.useList();
  const { data: allocations } = useAllocations();
  const { data: activity } = useActivity(10);
  const ref = useReference();
  const warnings = useWarnings();
  const horizonWeeks = useHorizonWeeks();
  const persona = useAppStore((s) => s.persona);
  const setPersona = useAppStore((s) => s.setPersona);
  const role = useAppStore((s) => s.role);
  const isMaster = role === 'master_admin';

  const model = useMemo(() => {
    if (!settings || !resources || !projects || !allocations) return null;
    const weekStart = settings.week_start_day;
    const cap = settings.weekly_capacity_hours;
    const factors = factorsByResourceWeek(allocations);
    const todayWk = startOfWeek(todayISO(), weekStart);
    const upcoming = horizonWeeks.filter((w) => w >= todayWk).slice(0, 12);
    const demandWeeks = upcoming.slice(0, 8);
    const labels = weekLabelMap(demandWeeks);

    const activeResources = resources.filter((r) => r.status === 'Active');
    const activeProjects = projects.filter((p) => p.status !== 'Archived');

    const currentUtil = activeResources.length
      ? activeResources.reduce((s, r) => s + factorToPercent(factors.get(r.id)?.get(todayWk) ?? 0), 0) / activeResources.length
      : 0;

    const weekFactorTotal = (w: string) => {
      let s = 0;
      for (const [, fm] of factors) s += fm.get(w) ?? 0;
      return s;
    };
    const demand = demandWeeks.map((w) => weekFactorTotal(w) * cap);
    const totalCapacity = activeResources.length * cap;
    const capacity = demandWeeks.map(() => totalCapacity);

    // Donut: demand hours by discipline over the demand window
    const discHours = new Map<string, number>();
    for (const r of resources) {
      const fm = factors.get(r.id);
      if (!fm || !r.discipline_id) continue;
      let h = 0;
      for (const w of demandWeeks) h += (fm.get(w) ?? 0) * cap;
      if (h > 0) discHours.set(r.discipline_id, (discHours.get(r.discipline_id) ?? 0) + h);
    }
    const donut = ref.disciplines.map((d) => ({ label: d.name, value: discHours.get(d.id) ?? 0, color: resolveColor(d.color) }));

    // Top 10 over-allocated by peak upcoming util%
    const top10 = activeResources
      .map((r) => {
        const series = upcoming.map((w) => factorToPercent(factors.get(r.id)?.get(w) ?? 0));
        return { r, peak: series.length ? Math.max(...series) : 0, series };
      })
      .filter((x) => x.peak > 0)
      .sort((a, b) => b.peak - a.peak)
      .slice(0, 10);

    const overAllocated = new Set(warnings.filter((w) => w.type === 'over_allocated').map((w) => w.entityId)).size;
    const gaps = warnings.filter((w) => w.type === 'resource_gap').length;

    return {
      totalProjects: activeProjects.length,
      totalResources: activeResources.length,
      currentUtil, overAllocated, gaps, todayWk,
      demandLabels: demandWeeks.map((w) => labels.get(w) ?? w),
      demand, capacity, donut, top10,
    };
  }, [settings, resources, projects, allocations, horizonWeeks, warnings, ref.disciplines]);

  if (!model || !settings) return <div className="page-container"><Loading /></div>;
  const sections = PERSONA_SECTIONS[persona];
  const show = (k: string) => sections.has(k);

  return (
    <div className="page-container">
      <PageHeader
        title={isMaster ? 'Master Dashboard' : 'Admin Dashboard'}
        subtitle={`Week of ${model.todayWk} · live utilization & capacity`}
      >
        {isMaster && (
          <Link to="/admin" className="btn"><i className="ti ti-users-group" /> User Management</Link>
        )}
      </PageHeader>

      {/* Persona presets */}
      <div className="row" style={{ gap: 6, marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginRight: 4 }}>View as:</span>
        {PERSONAS.map((p) => (
          <button key={p.key} className={`btn btn-sm${persona === p.key ? ' btn-primary' : ''}`} onClick={() => setPersona(p.key)}>{p.label}</button>
        ))}
      </div>

      {persona === 'executive' ? (
        <ExecutiveDashboard />
      ) : (
      <>
      {/* KPIs */}
      <div className="metric-grid metric-grid-5" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="metric-card feature">
          <div className="metric-label"><i className="ti ti-folder" /> Total Projects</div>
          <div className="metric-value">{model.totalProjects}</div>
          <div className="metric-sub">Active programmes</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-users" /> Total Resources</div>
          <div className="metric-value">{model.totalResources}</div>
          <div className="metric-sub">Active engineers</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-gauge" /> Current Utilization</div>
          <div className={`metric-value ${utilTextClass(model.currentUtil, settings.util_thresholds)}`}>{fmtPercent(model.currentUtil)}</div>
          <div className="metric-sub">Mean across active staff</div>
        </div>
        <div className={`metric-card${model.overAllocated > 0 ? ' danger' : ''}`}>
          <div className="metric-label"><i className="ti ti-alert-circle" /> Over-allocated</div>
          <div className="metric-value">{model.overAllocated}</div>
          <div className="metric-sub">{'>'}{settings.overalloc_threshold}% next 8 weeks</div>
        </div>
        <div className={`metric-card${model.gaps > 0 ? ' warning' : ''}`}>
          <div className="metric-label"><i className="ti ti-bed" /> Resource Gaps</div>
          <div className="metric-value">{model.gaps}</div>
          <div className="metric-sub">{'<'}{settings.bench_threshold}% upcoming</div>
        </div>
      </div>

      <div className="dashboard-grid-2">
        {show('top10') && (
          <div className="card">
            <div className="card-header"><div className="card-title">Top Over-allocated Resources</div></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Resource</th><th>Team</th><th>Discipline</th><th style={{ textAlign: 'right' }}>Peak</th><th>Trend</th></tr></thead>
                <tbody>
                  {model.top10.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>No allocations in the upcoming window.</td></tr>}
                  {model.top10.map(({ r, peak, series }) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.forename}</td>
                      <td>{ref.teamById.get(r.team_id ?? '')?.name ?? '—'}</td>
                      <td>{ref.disciplineById.get(r.discipline_id ?? '')?.name ?? '—'}</td>
                      <td className={utilTextClass(peak, settings.util_thresholds)} style={{ textAlign: 'right', fontWeight: 700 }}>{Math.round(peak)}%</td>
                      <td><Sparkline values={series} color={peak > settings.overalloc_threshold ? cssVar('--color-danger') : cssVar('--brand-accent')} max={Math.max(120, peak)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {show('demand') && (
          <div className="card">
            <div className="card-header"><div className="card-title">Upcoming Demand vs Capacity</div></div>
            <div className="card-body">
              <DemandLine labels={model.demandLabels} demand={model.demand} capacity={model.capacity} />
            </div>
          </div>
        )}

        {show('donut') && (
          <div className="card">
            <div className="card-header"><div className="card-title">Demand by Discipline</div></div>
            <div className="card-body" style={{ height: 240 }}>
              <UtilDonut data={model.donut} />
            </div>
          </div>
        )}

        {show('warnings') && (
          <div className="card">
            <div className="card-header"><div className="card-title">Active Warnings ({warnings.length})</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {warnings.length === 0 && <span className="muted">No warnings in the current window 🎉</span>}
              {warnings.slice(0, 8).map((w, i) => (
                <div key={i} className={`alert alert-${w.severity === 'info' ? 'info' : w.severity}`}>
                  <i className={`ti ${w.severity === 'danger' ? 'ti-alert-circle' : w.severity === 'warning' ? 'ti-alert-triangle' : 'ti-info-circle'}`} />
                  <div><strong>{w.title}</strong><div style={{ fontSize: 'var(--text-xs)' }}>{w.detail}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {show('activity') && (
          <div className="card">
            <div className="card-header"><div className="card-title">Recent Activity</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(!activity || activity.length === 0) && <span className="muted">No activity yet.</span>}
              {activity?.map((a) => (
                <div key={a.id} className="row" style={{ gap: 8 }}>
                  <i className="ti ti-point-filled" style={{ color: 'var(--brand-accent)', fontSize: 12 }} />
                  <span style={{ fontSize: 'var(--text-sm)' }}><strong>{a.action}</strong> {a.entity}</span>
                  <span className="spacer" />
                  <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
