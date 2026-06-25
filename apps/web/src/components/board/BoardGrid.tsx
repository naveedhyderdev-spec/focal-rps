import { useMemo, useRef, useState } from 'react';
import {
  factorsByResourceWeek, factorToPercent, classifyBand,
  type Resource, type Allocation, type Project, type AppSettings,
} from '@engine';
import { type BoardModel, columnUtilPercent, COL_WIDTH, type ViewMode } from '../../lib/board';
import { useReference } from '../../hooks/useReference';

const LEFT_W = 240;

interface BarSpan { projectId: string; sCol: number; eCol: number; factor: number; varies: boolean }

interface DragState {
  mode: 'move' | 'resize-l' | 'resize-r' | 'create';
  resId: string;
  projId?: string;
  factor?: number;
  startX: number;
  trackLeft: number;
  origS: number;
  origE: number;
  // live span, updated during the drag — read on pointerup (avoids stale-closure on React state)
  curS: number;
  curE: number;
}

export interface BoardGridProps {
  model: BoardModel;
  viewMode: ViewMode;
  resources: Resource[];
  allocations: Allocation[];
  projects: Project[];
  settings: AppSettings;
  onBarClick: (resource: Resource, projectId: string, sWeek: string, eWeek: string, percent: number) => void;
  onCreateDrag: (resource: Resource, sWeek: string, eWeek: string) => void;
  onCommitMoveResize: (resource: Resource, projectId: string, factor: number, sWeek: string, eWeek: string) => void;
}

export function BoardGrid(props: BoardGridProps) {
  const { model, viewMode, resources, allocations, projects, settings } = props;
  const ref = useReference();
  const interactive = viewMode === 'week';
  const colW = COL_WIDTH.week;
  const thresholds = settings.util_thresholds;
  const overThreshold = settings.overalloc_threshold;

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const factors = useMemo(() => factorsByResourceWeek(allocations), [allocations]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ghost, setGhost] = useState<{ resId: string; projId?: string; s: number; e: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Group resources by Team → Discipline
  const groups = useMemo(() => {
    const teamMap = new Map<string, Map<string, Resource[]>>();
    for (const r of resources) {
      const tId = r.team_id ?? '∅team';
      const dId = r.discipline_id ?? '∅disc';
      if (!teamMap.has(tId)) teamMap.set(tId, new Map());
      const dm = teamMap.get(tId)!;
      if (!dm.has(dId)) dm.set(dId, []);
      dm.get(dId)!.push(r);
    }
    return teamMap;
  }, [resources]);

  // Bars per resource (week view only; positions are week-column indices)
  const barsByResource = useMemo(() => {
    const m = new Map<string, BarSpan[]>();
    if (!interactive) return m;
    const g = new Map<string, Allocation[]>();
    for (const a of allocations) {
      if (model.weekToCol.get(a.week_start_date) === undefined) continue;
      const key = `${a.resource_id}|${a.project_id}`;
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(a);
    }
    for (const [key, arr] of g) {
      const [resId, projId] = key.split('|');
      let sCol = Infinity; let eCol = -Infinity; let min = Infinity; let max = -Infinity;
      for (const a of arr) {
        const c = model.weekToCol.get(a.week_start_date)!;
        if (c < sCol) sCol = c;
        if (c > eCol) eCol = c;
        if (a.allocation_factor < min) min = a.allocation_factor;
        if (a.allocation_factor > max) max = a.allocation_factor;
      }
      if (!m.has(resId)) m.set(resId, []);
      m.get(resId)!.push({ projectId: projId, sCol, eCol, factor: max, varies: min !== max });
    }
    return m;
  }, [allocations, model, interactive]);

  const totalColsW = model.columns.reduce((s, c) => s + c.widthPx, 0);
  const fullW = LEFT_W + totalColsW;

  const toggleGroup = (k: string) => setCollapsed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleResource = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Drag handling (week view) ──
  const clampSpan = (s: number, e: number) => {
    const len = e - s;
    let ns = s; let ne = e;
    if (ns < 0) { ns = 0; ne = len; }
    if (ne > model.weeks.length - 1) { ne = model.weeks.length - 1; ns = ne - len; }
    return [Math.max(0, ns), Math.min(model.weeks.length - 1, ne)] as const;
  };

  const onPointerMove = (ev: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = Math.round((ev.clientX - d.startX) / colW);
    let s = d.curS; let e = d.curE;
    if (d.mode === 'move') {
      [s, e] = clampSpan(d.origS + delta, d.origE + delta);
    } else if (d.mode === 'resize-l') {
      s = Math.min(Math.max(0, d.origS + delta), d.origE); e = d.origE;
    } else if (d.mode === 'resize-r') {
      s = d.origS; e = Math.max(Math.min(model.weeks.length - 1, d.origE + delta), d.origS);
    } else if (d.mode === 'create') {
      const startCol = Math.floor((d.startX - d.trackLeft) / colW);
      const curCol = Math.floor((ev.clientX - d.trackLeft) / colW);
      s = Math.max(0, Math.min(startCol, curCol));
      e = Math.min(model.weeks.length - 1, Math.max(startCol, curCol));
    }
    d.curS = s; d.curE = e;
    setGhost({ resId: d.resId, projId: d.projId, s, e });
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    dragRef.current = null;
    setGhost(null);
    if (!d) return;
    const resource = resources.find((r) => r.id === d.resId);
    if (!resource) return;
    const sWeek = model.weeks[d.curS];
    const eWeek = model.weeks[d.curE];
    if (!sWeek || !eWeek) return;
    if (d.mode === 'create') {
      props.onCreateDrag(resource, sWeek, eWeek);
    } else if (d.projId && (d.curS !== d.origS || d.curE !== d.origE)) {
      props.onCommitMoveResize(resource, d.projId, d.factor ?? 0.5, sWeek, eWeek);
    }
  };

  const startDrag = (e: React.PointerEvent, partial: Omit<DragState, 'startX' | 'trackLeft' | 'curS' | 'curE'>, trackEl?: HTMLElement) => {
    e.preventDefault();
    e.stopPropagation();
    const trackLeft = trackEl?.getBoundingClientRect().left ?? 0;
    dragRef.current = { ...partial, startX: e.clientX, trackLeft, curS: partial.origS, curE: partial.origE };
    if (partial.mode !== 'create') setGhost({ resId: partial.resId, projId: partial.projId, s: partial.origS, e: partial.origE });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // ── Cell rendering ──
  const renderHeatCells = (resId: string) => {
    const fm = factors.get(resId);
    return model.columns.map((col) => {
      const pct = columnUtilPercent(fm, col);
      const band = classifyBand(pct, thresholds);
      let bg: string | undefined;
      let color: string | undefined;
      if (col.isHoliday) bg = 'var(--holiday-bg)';
      else if (col.isWeekend) bg = 'var(--weekend-bg)';
      else if (pct > 0) { bg = `var(--color-${bandColor(band)}-bg)`; color = `var(--color-${bandColor(band)})`; }
      const showNum = viewMode !== 'day' && pct > 0;
      return (
        <div key={col.key} title={`${Math.round(pct)}%`} style={{
          width: col.widthPx, flexShrink: 0, height: 30, borderRight: '1px solid var(--gray-100)',
          background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--text-xs)', fontWeight: pct > overThreshold ? 700 : 500,
          outline: pct > overThreshold ? '1px solid var(--color-danger)' : undefined, outlineOffset: -1,
        }}>
          {showNum ? Math.round(pct) : ''}
        </div>
      );
    });
  };

  const avgUtil = (resId: string) => {
    const fm = factors.get(resId);
    if (!fm || model.columns.length === 0) return 0;
    let s = 0;
    for (const c of model.columns) s += columnUtilPercent(fm, c);
    return s / model.columns.length;
  };
  const peakOver = (resId: string) => {
    const fm = factors.get(resId);
    if (!fm) return false;
    return model.columns.some((c) => columnUtilPercent(fm, c) > overThreshold);
  };

  const stickyLeft: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 2, background: 'var(--card-bg)', width: LEFT_W, flexShrink: 0 };

  return (
    <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 210px)', border: 'var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card-bg)' }}>
      <div style={{ width: fullW, minWidth: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 5 }}>
          <div style={{ ...stickyLeft, zIndex: 6, height: 40, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: 'var(--border)', borderRight: 'var(--border)', fontWeight: 600, fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--gray-500)' }}>Resource</div>
          {model.columns.map((col) => (
            <div key={col.key} style={{
              width: col.widthPx, flexShrink: 0, height: 40, borderBottom: 'var(--border)', borderRight: '1px solid var(--gray-100)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: col.isToday ? 'var(--color-info-bg)' : col.isHoliday ? 'var(--holiday-bg)' : col.isWeekend ? 'var(--weekend-bg)' : 'var(--gray-50)',
              fontSize: 10, color: 'var(--gray-600)', fontWeight: col.isToday ? 700 : 500, lineHeight: 1.2,
            }}>
              <span>{col.label}</span>
              {col.sublabel && <span style={{ color: 'var(--gray-400)', fontSize: 9 }}>{col.sublabel}</span>}
            </div>
          ))}
        </div>

        {/* Groups */}
        {[...groups.entries()].map(([teamId, discMap]) => {
          const teamName = ref.teamById.get(teamId)?.name ?? 'Unassigned';
          const teamKey = `t:${teamId}`;
          const teamCollapsed = collapsed.has(teamKey);
          const teamCount = [...discMap.values()].reduce((s, a) => s + a.length, 0);
          return (
            <div key={teamId}>
              <div onClick={() => toggleGroup(teamKey)} style={{ display: 'flex', cursor: 'pointer', background: 'var(--gray-100)', borderBottom: 'var(--border)' }}>
                <div style={{ ...stickyLeft, background: 'var(--gray-100)', height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                  <i className={`ti ${teamCollapsed ? 'ti-chevron-right' : 'ti-chevron-down'}`} style={{ fontSize: 14 }} />
                  {teamName} <span className="muted" style={{ fontWeight: 400 }}>({teamCount})</span>
                </div>
                <div style={{ flex: 1 }} />
              </div>
              {!teamCollapsed && [...discMap.entries()].map(([discId, list]) => {
                const discName = ref.disciplineById.get(discId)?.name ?? 'General';
                const discColor = ref.disciplineById.get(discId)?.color ?? 'var(--gray-400)';
                const discKey = `d:${teamId}:${discId}`;
                const discCollapsed = collapsed.has(discKey);
                return (
                  <div key={discId}>
                    <div onClick={() => toggleGroup(discKey)} style={{ display: 'flex', cursor: 'pointer', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                      <div style={{ ...stickyLeft, background: 'var(--gray-50)', height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 0 28px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-600)' }}>
                        <i className={`ti ${discCollapsed ? 'ti-chevron-right' : 'ti-chevron-down'}`} style={{ fontSize: 12 }} />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: discColor }} />
                        {discName} <span className="muted" style={{ fontWeight: 400 }}>({list.length})</span>
                      </div>
                      <div style={{ flex: 1 }} />
                    </div>
                    {!discCollapsed && list.map((r) => {
                      const isExp = expanded.has(r.id);
                      const avg = avgUtil(r.id);
                      const over = peakOver(r.id);
                      const bars = barsByResource.get(r.id) ?? [];
                      return (
                        <div key={r.id}>
                          {/* Heatmap row */}
                          <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)', borderLeft: over ? '3px solid var(--color-danger)' : '3px solid transparent' }}>
                            <div style={{ ...stickyLeft, height: 30, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', borderRight: 'var(--border)' }}>
                              {interactive && (
                                <button className="btn btn-icon btn-sm btn-ghost" style={{ width: 20, height: 20 }} onClick={() => toggleResource(r.id)} title={isExp ? 'Collapse' : 'Show projects'}>
                                  <i className={`ti ${isExp ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ fontSize: 13 }} />
                                </button>
                              )}
                              <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.full_name}>{r.forename}</span>
                              {over && <i className="ti ti-alert-triangle" style={{ color: 'var(--color-danger)', fontSize: 13 }} />}
                              <span className={`util-${classifyBand(avg, thresholds)}`} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{Math.round(avg)}%</span>
                            </div>
                            {renderHeatCells(r.id)}
                          </div>

                          {/* Expanded project bar lanes (week view) */}
                          {interactive && isExp && (
                            <BarLanes
                              resource={r}
                              bars={bars}
                              ghost={ghost?.resId === r.id ? ghost : null}
                              colW={colW}
                              totalColsW={totalColsW}
                              leftW={LEFT_W}
                              weeks={model.weeks}
                              projectById={projectById}
                              onStartMove={(projId, factor, s, e, ev) => startDrag(ev, { mode: 'move', resId: r.id, projId, factor, origS: s, origE: e })}
                              onStartResizeL={(projId, factor, s, e, ev) => startDrag(ev, { mode: 'resize-l', resId: r.id, projId, factor, origS: s, origE: e })}
                              onStartResizeR={(projId, factor, s, e, ev) => startDrag(ev, { mode: 'resize-r', resId: r.id, projId, factor, origS: s, origE: e })}
                              onStartCreate={(ev, trackEl) => startDrag(ev, { mode: 'create', resId: r.id, origS: 0, origE: 0 }, trackEl)}
                              onBarClick={(b) => props.onBarClick(r, b.projectId, model.weeks[b.sCol], model.weeks[b.eCol], Math.round(factorToPercent(b.factor)))}
                              discColorOf={(projId) => {
                                const p = projectById.get(projId);
                                return p ? 'var(--brand-primary)' : 'var(--gray-400)';
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
        {resources.length === 0 && (
          <div className="empty-state"><i className="ti ti-layout-kanban" /><h3>No resources match the filters</h3></div>
        )}
      </div>
    </div>
  );
}

function bandColor(band: string): string {
  switch (band) {
    case 'under': return 'info';
    case 'moderate': return 'purple';
    case 'full': return 'success';
    case 'slightOver': return 'warning';
    default: return 'danger';
  }
}

// ── Bar lanes (one per project the resource is on) ──
function BarLanes({
  resource, bars, ghost, colW, totalColsW, leftW, weeks, projectById,
  onStartMove, onStartResizeL, onStartResizeR, onStartCreate, onBarClick, discColorOf,
}: {
  resource: Resource;
  bars: BarSpan[];
  ghost: { projId?: string; s: number; e: number } | null;
  colW: number;
  totalColsW: number;
  leftW: number;
  weeks: string[];
  projectById: Map<string, Project>;
  onStartMove: (projId: string, factor: number, s: number, e: number, ev: React.PointerEvent) => void;
  onStartResizeL: (projId: string, factor: number, s: number, e: number, ev: React.PointerEvent) => void;
  onStartResizeR: (projId: string, factor: number, s: number, e: number, ev: React.PointerEvent) => void;
  onStartCreate: (ev: React.PointerEvent, trackEl: HTMLElement) => void;
  onBarClick: (b: BarSpan) => void;
  discColorOf: (projId: string) => string;
}) {
  void resource; void weeks;
  const stickyLeft: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 2, background: 'var(--gray-50)', width: leftW, flexShrink: 0 };
  return (
    <div style={{ background: 'var(--gray-50)' }}>
      {bars.map((b) => {
        const isGhost = ghost?.projId === b.projectId;
        const s = isGhost ? ghost!.s : b.sCol;
        const e = isGhost ? ghost!.e : b.eCol;
        const p = projectById.get(b.projectId);
        return (
          <div key={b.projectId} style={{ display: 'flex', height: 26, borderBottom: '1px solid var(--gray-100)' }}>
            <div style={{ ...stickyLeft, display: 'flex', alignItems: 'center', padding: '0 10px 0 38px', fontSize: 'var(--text-xs)', color: 'var(--gray-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p?.code || p?.name || 'Project'}
            </div>
            <div style={{ position: 'relative', width: totalColsW, flexShrink: 0 }}>
              <div
                onPointerDown={(ev) => onStartMove(b.projectId, b.factor, b.sCol, b.eCol, ev)}
                onClick={() => onBarClick(b)}
                title={`${p?.code ?? ''} · ${Math.round(b.factor * 100)}%${b.varies ? ' (varies)' : ''}`}
                style={{
                  position: 'absolute', left: s * colW + 1, width: Math.max(colW - 2, (e - s + 1) * colW - 2), top: 4, height: 18,
                  background: discColorOf(b.projectId), opacity: isGhost ? 0.6 : 0.9, borderRadius: 3,
                  color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', padding: '0 6px', cursor: 'grab', userSelect: 'none',
                }}>
                <span onPointerDown={(ev) => { ev.stopPropagation(); onStartResizeL(b.projectId, b.factor, b.sCol, b.eCol, ev); }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{Math.round(b.factor * 100)}%</span>
                <span onPointerDown={(ev) => { ev.stopPropagation(); onStartResizeR(b.projectId, b.factor, b.sCol, b.eCol, ev); }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
              </div>
            </div>
          </div>
        );
      })}
      {/* Create lane */}
      <div style={{ display: 'flex', height: 24, borderBottom: '1px solid var(--gray-100)' }}>
        <div style={{ ...stickyLeft, display: 'flex', alignItems: 'center', padding: '0 10px 0 38px', fontSize: 10, color: 'var(--gray-400)' }}>
          <i className="ti ti-plus" style={{ fontSize: 12, marginRight: 4 }} /> drag to add
        </div>
        <div
          onPointerDown={(ev) => onStartCreate(ev, ev.currentTarget as HTMLElement)}
          style={{ position: 'relative', width: totalColsW, flexShrink: 0, cursor: 'crosshair' }}
        >
          {ghost && ghost.projId === undefined && (
            <div style={{ position: 'absolute', left: ghost.s * colW + 1, width: (ghost.e - ghost.s + 1) * colW - 2, top: 3, height: 18, background: 'var(--brand-accent)', opacity: 0.4, borderRadius: 3, border: '1px dashed var(--brand-primary)' }} />
          )}
        </div>
      </div>
    </div>
  );
}
