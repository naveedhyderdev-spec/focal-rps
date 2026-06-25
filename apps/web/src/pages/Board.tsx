import { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  addMonths, addDays, startOfWeek, todayISO, generateWeeks,
  ALLOCATABLE_EXCLUDED_STATUSES, type Resource,
} from '@engine';
import { PageHeader } from '../components/ui/PageHeader';
import { Loading } from '../components/ui/Loading';
import { Select } from '../components/ui/Field';
import { BoardGrid } from '../components/board/BoardGrid';
import { BoardAllocationDialog, type BoardDialogState } from '../components/board/BoardAllocationDialog';
import { buildBoardModel, type ViewMode } from '../lib/board';
import { resourcesH, projectsH, useAllocations, useSettings, holidaysH } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useAppStore } from '../store/appStore';
import { can } from '../lib/permissions';
import { provider } from '../data';
import { qk } from '../lib/queryClient';

const VIEWS: { key: ViewMode; label: string; icon: string }[] = [
  { key: 'day', label: 'Day', icon: 'ti-calendar' },
  { key: 'week', label: 'Week', icon: 'ti-calendar-week' },
  { key: 'month', label: 'Month', icon: 'ti-calendar-month' },
  { key: 'quarter', label: 'Quarter', icon: 'ti-calendar-stats' },
];

function defaultWindow(view: ViewMode, focus: string): { from: string; to: string } {
  switch (view) {
    case 'day': return { from: addDays(focus, -10), to: addDays(focus, 38) };
    case 'week': return { from: addMonths(focus, -1), to: addMonths(focus, 5) };
    case 'month': return { from: addMonths(focus, -3), to: addMonths(focus, 15) };
    case 'quarter': return { from: addMonths(focus, -6), to: addMonths(focus, 24) };
  }
}

export function Board() {
  const { data: settings } = useSettings();
  const { data: resources } = resourcesH.useList();
  const { data: projects } = projectsH.useList();
  const { data: allocations } = useAllocations();
  const { data: holidays } = holidaysH.useList();
  const ref = useReference();
  const qc = useQueryClient();
  const role = useAppStore((s) => s.role);
  const toast = useAppStore((s) => s.toast);
  const canAllocate = can(role, 'edit_allocations');

  const [view, setView] = useState<ViewMode>('week');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fTeam, setFTeam] = useState('');
  const [fDisc, setFDisc] = useState('');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<BoardDialogState | null>(null);

  const weekStart = settings?.week_start_day ?? 6;

  // Initialise / reset window when the view changes.
  useEffect(() => {
    const focus = startOfWeek(todayISO(), weekStart);
    const w = defaultWindow(view, focus);
    setFrom(w.from);
    setTo(w.to);
  }, [view, weekStart]);

  const jumpToday = () => {
    const w = defaultWindow(view, startOfWeek(todayISO(), weekStart));
    setFrom(w.from); setTo(w.to);
  };

  const holidaySet = useMemo(() => new Set((holidays ?? []).map((h) => h.date)), [holidays]);

  const model = useMemo(() => {
    if (!from || !to) return null;
    return buildBoardModel(view, from, to, weekStart, holidaySet);
  }, [view, from, to, weekStart, holidaySet]);

  const filteredResources = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (resources ?? [])
      .filter((r) => !ALLOCATABLE_EXCLUDED_STATUSES.includes(r.status))
      .filter((r) => (!fTeam || r.team_id === fTeam) && (!fDisc || r.discipline_id === fDisc))
      .filter((r) => !q || `${r.forename} ${r.full_name}`.toLowerCase().includes(q));
  }, [resources, fTeam, fDisc, search]);

  const commitMoveResize = async (resource: Resource, projectId: string, factor: number, sWeek: string, eWeek: string) => {
    try {
      const weeks = generateWeeks(sWeek, eWeek, weekStart);
      await provider.allocations.removeForAssignment(resource.id, projectId);
      await provider.allocations.bulkUpsert(weeks.map((w) => ({
        resource_id: resource.id, project_id: projectId, stage_id: null,
        week_start_date: w, allocation_factor: factor, created_by: useAppStore.getState().currentUserId,
      })));
      await provider.activity.log({ user_id: useAppStore.getState().currentUserId, action: 'update', entity: 'allocation', entity_id: projectId, details: { resource: resource.id, moved: true, weeks: weeks.length } });
      await qc.invalidateQueries({ queryKey: qk.allocations });
      await qc.invalidateQueries({ queryKey: qk.activity });
      toast('Allocation updated', 'success');
    } catch (e) { toast((e as Error).message, 'danger'); }
  };

  if (!settings || !model) return <div className="page-container"><Loading /></div>;

  return (
    <div className="page-container full-bleed" style={{ padding: 'var(--space-5) var(--space-6)' }}>
      <PageHeader title="Allocation Board" subtitle="Resource loading across the timeline — grouped by Team → Discipline">
        <button className="btn btn-sm" onClick={jumpToday}><i className="ti ti-calendar-due" /> Today</button>
      </PageHeader>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="filter-bar">
          <div className="view-toggle">
            {VIEWS.map((v) => (
              <button key={v.key} className={`view-toggle-btn${view === v.key ? ' active' : ''}`} onClick={() => setView(v.key)}>
                <i className={`ti ${v.icon}`} /> {v.label}
              </button>
            ))}
          </div>
          <div className="topbar-divider" style={{ height: 24 }} />
          <label className="muted" style={{ fontSize: 'var(--text-xs)' }}>From</label>
          <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="muted" style={{ fontSize: 'var(--text-xs)' }}>To</label>
          <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="filter-spacer" />
          <input type="text" className="form-control" placeholder="Find person…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 150 }} />
          <Select value={fTeam} onChange={setFTeam} placeholder="All teams" options={ref.teams.map((t) => ({ value: t.id, label: t.name }))} />
          <Select value={fDisc} onChange={setFDisc} placeholder="All disciplines" options={ref.disciplines.map((d) => ({ value: d.id, label: d.name }))} />
        </div>
      </div>

      {/* Legend */}
      <div className="row" style={{ gap: 14, marginBottom: 10, flexWrap: 'wrap', fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
        {[['under', '0–79%'], ['moderate', '80–90%'], ['full', '91–100%'], ['slightOver', '101–110%'], ['over', '>110%']].map(([b, lbl]) => (
          <span key={b} className="row" style={{ gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: `var(--color-${b === 'under' ? 'info' : b === 'moderate' ? 'purple' : b === 'full' ? 'success' : b === 'slightOver' ? 'warning' : 'danger'}-bg)`, border: '1px solid var(--gray-200)' }} /> {lbl}
          </span>
        ))}
        <span className="row" style={{ gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--weekend-bg)', border: '1px solid var(--gray-200)' }} /> weekend</span>
        <span className="row" style={{ gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--holiday-bg)', border: '1px solid var(--gray-200)' }} /> holiday</span>
        {view === 'week' && canAllocate && <span className="muted"><i className="ti ti-info-circle" /> Expand a person to drag, resize or add allocation bars.</span>}
      </div>

      <BoardGrid
        model={model}
        viewMode={view}
        resources={filteredResources}
        allocations={allocations ?? []}
        projects={projects ?? []}
        settings={settings}
        onBarClick={(resource, projectId, sWeek, eWeek, percent) => { if (canAllocate) setDialog({ resource, lockedProjectId: projectId, start: sWeek, end: eWeek, percent }); }}
        onCreateDrag={(resource, sWeek, eWeek) => { if (canAllocate) setDialog({ resource, lockedProjectId: null, start: sWeek, end: eWeek, percent: 50 }); }}
        onCommitMoveResize={(resource, projectId, factor, sWeek, eWeek) => { if (canAllocate) void commitMoveResize(resource, projectId, factor, sWeek, eWeek); else toast('Your role cannot edit allocations', 'danger'); }}
      />

      <BoardAllocationDialog state={dialog} projects={projects ?? []} onClose={() => setDialog(null)} />
    </div>
  );
}
