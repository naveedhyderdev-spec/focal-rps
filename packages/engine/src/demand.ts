/**
 * Demand vs Capacity for capacity planning & graphs (spec §3.5).
 *
 *   Demand(group, week)   = Σ (allocation_factor × 42.5) across the group's resources
 *   Capacity(group, week) = (count of Active resources in the group) × 42.5
 *
 * The per-resource capacity reference line is a constant 42.5h (drawn as a
 * black dashed line in charts) so over-capacity is instantly readable.
 */

import type { Allocation, Resource } from './types.js';
import { DEFAULT_WEEKLY_CAPACITY } from './capacity.js';

export interface DemandCapacityPoint {
  week: string; // week-start ISO
  demandHours: number;
  capacityHours: number;
}

export interface GroupSeries {
  groupId: string;
  groupName: string;
  points: DemandCapacityPoint[];
}

export type GroupKey = (r: Resource) => string | null;

interface BuildOptions {
  capacity?: number;
  /** Predicate for which resources count toward capacity (default: status === 'Active'). */
  countsForCapacity?: (r: Resource) => boolean;
}

/**
 * Build demand-vs-capacity series for each group across the given ordered weeks.
 * `groupOf` extracts the grouping key (e.g. team id or discipline id) from a
 * resource; resources whose key is null are skipped.
 */
export function buildDemandCapacity(
  resources: Resource[],
  allocations: Allocation[],
  weeks: string[],
  groupOf: GroupKey,
  groupName: (groupId: string) => string,
  opts: BuildOptions = {},
): GroupSeries[] {
  const capacity = opts.capacity ?? DEFAULT_WEEKLY_CAPACITY;
  const countsForCapacity = opts.countsForCapacity ?? ((r: Resource) => r.status === 'Active');

  const resourceById = new Map(resources.map((r) => [r.id, r]));
  const groupOfResource = new Map<string, string>();
  for (const r of resources) {
    const g = groupOf(r);
    if (g != null) groupOfResource.set(r.id, g);
  }

  // capacity: count of qualifying resources per group
  const capacityCount = new Map<string, number>();
  for (const r of resources) {
    const g = groupOfResource.get(r.id);
    if (g == null) continue;
    if (countsForCapacity(r)) capacityCount.set(g, (capacityCount.get(g) ?? 0) + 1);
  }

  const weekIndex = new Map(weeks.map((w, i) => [w, i]));

  // demand: sum factors per group per week
  const demandHours = new Map<string, number[]>();
  const ensure = (g: string) => {
    let arr = demandHours.get(g);
    if (!arr) {
      arr = new Array(weeks.length).fill(0);
      demandHours.set(g, arr);
    }
    return arr;
  };

  for (const a of allocations) {
    const r = resourceById.get(a.resource_id);
    if (!r) continue;
    const g = groupOfResource.get(r.id);
    if (g == null) continue;
    const wi = weekIndex.get(a.week_start_date);
    if (wi == null) continue;
    ensure(g)[wi] += a.allocation_factor * capacity;
  }

  // Include every group that has any resource (even all-inactive → 0 capacity)
  // plus any group carrying demand, so charts never silently drop a discipline/team.
  const groupIds = new Set<string>([
    ...groupOfResource.values(),
    ...capacityCount.keys(),
    ...demandHours.keys(),
  ]);
  const series: GroupSeries[] = [];
  for (const g of groupIds) {
    const dArr = demandHours.get(g) ?? new Array(weeks.length).fill(0);
    const cap = (capacityCount.get(g) ?? 0) * capacity;
    series.push({
      groupId: g,
      groupName: groupName(g),
      points: weeks.map((w, i) => ({
        week: w,
        demandHours: dArr[i],
        capacityHours: cap,
      })),
    });
  }
  return series.sort((a, b) => a.groupName.localeCompare(b.groupName));
}
