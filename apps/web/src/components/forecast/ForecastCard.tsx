import { useMemo } from 'react';
import {
  buildDemandCapacity, realCapacity, startOfWeek, todayISO, addDays,
} from '@engine';
import { EmptyState } from '../ui/EmptyState';
import { resourcesH, useAllocations, useSettings, holidaysH } from '../../hooks/useData';
import { useReference } from '../../hooks/useReference';
import { useHorizonWeeks } from '../../hooks/useDerived';
import { useAppStore } from '../../store/appStore';
import { fmtHours, utilTextClass } from '../../lib/format';

const HORIZONS = [8, 12, 26];

/**
 * Predictive Hiring Forecast (BETA, DSU-2 §3.3). Heuristic: projects each
 * discipline's demand to the chosen horizon and compares it to current real
 * capacity, recommending hires where a shortage is projected. "Required
 * Capacity" is a NEW data input — this is an estimate, flagged below.
 */
export function ForecastCard() {
  const { data: settings } = useSettings();
  const { data: resources } = resourcesH.useList();
  const { data: allocations } = useAllocations();
  const { data: holidays } = holidaysH.useList();
  const ref = useReference();
  const horizonWeeks = useHorizonWeeks();
  const enabled = useAppStore((s) => s.forecastEnabled);
  const setEnabled = useAppStore((s) => s.setForecastEnabled);
  const horizon = useAppStore((s) => s.forecastHorizon);
  const setHorizon = useAppStore((s) => s.setForecastHorizon);

  const cap = settings?.weekly_capacity_hours ?? 42.5;
  const t = settings?.util_thresholds;

  const model = useMemo(() => {
    if (!settings || !resources || !allocations || horizonWeeks.length === 0) return null;
    const todayWk = startOfWeek(todayISO(), settings.week_start_day);
    const upcoming = horizonWeeks.filter((w) => w >= todayWk);
    const weeks = upcoming.length ? upcoming : horizonWeeks;
    const end = addDays(todayWk, 6);
    const holidayDays = (holidays ?? []).filter((h) => h.date >= todayWk && h.date <= end).length;

    const heads = new Map<string, { headcount: number; onLeave: number; active: number }>();
    for (const r of resources) {
      if (!r.discipline_id) continue;
      const e = heads.get(r.discipline_id) ?? { headcount: 0, onLeave: 0, active: 0 };
      if (r.status === 'Active' || r.status === 'On Leave') e.headcount++;
      if (r.status === 'On Leave') e.onLeave++;
      if (r.status === 'Active') e.active++;
      heads.set(r.discipline_id, e);
    }

    const series = buildDemandCapacity(resources, allocations, weeks, (r) => r.discipline_id, (id) => ref.disciplineById.get(id)?.name ?? 'General');
    const rows = series.map((s) => {
      const h = heads.get(s.groupId) ?? { headcount: 0, onLeave: 0, active: 0 };
      const real = realCapacity({ headcount: h.headcount, onLeave: h.onLeave, holidayDays, capacity: cap }).realHours;
      const idx = Math.min(horizon, s.points.length - 1);
      const projected = s.points[idx]?.demandHours ?? 0;
      const gapH = projected - real;
      const hires = gapH > 0 ? Math.ceil(gapH / cap) : 0;
      const slackFte = gapH < 0 ? Math.round((-gapH / cap) * 10) / 10 : 0;
      return { id: s.groupId, name: s.groupName, active: h.active, real, projected, gapH, hires, slackFte };
    }).sort((a, b) => b.gapH - a.gapH);

    return { rows, horizonDate: weeks[Math.min(horizon, weeks.length - 1)] };
  }, [settings, resources, allocations, holidays, horizonWeeks, ref, horizon, cap]);

  if (!enabled) {
    return (
      <div className="card"><div className="card-body">
        <EmptyState icon="ti-chart-dots" title="Predictive Hiring Forecast"
          message="Beta. Projects demand forward and recommends hires where a shortage is likely. Estimates only — 'Required Capacity' is a new data input."
          action={<button className="btn btn-primary" onClick={() => setEnabled(true)}><i className="ti ti-sparkles" /> Enable forecast</button>} />
      </div></div>
    );
  }
  if (!model) return null;

  const shortages = model.rows.filter((r) => r.hires > 0);

  return (
    <div className="card">
      <div className="card-header">
        <div className="row" style={{ gap: 8 }}>
          <div className="card-title">Predictive Hiring Forecast</div>
          <span className="badge badge-purple">BETA</span>
        </div>
        <div className="view-toggle">
          {HORIZONS.map((h) => (
            <button key={h} className={`view-toggle-btn${horizon === h ? ' active' : ''}`} onClick={() => setHorizon(h)}>{h} wks</button>
          ))}
        </div>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shortages.length === 0 ? (
          <div className="alert alert-success"><i className="ti ti-circle-check" /><div>All disciplines are within capacity for the next {horizon} weeks.</div></div>
        ) : (
          shortages.map((r) => (
            <div key={r.id} className="alert alert-danger" style={{ alignItems: 'center' }}>
              <i className="ti ti-alert-circle" />
              <div style={{ flex: 1 }}>
                <strong>Hire {r.hires} {r.name} Engineer{r.hires > 1 ? 's' : ''}</strong>
                <div style={{ fontSize: 'var(--text-xs)' }}>Projected demand exceeds real capacity by ~{fmtHours(r.gapH)}/wk in {horizon} weeks (heuristic).</div>
              </div>
            </div>
          ))
        )}

        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Department</th><th style={{ textAlign: 'right' }}>Current real cap.</th><th style={{ textAlign: 'right' }}>Demand in {horizon} wks</th><th style={{ textAlign: 'right' }}>Recommendation</th></tr></thead>
            <tbody>
              {model.rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.name} <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>· {r.active} active</span></td>
                  <td style={{ textAlign: 'right' }}>{fmtHours(r.real)}</td>
                  <td className={utilTextClass(r.real > 0 ? (r.projected / r.real) * 100 : 0, t)} style={{ textAlign: 'right', fontWeight: 600 }}>{fmtHours(r.projected)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {r.hires > 0
                      ? <span className="badge badge-red">+{r.hires} hire{r.hires > 1 ? 's' : ''}</span>
                      : r.slackFte > 0
                        ? <span className="badge badge-green">{r.slackFte} FTE slack</span>
                        : <span className="badge badge-gray">Balanced</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-footer muted" style={{ fontSize: 'var(--text-xs)' }}>
        <i className="ti ti-info-circle" /> Heuristic estimate — projects current bookings forward. "Required Capacity" is a new data input; treat recommendations as guidance.
      </div>
    </div>
  );
}
