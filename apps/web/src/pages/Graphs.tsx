import { useMemo, useState } from 'react';
import {
  buildDemandCapacity, weekLabelMap, startOfWeek, todayISO, addDays, realCapacity,
  type GroupSeries,
} from '@engine';
import { PageHeader } from '../components/ui/PageHeader';
import { Loading } from '../components/ui/Loading';
import { Select } from '../components/ui/Field';
import { DemandLine } from '../components/charts/DemandLine';
import { TrendMini } from '../components/charts/TrendMini';
import { RealCapacityIndicator } from '../components/capacity/RealCapacity';
import { ForecastCard } from '../components/forecast/ForecastCard';
import { resourcesH, useAllocations, useSettings, holidaysH } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useHorizonWeeks } from '../hooks/useDerived';
import { utilTextClass } from '../lib/format';

type Tab = 'team' | 'discipline' | 'utilization' | 'forecast';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'team', label: 'Team Loading', icon: 'ti-users-group' },
  { key: 'discipline', label: 'Discipline Loading', icon: 'ti-stack-2' },
  { key: 'utilization', label: 'Team Utilization', icon: 'ti-activity' },
  { key: 'forecast', label: 'Hiring Forecast', icon: 'ti-chart-dots' },
];
const WINDOWS = [
  { value: '12', label: 'Next 12 weeks' },
  { value: '26', label: 'Next 26 weeks' },
  { value: '52', label: 'Next 52 weeks' },
  { value: 'all', label: 'Full horizon' },
];

export function Graphs() {
  const { data: settings } = useSettings();
  const { data: resources } = resourcesH.useList();
  const { data: allocations } = useAllocations();
  const { data: holidays } = holidaysH.useList();
  const ref = useReference();
  const horizonWeeks = useHorizonWeeks();

  const [tab, setTab] = useState<Tab>('team');
  const [windowN, setWindowN] = useState('26');

  const weeks = useMemo(() => {
    if (!settings || horizonWeeks.length === 0) return [];
    const from = startOfWeek(todayISO(), settings.week_start_day);
    const upcoming = horizonWeeks.filter((w) => w >= from);
    const base = upcoming.length ? upcoming : horizonWeeks;
    return windowN === 'all' ? base : base.slice(0, Number(windowN));
  }, [settings, horizonWeeks, windowN]);

  const labels = useMemo(() => {
    const m = weekLabelMap(weeks);
    return weeks.map((w) => m.get(w) ?? w);
  }, [weeks]);

  const groupBy = tab === 'team' ? 'team' : 'discipline';
  const series: GroupSeries[] = useMemo(() => {
    if (!resources || !allocations || weeks.length === 0) return [];
    if (groupBy === 'team') {
      return buildDemandCapacity(resources, allocations, weeks, (r) => r.team_id, (id) => ref.teamById.get(id)?.name ?? 'Unassigned');
    }
    return buildDemandCapacity(resources, allocations, weeks, (r) => r.discipline_id, (id) => ref.disciplineById.get(id)?.name ?? 'General');
  }, [resources, allocations, weeks, groupBy, ref]);

  // Per-discipline headcount for the Real Capacity indicator (current week).
  const cap = settings?.weekly_capacity_hours ?? 42.5;
  const todayWk = settings ? startOfWeek(todayISO(), settings.week_start_day) : todayISO();
  const holidayDaysNow = useMemo(() => {
    const end = addDays(todayWk, 6);
    return (holidays ?? []).filter((h) => h.date >= todayWk && h.date <= end).length;
  }, [holidays, todayWk]);
  const deptHeads = useMemo(() => {
    const m = new Map<string, { headcount: number; onLeave: number }>();
    for (const r of resources ?? []) {
      if (!r.discipline_id) continue;
      const e = m.get(r.discipline_id) ?? { headcount: 0, onLeave: 0 };
      if (r.status === 'Active' || r.status === 'On Leave') e.headcount++;
      if (r.status === 'On Leave') e.onLeave++;
      m.set(r.discipline_id, e);
    }
    return m;
  }, [resources]);

  if (!settings || !resources) return <div className="page-container"><Loading /></div>;
  const t = settings.util_thresholds;

  return (
    <div className="page-container">
      <PageHeader title="Insights" subtitle="Demand, utilization & capacity across the business">
        {tab !== 'forecast' && <Select value={windowN} onChange={setWindowN} options={WINDOWS} />}
      </PageHeader>

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="tabs" style={{ overflowX: 'auto' }}>
          {TABS.map((x) => (
            <button key={x.key} className={`tab-btn${tab === x.key ? ' active' : ''}`} onClick={() => setTab(x.key)}>
              <i className={`ti ${x.icon}`} /> {x.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'forecast' ? (
        <ForecastCard />
      ) : tab === 'utilization' ? (
        series.length === 0 ? (
          <div className="card"><div className="card-body"><span className="muted">No data to chart for this window.</span></div></div>
        ) : (
          <div className="dashboard-grid-2">
            {series.map((s) => {
              const utils = s.points.map((p) => (p.capacityHours > 0 ? (p.demandHours / p.capacityHours) * 100 : null));
              const present = utils.filter((u): u is number => u != null);
              const avg = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0;
              const peak = present.length ? Math.max(...present) : 0;
              const current = utils[0] ?? 0;
              const heads = deptHeads.get(s.groupId);
              const breakdown = realCapacity({ headcount: heads?.headcount ?? 0, onLeave: heads?.onLeave ?? 0, holidayDays: holidayDaysNow, capacity: cap });
              return (
                <div key={s.groupId} className="card">
                  <div className="card-header">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="card-title">{s.groupName}</span>
                      {peak > t.slightOverMax
                        ? <span className="badge badge-red badge-dot">{Math.round(peak)}% OVER</span>
                        : peak > t.fullMax
                          ? <span className="badge badge-amber badge-dot">{Math.round(peak)}%</span>
                          : null}
                    </div>
                    <div className="row" style={{ gap: 12 }}>
                      <span className={utilTextClass(current ?? 0, t)} style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{Math.round(current ?? 0)}%</span>
                      <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>avg {Math.round(avg)}% · peak {Math.round(peak)}%</span>
                      <RealCapacityIndicator breakdown={breakdown} onLeave={heads?.onLeave ?? 0} holidayDays={holidayDaysNow} />
                    </div>
                  </div>
                  <div className="card-body">
                    <TrendMini labels={labels} values={utils} peak={peak} fullMax={t.fullMax} slightOverMax={t.slightOverMax} height={190} />
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // team / discipline loading (demand vs capacity)
        series.length === 0 ? (
          <div className="card"><div className="card-body"><span className="muted">No data to chart for this window.</span></div></div>
        ) : (
          <div className="dashboard-grid-2">
            {series.map((s) => {
              const totalDemand = s.points.reduce((a, p) => a + p.demandHours, 0);
              const totalCap = s.points.reduce((a, p) => a + p.capacityHours, 0);
              const avgUtil = totalCap > 0 ? (totalDemand / totalCap) * 100 : 0;
              const peakUtil = Math.max(0, ...s.points.map((p) => (p.capacityHours > 0 ? (p.demandHours / p.capacityHours) * 100 : 0)));
              const members = s.points[0] ? Math.round(s.points[0].capacityHours / cap) : 0;
              return (
                <div key={s.groupId} className="card">
                  <div className="card-header">
                    <div className="card-title">{s.groupName}</div>
                    <div className="row" style={{ gap: 12 }}>
                      <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{members} active</span>
                      <span className={utilTextClass(avgUtil, t)} style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{Math.round(avgUtil)}% avg</span>
                      <span className={utilTextClass(peakUtil, t)} style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{Math.round(peakUtil)}% peak</span>
                    </div>
                  </div>
                  <div className="card-body">
                    <DemandLine labels={labels} demand={s.points.map((p) => Math.round(p.demandHours))} capacity={s.points.map((p) => Math.round(p.capacityHours))} height={200} />
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
