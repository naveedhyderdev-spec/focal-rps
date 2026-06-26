import { useMemo, useState } from 'react';
import {
  realCapacity, groupWeeksByPeriod, monthKey, monthLabel, addMonths, addDays, todayISO,
  type Resource, type Allocation, type Discipline,
} from '@engine';
import { PageHeader } from '../components/ui/PageHeader';
import { Loading } from '../components/ui/Loading';
import { Select } from '../components/ui/Field';
import { DataTable, type Column } from '../components/ui/DataTable';
import { DisciplineTag } from '../components/ui/DisciplineTag';
import { CapacityPlanChart, type CapacityPoint } from '../components/charts/CapacityPlanChart';
import { resourcesH, useAllocations, useSettings, holidaysH, useSaveSettings } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useHorizonWeeks } from '../hooks/useDerived';
import { useAppStore } from '../store/appStore';
import { can } from '../lib/permissions';
import { fmtHours, fmtPercent } from '../lib/format';
import { downloadWorkbook, stampedName, type Cell } from '../lib/excel';

type Period = 'week' | 'month' | 'quarter';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Weekly' }, { key: 'month', label: 'Monthly' }, { key: 'quarter', label: 'Quarterly' },
];

interface DeptRow {
  discipline: Discipline;
  availRes: number;
  requiredRes: number;
  availH: number;
  requiredH: number;
  gapH: number;
  gapFte: number;
}

export function Capacity() {
  const { data: settings } = useSettings();
  const { data: resources } = resourcesH.useList();
  const { data: allocations } = useAllocations();
  const { data: holidays } = holidaysH.useList();
  const ref = useReference();
  const horizonWeeks = useHorizonWeeks();
  const saveSettings = useSaveSettings();
  const role = useAppStore((s) => s.role);
  const toast = useAppStore((s) => s.toast);
  const canEdit = can(role, 'edit_projects');
  const canExport = can(role, 'export');

  const [period, setPeriod] = useState<Period>('month');
  const [fDisc, setFDisc] = useState('');
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');

  const cap = settings?.weekly_capacity_hours ?? 42.5;
  const targets = settings?.capacity_targets ?? {};

  const monthOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const w of horizonWeeks) if (!seen.has(monthKey(w))) seen.set(monthKey(w), monthLabel(w));
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [horizonWeeks]);

  const defFrom = monthKey(todayISO());
  const defTo = monthKey(addMonths(todayISO(), 6));
  const fromK = fromMonth || defFrom;
  const toK = toMonth || defTo;

  const weeks = useMemo(
    () => horizonWeeks.filter((w) => monthKey(w) >= fromK && monthKey(w) <= toK),
    [horizonWeeks, fromK, toK],
  );

  // Departments = disciplines (data-driven, not hard-coded).
  const depts = ref.disciplines;
  const selectedDepts = useMemo(() => (fDisc ? depts.filter((d) => d.id === fDisc) : depts), [depts, fDisc]);
  const deptIds = useMemo(() => new Set(selectedDepts.map((d) => d.id)), [selectedDepts]);

  const holidayDates = useMemo(() => (holidays ?? []).map((h) => h.date), [holidays]);
  const holidayDaysIn = (w: string) => {
    const end = addDays(w, 6);
    return holidayDates.filter((d) => d >= w && d <= end).length;
  };

  const model = useMemo(() => {
    if (!resources || !allocations || weeks.length === 0) return null;
    const inScope = (r: Resource) => r.discipline_id && deptIds.has(r.discipline_id);
    const scoped = resources.filter(inScope);
    const headcount = scoped.filter((r) => r.status === 'Active' || r.status === 'On Leave').length;
    const onLeave = scoped.filter((r) => r.status === 'On Leave').length;
    const requiredFteTotal = selectedDepts.reduce((s, d) => s + (targets[d.id] ?? 0), 0);
    const requiredH = requiredFteTotal * cap;

    const byWeek = new Map<string, number>(); // allocated hours per week
    for (const a of allocations as Allocation[]) {
      const r = resources.find((x) => x.id === a.resource_id);
      if (!r || !inScope(r) || !weeks.includes(a.week_start_date)) continue;
      byWeek.set(a.week_start_date, (byWeek.get(a.week_start_date) ?? 0) + a.allocation_factor * cap);
    }

    const perWeek = weeks.map((w) => {
      const available = realCapacity({ headcount, onLeave, holidayDays: holidayDaysIn(w), capacity: cap }).realHours;
      const allocated = byWeek.get(w) ?? 0;
      return { w, available, allocated, required: requiredH, gap: available - requiredH };
    });

    // Bucket by period; bucket value = mean of its weeks (keeps an hours/week scale).
    const groups = groupWeeksByPeriod(weeks, period);
    const idx = new Map(perWeek.map((p) => [p.w, p]));
    const points: CapacityPoint[] = groups.map((g) => {
      const ws = g.weeks.map((w) => idx.get(w)!).filter(Boolean);
      const mean = (sel: (p: typeof perWeek[number]) => number) => ws.reduce((s, p) => s + sel(p), 0) / (ws.length || 1);
      const available = mean((p) => p.available), allocated = mean((p) => p.allocated), required = mean((p) => p.required);
      return { label: g.label, available, allocated, required, gap: available - required };
    });

    const mean = (sel: (p: typeof perWeek[number]) => number) => perWeek.reduce((s, p) => s + sel(p), 0) / perWeek.length;
    const avgAvailable = mean((p) => p.available), avgAllocated = mean((p) => p.allocated);
    const netGap = avgAvailable - requiredH;

    // Per-department rows
    const deptRows: DeptRow[] = depts.map((d) => {
      const members = resources.filter((r) => r.discipline_id === d.id);
      const hc = members.filter((r) => r.status === 'Active' || r.status === 'On Leave').length;
      const ol = members.filter((r) => r.status === 'On Leave').length;
      const availH = weeks.reduce((s, w) => s + realCapacity({ headcount: hc, onLeave: ol, holidayDays: holidayDaysIn(w), capacity: cap }).realHours, 0) / weeks.length;
      const requiredRes = targets[d.id] ?? 0;
      const requiredHrs = requiredRes * cap;
      return {
        discipline: d,
        availRes: members.filter((r) => r.status === 'Active').length,
        requiredRes,
        availH,
        requiredH: requiredHrs,
        gapH: availH - requiredHrs,
        gapFte: (availH - requiredHrs) / cap,
      };
    });

    return { points, avgAvailable, avgAllocated, requiredH, netGap, netFte: netGap / cap, deptRows, requiredFteTotal };
  }, [resources, allocations, weeks, period, deptIds, selectedDepts, targets, cap, holidayDates]);

  const saveTarget = async (discId: string, fte: number) => {
    try {
      await saveSettings.mutateAsync({ capacity_targets: { ...targets, [discId]: Math.max(0, fte) } });
    } catch (e) { toast((e as Error).message, 'danger'); }
  };

  const exportXlsx = () => {
    if (!model) return;
    const aoa: Cell[][] = [['Department', 'Available Res.', 'Required Res.', 'Available h', 'Required h', 'Gap h', 'Gap FTE']];
    for (const r of model.deptRows) aoa.push([r.discipline.name, r.availRes, r.requiredRes, Math.round(r.availH), Math.round(r.requiredH), Math.round(r.gapH), Math.round(r.gapFte * 10) / 10]);
    downloadWorkbook(stampedName('FOCAL_Capacity_Plan'), [{ name: 'Capacity', aoa }]);
    toast('Exported capacity plan', 'success');
  };

  if (!settings || !model) return <div className="page-container"><Loading /></div>;

  const gapTone = model.netGap < 0 ? 'danger' : 'success';

  const columns: Column<DeptRow>[] = [
    { key: 'dept', header: 'Department', sortValue: (r) => r.discipline.name, render: (r) => <DisciplineTag discipline={r.discipline} /> },
    { key: 'availRes', header: 'Available', align: 'right', sortValue: (r) => r.availRes, render: (r) => r.availRes },
    {
      key: 'reqRes', header: 'Required', align: 'right', sortValue: (r) => r.requiredRes,
      render: (r) => canEdit
        ? <input type="number" min="0" step="1" className="form-control" style={{ width: 64, height: 28, textAlign: 'right', display: 'inline-block' }}
            defaultValue={r.requiredRes} onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== r.requiredRes) saveTarget(r.discipline.id, v); }} />
        : (r.requiredRes || '—'),
    },
    { key: 'availH', header: 'Avail h', align: 'right', sortValue: (r) => r.availH, render: (r) => fmtHours(r.availH) },
    { key: 'reqH', header: 'Req h', align: 'right', sortValue: (r) => r.requiredH, render: (r) => (r.requiredH ? fmtHours(r.requiredH) : '—') },
    {
      key: 'gapH', header: 'Gap (h)', align: 'right', sortValue: (r) => r.gapH,
      render: (r) => <span className={r.gapH < 0 ? 'util-over' : 'util-full'} style={{ fontWeight: 600 }}>{r.gapH >= 0 ? '+' : ''}{Math.round(r.gapH)}h</span>,
    },
    {
      key: 'gapFte', header: 'Gap (FTE)', align: 'right', sortValue: (r) => r.gapFte,
      render: (r) => <span className={r.gapFte < 0 ? 'util-over' : 'muted'} style={{ fontWeight: r.gapFte < 0 ? 600 : 400 }}>{r.gapFte >= 0 ? '+' : ''}{(Math.round(r.gapFte * 10) / 10).toFixed(1)}</span>,
    },
  ];

  return (
    <div className="page-container" style={{ maxWidth: 'none' }}>
      <PageHeader title="Capacity Planning" subtitle="Hiring decisions · supply vs demand across disciplines">
        {canExport && <button className="btn" onClick={exportXlsx}><i className="ti ti-file-spreadsheet" /> Export</button>}
      </PageHeader>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="filter-bar">
          <div className="view-toggle">
            {PERIODS.map((p) => (
              <button key={p.key} className={`view-toggle-btn${period === p.key ? ' active' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</button>
            ))}
          </div>
          <div className="topbar-divider" style={{ height: 24 }} />
          <Select value={fDisc} onChange={setFDisc} placeholder="All disciplines" options={depts.map((d) => ({ value: d.id, label: d.name }))} />
          <div className="filter-spacer" />
          <label className="muted" style={{ fontSize: 'var(--text-xs)' }}>From</label>
          <Select value={fromK} onChange={setFromMonth} options={monthOptions} />
          <label className="muted" style={{ fontSize: 'var(--text-xs)' }}>To</label>
          <Select value={toK} onChange={setToMonth} options={monthOptions} />
        </div>
      </div>

      {/* 4 metric cards */}
      <div className="metric-grid metric-grid-4" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-users" /> Available capacity</div>
          <div className="metric-value">{fmtHours(model.avgAvailable)}</div>
          <div className="metric-sub">real, avg / week (leave & holidays applied)</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-layout-kanban" /> Allocated</div>
          <div className="metric-value">{fmtHours(model.avgAllocated)}</div>
          <div className="metric-sub">{model.avgAvailable > 0 ? fmtPercent((model.avgAllocated / model.avgAvailable) * 100) : '—'} of available</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-target" /> Required</div>
          <div className="metric-value">{model.requiredH ? fmtHours(model.requiredH) : '—'}</div>
          <div className="metric-sub">{model.requiredFteTotal || 0} FTE target</div>
        </div>
        <div className={`metric-card ${gapTone}`}>
          <div className="metric-label"><i className="ti ti-scale" /> Net gap</div>
          <div className="metric-value">{model.netGap >= 0 ? '+' : ''}{fmtHours(model.netGap)}</div>
          <div className="metric-sub">{model.netFte >= 0 ? `≈ +${(Math.round(model.netFte * 10) / 10).toFixed(1)} FTE surplus` : `≈ ${(Math.round(model.netFte * 10) / 10).toFixed(1)} hires needed`}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="card-header"><div className="card-title">Supply vs Demand</div></div>
        <div className="card-body"><CapacityPlanChart points={model.points} /></div>
      </div>

      {model.requiredFteTotal === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)' }}>
          <i className="ti ti-alert-triangle" />
          <div>"Required Capacity" isn't modelled yet — {canEdit ? 'enter a target FTE per department below to see the gap.' : 'an Admin can set per-department targets below.'}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">By Department</div>
          <span className="badge badge-gray">Manual targets</span>
        </div>
        <DataTable columns={columns} rows={model.deptRows} getRowKey={(r) => r.discipline.id} initialSort={{ key: 'gapH', dir: 'asc' }} />
      </div>
    </div>
  );
}
