import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  factorToPercent, factorToHours, bandInfo, startOfWeek, todayISO, weekLabelMap,
} from '@engine';
import { PageHeader } from '../components/ui/PageHeader';
import { Loading } from '../components/ui/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Field';
import { DisciplineTag } from '../components/ui/DisciplineTag';
import { resourcesH, projectsH, useAllocations, useSettings } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useHorizonWeeks } from '../hooks/useDerived';
import { useAppStore } from '../store/appStore';
import { fmtPercent, fmtHours, utilTextClass, utilCellClass } from '../lib/format';

export function MyAllocation() {
  const { data: settings } = useSettings();
  const { data: resources } = resourcesH.useList();
  const { data: projects } = projectsH.useList();
  const { data: allocations } = useAllocations();
  const ref = useReference();
  const horizonWeeks = useHorizonWeeks();
  const storeResourceId = useAppStore((s) => s.currentResourceId);
  const setCurrentResource = useAppStore((s) => s.setCurrentResource);
  const role = useAppStore((s) => s.role);

  // Which resource am I? Staff are linked to one; admins/master can pick anyone.
  const [picked, setPicked] = useState<string>('');
  const rid = picked || storeResourceId || (resources?.[0]?.id ?? '');
  const resource = useMemo(() => (resources ?? []).find((r) => r.id === rid), [resources, rid]);

  const projById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  const model = useMemo(() => {
    if (!settings || !resource || horizonWeeks.length === 0) return null;
    const cap = resource.weekly_capacity_hours;
    const todayWk = startOfWeek(todayISO(), settings.week_start_day);
    const upcoming = horizonWeeks.filter((w) => w >= todayWk);
    const weeks = (upcoming.length ? upcoming : horizonWeeks).slice(0, 12);
    const labels = weekLabelMap(weeks);
    const idx = (w: string) => weeks.indexOf(w);
    const curIdx = Math.max(0, weeks.indexOf(todayWk));

    const mine = (allocations ?? []).filter((a) => a.resource_id === resource.id);
    const perProject = new Map<string, number[]>();
    const weekTotals = new Array(weeks.length).fill(0);
    for (const a of mine) {
      const wi = idx(a.week_start_date);
      if (wi < 0) continue;
      let arr = perProject.get(a.project_id);
      if (!arr) { arr = new Array(weeks.length).fill(0); perProject.set(a.project_id, arr); }
      arr[wi] += a.allocation_factor;
      weekTotals[wi] += a.allocation_factor;
    }

    const projectRows = [...perProject.entries()].map(([pid, arr]) => {
      const nonZero = arr.filter((x) => x > 0);
      const avgF = arr.reduce((s, x) => s + x, 0) / weeks.length;
      const peakF = Math.max(0, ...arr);
      return {
        project: projById.get(pid),
        current: factorToPercent(arr[curIdx]),
        avg: factorToPercent(avgF),
        peak: factorToPercent(peakF),
        avgHours: factorToHours(avgF, cap),
        active: nonZero.length,
      };
    }).filter((r) => r.peak > 0).sort((a, b) => b.avg - a.avg);

    const weekStrip = weeks.map((w, i) => ({ week: w, label: labels.get(w) ?? w, pct: factorToPercent(weekTotals[i]), isCurrent: i === curIdx }));
    const currentPct = factorToPercent(weekTotals[curIdx]);
    const avgPct = (weekTotals.reduce((s, x) => s + x, 0) / weeks.length) * 100;

    return { weeks, weekStrip, projectRows, currentPct, avgPct, cap };
  }, [settings, resource, allocations, horizonWeeks, projById]);

  if (!settings || !resources) return <div className="page-container"><Loading /></div>;

  const resourceOptions = [...resources]
    .sort((a, b) => a.forename.localeCompare(b.forename))
    .map((r) => ({ value: r.id, label: r.full_name || r.forename }));

  const onPick = (v: string) => { setPicked(v); setCurrentResource(v); };

  return (
    <div className="page-container">
      <PageHeader title="My Allocation" subtitle="Your week-by-week loading and per-project breakdown">
        {role !== 'staff' && (
          <div className="row" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>Viewing as</span>
            <Select value={rid} onChange={onPick} options={resourceOptions} />
          </div>
        )}
      </PageHeader>

      {!resource ? (
        <div className="card"><div className="card-body"><EmptyState icon="ti-user-question" title="No linked resource" message="This account isn't linked to a person yet." /></div></div>
      ) : !model ? (
        <div className="card"><div className="card-body"><EmptyState icon="ti-calendar-off" title="No allocations" message="You have no allocations in the upcoming window." /></div></div>
      ) : (
        <>
          {/* Identity + headline */}
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
              <div className="row" style={{ gap: 12 }}>
                <div className="avatar avatar-lg">{resource.forename.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--gray-900)' }}>{resource.forename}</div>
                  <div className="row" style={{ gap: 10, fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                    <DisciplineTag discipline={ref.disciplineById.get(resource.discipline_id ?? '')} />
                    <span>{ref.teamById.get(resource.team_id ?? '')?.name ?? ''}</span>
                    <span>{ref.locationById.get(resource.location_id ?? '')?.code ?? ''}</span>
                  </div>
                </div>
              </div>
              <div className="spacer" />
              <div style={{ textAlign: 'center' }}>
                <div className="metric-label">This week</div>
                <div className={`metric-value ${utilTextClass(model.currentPct, settings.util_thresholds)}`}>{fmtPercent(model.currentPct)}</div>
                <div className="metric-sub">{bandInfo(model.currentPct, settings.util_thresholds).label}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="metric-label">Avg (12 wks)</div>
                <div className={`metric-value ${utilTextClass(model.avgPct, settings.util_thresholds)}`}>{fmtPercent(model.avgPct)}</div>
                <div className="metric-sub">capacity {fmtHours(model.cap)}/wk</div>
              </div>
            </div>
          </div>

          {/* Weekly strip */}
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><div className="card-title">Next 12 weeks</div></div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                {model.weekStrip.map((w) => (
                  <div key={w.week} title={`${w.week} · ${Math.round(w.pct)}%`}
                    className={w.pct > 0 ? utilCellClass(w.pct, settings.util_thresholds) : ''}
                    style={{ minWidth: 56, flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 'var(--radius-sm)', border: w.isCurrent ? '1px solid var(--brand-accent)' : '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 9, color: 'var(--gray-500)' }}>{w.label}</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{Math.round(w.pct)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Per-project breakdown */}
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><div className="card-title">Per-project breakdown ({model.projectRows.length})</div></div>
            {model.projectRows.length === 0 ? (
              <div className="card-body"><span className="muted">No projects in the upcoming window.</span></div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Project</th><th style={{ textAlign: 'right' }}>This week</th><th style={{ textAlign: 'right' }}>Avg %</th><th style={{ textAlign: 'right' }}>Avg hrs/wk</th><th style={{ textAlign: 'right' }}>Peak %</th></tr></thead>
                  <tbody>
                    {model.projectRows.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{row.project?.code || row.project?.name || '—'}<span className="muted" style={{ marginLeft: 6, fontSize: 'var(--text-xs)' }}>{row.project?.code && row.project?.name ? row.project.name : ''}</span></td>
                        <td className={utilTextClass(row.current, settings.util_thresholds)} style={{ textAlign: 'right', fontWeight: 600 }}>{fmtPercent(row.current)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtPercent(row.avg)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtHours(row.avgHours)}</td>
                        <td className={utilTextClass(row.peak, settings.util_thresholds)} style={{ textAlign: 'right' }}>{fmtPercent(row.peak)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="alert alert-info">
            <i className="ti ti-eye" />
            <div>Read-only view. Browse the team-wide{' '}
              <Link to="/summary">Resource Summary</Link>, <Link to="/board">Allocation Board</Link>,{' '}
              <Link to="/projects">Projects</Link> and <Link to="/graphs">Insights</Link>.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
