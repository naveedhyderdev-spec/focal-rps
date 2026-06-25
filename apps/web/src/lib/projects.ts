/**
 * Project-level derivations: date span, current-stage status, and per-resource
 * allocation summaries used by the Projects grid and Project Details page.
 */
import {
  factorToPercent, factorToHours, durationWeeks,
  type Project, type ProjectStage, type Allocation, type Resource,
} from '@engine';

export interface Span { start: string | null; end: string | null }

/** Project date span = min/max of its stage dates, falling back to project dates. */
export function projectSpan(project: Project, stages: ProjectStage[]): Span {
  if (stages.length === 0) return { start: project.start_date, end: project.end_date };
  let start = stages[0].start_date;
  let end = stages[0].end_date;
  for (const s of stages) {
    if (s.start_date < start) start = s.start_date;
    if (s.end_date > end) end = s.end_date;
  }
  return { start, end };
}

export interface StatusInfo {
  label: string;
  stageName: string | null;
  tone: 'gray' | 'blue' | 'green' | 'amber';
}

/** Where a project sits today relative to its stages. */
export function projectStatusInfo(stages: ProjectStage[], todayISO: string): StatusInfo {
  if (stages.length === 0) return { label: 'No stages', stageName: null, tone: 'gray' };
  const sorted = [...stages].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const active = sorted.find((s) => todayISO >= s.start_date && todayISO <= s.end_date);
  if (active) return { label: active.stage_name, stageName: active.stage_name, tone: 'green' };
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (todayISO < first.start_date) return { label: 'Upcoming', stageName: first.stage_name, tone: 'blue' };
  if (todayISO > last.end_date) return { label: 'Complete', stageName: last.stage_name, tone: 'gray' };
  return { label: 'Between stages', stageName: null, tone: 'amber' };
}

export interface ResourceAssignment {
  resource: Resource;
  start: string;
  end: string;
  weeks: number;
  /** Uniform factor if every week matches; otherwise null ("varies"). */
  uniformFactor: number | null;
  minFactor: number;
  maxFactor: number;
  /** Representative %/hours for display (uniform, else peak). */
  displayPercent: number;
  displayHours: number;
  allocationCount: number;
}

/** Summarize a project's allocations grouped by resource. */
export function assignmentsForProject(
  projectAllocations: Allocation[],
  resourceById: Map<string, Resource>,
  defaultCapacity = 42.5,
): ResourceAssignment[] {
  const byResource = new Map<string, Allocation[]>();
  for (const a of projectAllocations) {
    const arr = byResource.get(a.resource_id) ?? [];
    arr.push(a);
    byResource.set(a.resource_id, arr);
  }

  const out: ResourceAssignment[] = [];
  for (const [resourceId, allocs] of byResource) {
    const resource = resourceById.get(resourceId);
    if (!resource) continue;
    const sorted = [...allocs].sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
    const start = sorted[0].week_start_date;
    const end = sorted[sorted.length - 1].week_start_date;
    let min = Infinity;
    let max = -Infinity;
    for (const a of sorted) {
      if (a.allocation_factor < min) min = a.allocation_factor;
      if (a.allocation_factor > max) max = a.allocation_factor;
    }
    const uniform = min === max ? min : null;
    const cap = resource.weekly_capacity_hours || defaultCapacity;
    const repFactor = uniform ?? max;
    out.push({
      resource,
      start,
      end,
      weeks: sorted.length,
      uniformFactor: uniform,
      minFactor: min,
      maxFactor: max,
      displayPercent: factorToPercent(repFactor),
      displayHours: factorToHours(repFactor, cap),
      allocationCount: sorted.length,
    });
  }
  return out.sort((a, b) => (a.resource.full_name || a.resource.forename).localeCompare(b.resource.full_name || b.resource.forename));
}

/** Inclusive duration in weeks for a date range (re-exported convenience). */
export { durationWeeks };
