import { useMemo, useState } from 'react';
import {
  buildDemandCapacity, weekLabelMap, startOfWeek, todayISO,
  type GroupSeries,
} from '@engine';
import { PageHeader } from '../components/ui/PageHeader';
import { Loading } from '../components/ui/Loading';
import { Select } from '../components/ui/Field';
import { DemandLine } from '../components/charts/DemandLine';
import { resourcesH, useAllocations, useSettings } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useHorizonWeeks } from '../hooks/useDerived';
import { utilTextClass } from '../lib/format';

type Tab = 'team' | 'discipline';
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

  const series: GroupSeries[] = useMemo(() => {
    if (!resources || !allocations || weeks.length === 0) return [];
    if (tab === 'team') {
      return buildDemandCapacity(resources, allocations, weeks, (r) => r.team_id, (id) => ref.teamById.get(id)?.name ?? 'Unassigned');
    }
    return buildDemandCapacity(resources, allocations, weeks, (r) => r.discipline_id, (id) => ref.disciplineById.get(id)?.name ?? 'General');
  }, [resources, allocations, weeks, tab, ref]);

  if (!settings || !resources) return <div className="page-container"><Loading /></div>;

  return (
    <div className="page-container">
      <PageHeader title="Insights" subtitle="Demand vs capacity — where the load sits across the business">
        <Select value={windowN} onChange={setWindowN} options={WINDOWS} />
      </PageHeader>

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="tabs">
          <button className={`tab-btn${tab === 'team' ? ' active' : ''}`} onClick={() => setTab('team')}>
            <i className="ti ti-users-group" /> Team Loading
          </button>
          <button className={`tab-btn${tab === 'discipline' ? ' active' : ''}`} onClick={() => setTab('discipline')}>
            <i className="ti ti-stack-2" /> Discipline Loading
          </button>
        </div>
        <div className="card-body" style={{ paddingTop: 'var(--space-4)' }}>
          <p className="muted" style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
            <i className="ti ti-info-circle" /> Each panel plots weekly <strong>demand</strong> (Σ allocation × {settings.weekly_capacity_hours}h)
            against the group's <strong>capacity</strong> (active members × {settings.weekly_capacity_hours}h, shown as the dashed line). Where demand rises above the dashed line, the group is over capacity.
          </p>
        </div>
      </div>

      {series.length === 0 ? (
        <div className="card"><div className="card-body"><span className="muted">No data to chart for this window.</span></div></div>
      ) : (
        <div className="dashboard-grid-2">
          {series.map((s) => {
            const totalDemand = s.points.reduce((a, p) => a + p.demandHours, 0);
            const totalCap = s.points.reduce((a, p) => a + p.capacityHours, 0);
            const avgUtil = totalCap > 0 ? (totalDemand / totalCap) * 100 : 0;
            const peakUtil = Math.max(0, ...s.points.map((p) => (p.capacityHours > 0 ? (p.demandHours / p.capacityHours) * 100 : 0)));
            const members = s.points[0] ? Math.round(s.points[0].capacityHours / settings.weekly_capacity_hours) : 0;
            return (
              <div key={s.groupId} className="card">
                <div className="card-header">
                  <div className="card-title">{s.groupName}</div>
                  <div className="row" style={{ gap: 12 }}>
                    <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{members} active</span>
                    <span className={utilTextClass(avgUtil, settings.util_thresholds)} style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{Math.round(avgUtil)}% avg</span>
                    <span className={utilTextClass(peakUtil, settings.util_thresholds)} style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{Math.round(peakUtil)}% peak</span>
                  </div>
                </div>
                <div className="card-body">
                  <DemandLine
                    labels={labels}
                    demand={s.points.map((p) => Math.round(p.demandHours))}
                    capacity={s.points.map((p) => Math.round(p.capacityHours))}
                    height={200}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
