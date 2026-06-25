/**
 * Conflict / warning detection (spec §3.6). Powers the notification centre and
 * dashboard badges.
 *
 *  - Over-allocated resources: any week where util% > overalloc_threshold (110).
 *  - Upcoming resource gaps: Active resources below a bench threshold (50%).
 *  - Project resource conflicts: an active stage with zero allocated resources,
 *    or a resource allocated outside the project's stage date range.
 */

import type { Allocation, Project, ProjectStage, Resource } from './types.js';
import { factorToPercent } from './capacity.js';
import { factorsByResourceWeek } from './utilization.js';

export type WarningSeverity = 'danger' | 'warning' | 'info';

export interface Warning {
  type: 'over_allocated' | 'resource_gap' | 'project_conflict';
  severity: WarningSeverity;
  title: string;
  detail: string;
  entity: 'resource' | 'project';
  entityId: string;
  week?: string;
  value?: number;
}

export interface ConflictOptions {
  overallocThreshold?: number; // default 110
  benchThreshold?: number; // default 50
}

/** Resources whose total weekly util% exceeds the over-allocation threshold. */
export function detectOverAllocations(
  resources: Resource[],
  allocations: Allocation[],
  weeks: string[],
  opts: ConflictOptions = {},
): Warning[] {
  const threshold = opts.overallocThreshold ?? 110;
  const byResource = factorsByResourceWeek(allocations);
  const nameById = new Map(resources.map((r) => [r.id, r.full_name || r.forename]));
  const weekSet = new Set(weeks);
  const warnings: Warning[] = [];

  // One warning per resource, reporting its peak over-allocated week in-window.
  for (const [resourceId, weekMap] of byResource) {
    let peakWeek: string | null = null;
    let peakPct = 0;
    for (const [week, factor] of weekMap) {
      if (!weekSet.has(week)) continue;
      const pct = factorToPercent(factor);
      if (pct > threshold && pct > peakPct) {
        peakPct = pct;
        peakWeek = week;
      }
    }
    if (peakWeek) {
      warnings.push({
        type: 'over_allocated',
        severity: 'danger',
        title: `${nameById.get(resourceId) ?? 'Resource'} over-allocated`,
        detail: `${Math.round(peakPct)}% in week of ${peakWeek}`,
        entity: 'resource',
        entityId: resourceId,
        week: peakWeek,
        value: peakPct,
      });
    }
  }
  return warnings;
}

/** Active resources sitting below the bench threshold in the given weeks. */
export function detectResourceGaps(
  resources: Resource[],
  allocations: Allocation[],
  weeks: string[],
  opts: ConflictOptions = {},
): Warning[] {
  const bench = opts.benchThreshold ?? 50;
  const byResource = factorsByResourceWeek(allocations);
  const warnings: Warning[] = [];

  for (const r of resources) {
    if (r.status !== 'Active') continue;
    const weekMap = byResource.get(r.id) ?? new Map<string, number>();
    for (const week of weeks) {
      const pct = factorToPercent(weekMap.get(week) ?? 0);
      if (pct < bench) {
        warnings.push({
          type: 'resource_gap',
          severity: 'info',
          title: `${r.full_name || r.forename} has spare capacity`,
          detail: `${Math.round(pct)}% in week of ${week}`,
          entity: 'resource',
          entityId: r.id,
          week,
          value: pct,
        });
        break; // one gap warning per resource is enough for the centre
      }
    }
  }
  return warnings;
}

/**
 * Project conflicts: a stage active today with no allocated resources, or an
 * allocation falling outside every stage's date range for its project.
 */
export function detectProjectConflicts(
  projects: Project[],
  stages: ProjectStage[],
  allocations: Allocation[],
  todayISO: string,
): Warning[] {
  const warnings: Warning[] = [];
  const stagesByProject = new Map<string, ProjectStage[]>();
  for (const s of stages) {
    const arr = stagesByProject.get(s.project_id) ?? [];
    arr.push(s);
    stagesByProject.set(s.project_id, arr);
  }
  const allocByProject = new Map<string, Allocation[]>();
  for (const a of allocations) {
    const arr = allocByProject.get(a.project_id) ?? [];
    arr.push(a);
    allocByProject.set(a.project_id, arr);
  }

  for (const p of projects) {
    if (p.status === 'Archived') continue;
    const pStages = stagesByProject.get(p.id) ?? [];
    const pAllocs = allocByProject.get(p.id) ?? [];

    // 1) Stage active today with zero allocations in its range
    for (const s of pStages) {
      const activeNow = todayISO >= s.start_date && todayISO <= s.end_date;
      if (!activeNow) continue;
      const hasAlloc = pAllocs.some(
        (a) => a.week_start_date >= s.start_date && a.week_start_date <= s.end_date,
      );
      if (!hasAlloc) {
        warnings.push({
          type: 'project_conflict',
          severity: 'warning',
          title: `${p.code || p.name}: unstaffed stage`,
          detail: `Stage "${s.stage_name}" is active with no allocated resources`,
          entity: 'project',
          entityId: p.id,
        });
      }
    }

    // 2) Allocations outside all stage ranges — deduplicated to ONE warning per
    //    project (flagging per row would spam hundreds of identical entries).
    if (pStages.length > 0) {
      const outOfRange = pAllocs.filter(
        (a) => !pStages.some((s) => a.week_start_date >= s.start_date && a.week_start_date <= s.end_date),
      );
      if (outOfRange.length > 0) {
        warnings.push({
          type: 'project_conflict',
          severity: 'warning',
          title: `${p.code || p.name}: allocations out of range`,
          detail: `${outOfRange.length} allocation week(s) fall outside the project's defined stage dates`,
          entity: 'project',
          entityId: p.id,
          value: outOfRange.length,
        });
      }
    }
  }
  return warnings;
}

/** Run all three detectors and return a single, sorted warning list. */
export function detectAllWarnings(input: {
  resources: Resource[];
  projects: Project[];
  stages: ProjectStage[];
  allocations: Allocation[];
  weeks: string[];
  todayISO: string;
  opts?: ConflictOptions;
}): Warning[] {
  const { resources, projects, stages, allocations, weeks, todayISO, opts } = input;
  const severityRank: Record<WarningSeverity, number> = { danger: 0, warning: 1, info: 2 };
  return [
    ...detectOverAllocations(resources, allocations, weeks, opts),
    ...detectProjectConflicts(projects, stages, allocations, todayISO),
    ...detectResourceGaps(resources, allocations, weeks, opts),
  ].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
