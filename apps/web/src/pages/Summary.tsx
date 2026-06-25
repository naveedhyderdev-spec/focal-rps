import { useMemo, useState } from 'react';
import {
  factorsByResourceWeek, factorToPercent, classifyBand, groupWeeksByMonth,
  monthKey, monthLabel, addMonths, startOfWeek, todayISO,
} from '@engine';
import { PageHeader } from '../components/ui/PageHeader';
import { Loading } from '../components/ui/Loading';
import { Select } from '../components/ui/Field';
import { resourcesH, useAllocations, useSettings } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useHorizonWeeks } from '../hooks/useDerived';
import { downloadWorkbook, stampedName, type Cell } from '../lib/excel';
import { useAppStore } from '../store/appStore';
import { can } from '../lib/permissions';

const W = 42; // week column width
const LEFT_COLS = [
  { key: 'name', label: 'Resource', w: 150 },
  { key: 'team', label: 'Team', w: 72 },
  { key: 'disc', label: 'Discipline', w: 92 },
  { key: 'grade', label: 'Grade', w: 108 },
  { key: 'loc', label: 'Loc', w: 50 },
  { key: 'avg', label: 'Avg', w: 54 },
];
const LEFT_W = LEFT_COLS.reduce((s, c) => s + c.w, 0);

export function Summary() {
  const { data: resources } = resourcesH.useList();
  const { data: allocations } = useAllocations();
  const { data: settings } = useSettings();
  const ref = useReference();
  const horizonWeeks = useHorizonWeeks();
  const role = useAppStore((s) => s.role);
  const toast = useAppStore((s) => s.toast);
  const canExport = can(role, 'export');

  const [fTeam, setFTeam] = useState('');
  const [fDisc, setFDisc] = useState('');
  const [fGrade, setFGrade] = useState('');
  const [fLoc, setFLoc] = useState('');
  const [search, setSearch] = useState('');
  const [selMonths, setSelMonths] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);

  const thresholds = settings?.util_thresholds;

  // Month options across the horizon
  const monthOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const w of horizonWeeks) if (!seen.has(monthKey(w))) seen.set(monthKey(w), monthLabel(w));
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [horizonWeeks]);

  // Default selection (until the user touches the filter): 6 months from a month before today.
  const defaultMonths = useMemo(() => {
    const keys = new Set<string>();
    if (!settings || horizonWeeks.length === 0) return keys;
    const start = startOfWeek(addMonths(todayISO(), -1), settings.week_start_day);
    const end = addMonths(todayISO(), 5);
    for (const w of horizonWeeks) if (w >= start && w <= end) keys.add(monthKey(w));
    return keys;
  }, [settings, horizonWeeks]);

  const effectiveMonths = touched ? selMonths : defaultMonths;

  // Visible weeks = weeks in selected months (empty selection → all)
  const visibleWeeks = useMemo(() => {
    if (effectiveMonths.size === 0) return horizonWeeks;
    return horizonWeeks.filter((w) => effectiveMonths.has(monthKey(w)));
  }, [horizonWeeks, effectiveMonths]);

  const monthGroups = useMemo(() => groupWeeksByMonth(visibleWeeks), [visibleWeeks]);

  const factors = useMemo(() => factorsByResourceWeek(allocations ?? []), [allocations]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (resources ?? [])
      .filter((r) => (!fTeam || r.team_id === fTeam) && (!fDisc || r.discipline_id === fDisc) && (!fGrade || r.grade_id === fGrade) && (!fLoc || r.location_id === fLoc))
      .filter((r) => !q || `${r.forename} ${r.full_name}`.toLowerCase().includes(q))
      .sort((a, b) => (a.full_name || a.forename).localeCompare(b.full_name || b.forename));
  }, [resources, fTeam, fDisc, fGrade, fLoc, search]);

  const utilOf = (resId: string, week: string) => factorToPercent(factors.get(resId)?.get(week) ?? 0);
  const avgOf = (resId: string) => {
    if (visibleWeeks.length === 0) return 0;
    let s = 0;
    for (const w of visibleWeeks) s += utilOf(resId, w);
    return s / visibleWeeks.length;
  };

  const toggleMonth = (k: string) => {
    const base = touched ? selMonths : defaultMonths;
    const n = new Set(base);
    n.has(k) ? n.delete(k) : n.add(k);
    setTouched(true);
    setSelMonths(n);
  };
  const selectAllMonths = () => { setTouched(true); setSelMonths(new Set(monthOptions.map((m) => m.key))); };
  const clearMonths = () => { setTouched(true); setSelMonths(new Set()); };

  const exportXlsx = () => {
    const header: Cell[] = ['Resource', 'Team', 'Discipline', 'Grade', 'Location', 'Avg %', ...visibleWeeks];
    const aoa: Cell[][] = [header];
    for (const r of rows) {
      aoa.push([
        r.full_name || r.forename,
        ref.teamById.get(r.team_id ?? '')?.name ?? '',
        ref.disciplineById.get(r.discipline_id ?? '')?.name ?? '',
        ref.gradeById.get(r.grade_id ?? '')?.name ?? '',
        ref.locationById.get(r.location_id ?? '')?.code ?? '',
        Math.round(avgOf(r.id)),
        ...visibleWeeks.map((w) => Math.round(utilOf(r.id, w))),
      ]);
    }
    downloadWorkbook(stampedName('FOCAL_Resource_Summary'), [{
      name: 'Resource Summary', aoa,
      colWidths: [26, 12, 14, 16, 6, 7, ...visibleWeeks.map(() => 6)],
    }]);
    toast('Exported Resource Summary', 'success');
  };

  if (!settings || !resources) return <div className="page-container"><Loading /></div>;

  return (
    <div className="page-container" style={{ maxWidth: 'none' }}>
      <PageHeader title="Resource Summary" subtitle={`Weekly utilization · ${rows.length} resources · ${visibleWeeks.length} weeks`}>
        {canExport && <button className="btn" onClick={exportXlsx}><i className="ti ti-file-spreadsheet" /> Export Excel</button>}
      </PageHeader>

      <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="filter-bar">
          <input type="text" className="form-control" placeholder="Find person…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 150 }} />
          <Select value={fTeam} onChange={setFTeam} placeholder="All teams" options={ref.teams.map((t) => ({ value: t.id, label: t.name }))} />
          <Select value={fDisc} onChange={setFDisc} placeholder="All disciplines" options={ref.disciplines.map((d) => ({ value: d.id, label: d.name }))} />
          <Select value={fGrade} onChange={setFGrade} placeholder="All grades" options={ref.grades.map((g) => ({ value: g.id, label: g.name }))} />
          <Select value={fLoc} onChange={setFLoc} placeholder="All locations" options={ref.locations.map((l) => ({ value: l.id, label: l.code }))} />
        </div>
        {/* Month multi-select chips */}
        <div className="filter-bar" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Months:</span>
          <button className="btn btn-sm btn-ghost" onClick={selectAllMonths}>All</button>
          <button className="btn btn-sm btn-ghost" onClick={clearMonths}>Clear</button>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {monthOptions.map((m) => (
              <button key={m.key} onClick={() => toggleMonth(m.key)}
                className={`badge ${effectiveMonths.has(m.key) ? 'badge-blue' : 'badge-gray'}`}
                style={{ cursor: 'pointer', border: 'none' }}>{m.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)', border: 'var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card-bg)' }}>
        <div style={{ width: LEFT_W + monthGroups.reduce((s, g) => s + g.weeks.length * W, 0), minWidth: '100%' }}>
          {/* Header: month band + week labels */}
          <div style={{ position: 'sticky', top: 0, zIndex: 4, display: 'flex', background: 'var(--gray-50)', borderBottom: 'var(--border)' }}>
            <div style={{ position: 'sticky', left: 0, zIndex: 5, width: LEFT_W, flexShrink: 0, background: 'var(--gray-50)', borderRight: 'var(--border)', display: 'flex', alignItems: 'flex-end' }}>
              {LEFT_COLS.map((c) => (
                <div key={c.key} style={{ width: c.w, padding: '0 8px 6px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{c.label}</div>
              ))}
            </div>
            <div>
              <div style={{ display: 'flex' }}>
                {monthGroups.map((g) => (
                  <div key={g.key} style={{ width: g.weeks.length * W, textAlign: 'center', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-700)', borderRight: '1px solid var(--gray-200)', padding: '4px 0' }}>{g.label}</div>
                ))}
              </div>
              <div style={{ display: 'flex' }}>
                {monthGroups.map((g) => g.weekLabels.map((wl, i) => (
                  <div key={g.weeks[i]} style={{ width: W, textAlign: 'center', fontSize: 9, color: 'var(--gray-500)', borderRight: '1px solid var(--gray-100)', padding: '2px 0' }}>{wl.replace(/^[A-Za-z]+ /, '')}</div>
                )))}
              </div>
            </div>
          </div>

          {/* Body */}
          {rows.map((r) => {
            const avg = avgOf(r.id);
            return (
              <div key={r.id} style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)' }}>
                <div style={{ position: 'sticky', left: 0, zIndex: 2, display: 'flex', flexShrink: 0, width: LEFT_W, background: 'var(--card-bg)', borderRight: 'var(--border)' }}>
                  <div style={{ width: LEFT_COLS[0].w, padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 'var(--text-sm)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.full_name}>{r.forename}</div>
                  <div style={{ width: LEFT_COLS[1].w, padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--gray-600)' }}>{ref.teamById.get(r.team_id ?? '')?.name ?? '—'}</div>
                  <div style={{ width: LEFT_COLS[2].w, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-xs)', color: 'var(--gray-600)' }}>
                    {r.discipline_id && <span style={{ width: 7, height: 7, borderRadius: '50%', background: ref.disciplineById.get(r.discipline_id)?.color, flexShrink: 0 }} />}
                    {ref.disciplineById.get(r.discipline_id ?? '')?.name ?? '—'}
                  </div>
                  <div style={{ width: LEFT_COLS[3].w, padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--gray-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ref.gradeById.get(r.grade_id ?? '')?.name ?? '—'}</div>
                  <div style={{ width: LEFT_COLS[4].w, padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 'var(--text-xs)', color: 'var(--gray-600)' }}>{ref.locationById.get(r.location_id ?? '')?.code ?? '—'}</div>
                  <div className={`util-${classifyBand(avg, thresholds)}`} style={{ width: LEFT_COLS[5].w, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 'var(--text-xs)', fontWeight: 700 }}>{Math.round(avg)}%</div>
                </div>
                {visibleWeeks.map((w) => {
                  const pct = utilOf(r.id, w);
                  const band = classifyBand(pct, thresholds);
                  return (
                    <div key={w} className={pct > 0 ? `util-cell-${band}` : ''} title={`${r.forename} · ${w} · ${Math.round(pct)}%`}
                      style={{ width: W, flexShrink: 0, height: 28, borderRight: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: pct > (settings.overalloc_threshold) ? 700 : 500 }}>
                      {pct > 0 ? Math.round(pct) : ''}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {rows.length === 0 && <div className="empty-state"><i className="ti ti-table" /><h3>No resources match the filters</h3></div>}
        </div>
      </div>
    </div>
  );
}
