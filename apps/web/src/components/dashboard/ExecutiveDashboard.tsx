import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { factorsByResourceWeek, factorToPercent, startOfWeek, todayISO } from '@engine';
import { Loading } from '../ui/Loading';
import { Sparkline } from '../ui/Sparkline';
import { DisciplineTag } from '../ui/DisciplineTag';
import { cssVar } from '../../lib/charts';
import { resourcesH, useAllocations, useSettings } from '../../hooks/useData';
import { useReference } from '../../hooks/useReference';
import { useHorizonWeeks } from '../../hooks/useDerived';
import { utilTextClass, fmtHours, fmtPercent, initials } from '../../lib/format';

/**
 * Executive Dashboard (DSU-2 §3.5): 5 KPI cards + two leaderboards
 * (Top Overloaded / Top Available). Renders when persona === 'executive'.
 */
export function ExecutiveDashboard() {
  const { data: settings } = useSettings();
  const { data: resources } = resourcesH.useList();
  const { data: allocations } = useAllocations();
  const ref = useReference();
  const horizonWeeks = useHorizonWeeks();

  const model = useMemo(() => {
    if (!settings || !resources || !allocations) return null;
    const cap = settings.weekly_capacity_hours;
    const t = settings.util_thresholds;
    const factors = factorsByResourceWeek(allocations);
    const todayWk = startOfWeek(todayISO(), settings.week_start_day);
    const upcoming = horizonWeeks.filter((w) => w >= todayWk).slice(0, 12);
    const active = resources.filter((r) => r.status === 'Active');

    const rows = active.map((r) => {
      const series = upcoming.map((w) => factorToPercent(factors.get(r.id)?.get(w) ?? 0));
      const current = factorToPercent(factors.get(r.id)?.get(todayWk) ?? 0);
      const peak = series.length ? Math.max(...series) : 0;
      const spare = Math.max(0, (100 - current) / 100) * (r.weekly_capacity_hours || cap);
      return { r, series, current, peak, spare };
    });

    const under = rows.filter((x) => x.current < 80).length;
    const over = rows.filter((x) => x.current > t.slightOverMax).length;
    const utilized = rows.length - under - over;

    // Hiring required: disciplines whose manual target FTE exceeds active headcount.
    const targets = settings.capacity_targets ?? {};
    const activeByDisc = new Map<string, number>();
    for (const r of active) if (r.discipline_id) activeByDisc.set(r.discipline_id, (activeByDisc.get(r.discipline_id) ?? 0) + 1);
    const hiringDepts = Object.entries(targets).filter(([id, fte]) => fte > (activeByDisc.get(id) ?? 0));

    const overloaded = [...rows].filter((x) => x.peak > 0).sort((a, b) => b.peak - a.peak).slice(0, 10);
    const available = [...rows].sort((a, b) => a.current - b.current).slice(0, 10);

    return { total: active.length, under, over, utilized, hiring: hiringDepts.length, overloaded, available, t };
  }, [settings, resources, allocations, horizonWeeks]);

  if (!model || !settings) return <Loading />;
  const danger = cssVar('--color-danger');
  const accent = cssVar('--brand-accent');

  return (
    <>
      <div className="metric-grid metric-grid-5" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-users" /> Total Staff</div>
          <div className="metric-value">{model.total}</div>
          <div className="metric-sub">Active headcount</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-gauge" /> Utilized</div>
          <div className="metric-value" style={{ color: 'var(--color-success)' }}>{model.utilized}</div>
          <div className="metric-sub">80–110% this week</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-arrow-down-circle" /> Under-utilized</div>
          <div className="metric-value" style={{ color: 'var(--color-info)' }}>{model.under}</div>
          <div className="metric-sub">&lt;80% this week</div>
        </div>
        <div className={`metric-card${model.over > 0 ? ' danger' : ''}`}>
          <div className="metric-label"><i className="ti ti-alert-circle" /> Over-utilized</div>
          <div className="metric-value">{model.over}</div>
          <div className="metric-sub">&gt;{model.t.slightOverMax}% this week</div>
        </div>
        <div className={`metric-card${model.hiring > 0 ? ' danger' : ''}`}>
          <div className="metric-label"><i className="ti ti-user-plus" /> Hiring Required</div>
          <div className="metric-value">{model.hiring}</div>
          <div className="metric-sub">
            <Link to="/capacity" style={{ color: 'inherit', textDecoration: 'underline' }}>View hiring plan →</Link>
          </div>
        </div>
      </div>

      <div className="dashboard-grid-2">
        {/* Top overloaded */}
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="status-dot danger" style={{ marginRight: 6 }} />Top 10 Overloaded</div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th style={{ width: 28 }}>#</th><th>Resource</th><th>Dept</th><th style={{ textAlign: 'right' }}>Peak</th><th>Trend</th></tr></thead>
              <tbody>
                {model.overloaded.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>No overloaded staff 🎉</td></tr>}
                {model.overloaded.map((x, i) => (
                  <tr key={x.r.id}>
                    <td className="muted" style={{ fontFamily: 'var(--font-mono)' }}>{String(i + 1).padStart(2, '0')}</td>
                    <td><Link to="/board" className="row" style={{ gap: 8, color: 'inherit' }}><span className="avatar avatar-sm">{initials(x.r.forename)}</span>{x.r.forename}</Link></td>
                    <td><DisciplineTag discipline={ref.disciplineById.get(x.r.discipline_id ?? '')} /></td>
                    <td className={utilTextClass(x.peak, model.t)} style={{ textAlign: 'right', fontWeight: 700 }}>{Math.round(x.peak)}%</td>
                    <td><Sparkline values={x.series} color={x.peak > model.t.slightOverMax ? danger : accent} max={Math.max(120, x.peak)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer"><Link to="/board" className="muted" style={{ fontSize: 'var(--text-xs)' }}>View all on the Board →</Link></div>
        </div>

        {/* Top available */}
        <div className="card">
          <div className="card-header"><div className="card-title"><span className="status-dot active" style={{ marginRight: 6 }} />Top 10 Available</div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th style={{ width: 28 }}>#</th><th>Resource</th><th>Dept</th><th style={{ textAlign: 'right' }}>Util</th><th style={{ textAlign: 'right' }}>Spare/wk</th></tr></thead>
              <tbody>
                {model.available.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>Everyone is at capacity.</td></tr>}
                {model.available.map((x, i) => (
                  <tr key={x.r.id}>
                    <td className="muted" style={{ fontFamily: 'var(--font-mono)' }}>{String(i + 1).padStart(2, '0')}</td>
                    <td><Link to="/board" className="row" style={{ gap: 8, color: 'inherit' }}><span className="avatar avatar-sm">{initials(x.r.forename)}</span>{x.r.forename}</Link></td>
                    <td><DisciplineTag discipline={ref.disciplineById.get(x.r.discipline_id ?? '')} /></td>
                    <td className={utilTextClass(x.current, model.t)} style={{ textAlign: 'right', fontWeight: 600 }}>{fmtPercent(x.current)}</td>
                    <td className="util-under" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtHours(x.spare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer"><Link to="/resources" className="muted" style={{ fontSize: 'var(--text-xs)' }}>View all People →</Link></div>
        </div>
      </div>
    </>
  );
}
