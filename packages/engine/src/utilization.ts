/**
 * Utilization — the number everything keys off (spec §3.3).
 *
 *   utilization% = ( Σ allocation_factor over all of a resource's allocations
 *                    in that week ) × 100
 *
 * Average utilization over a period = mean of weekly utilization% across the
 * visible weeks.
 */

import type { Allocation } from './types.js';
import { factorToPercent } from './capacity.js';

/** Map of week-start ISO → summed allocation factor for one resource. */
export type WeeklyFactorMap = Map<string, number>;

/**
 * Sum allocation factors per week for a single resource's allocations.
 * (Caller filters to one resource first, or pass all and group by resource.)
 */
export function sumFactorsByWeek(allocations: Allocation[]): WeeklyFactorMap {
  const map: WeeklyFactorMap = new Map();
  for (const a of allocations) {
    map.set(a.week_start_date, (map.get(a.week_start_date) ?? 0) + a.allocation_factor);
  }
  return map;
}

/** Group allocations by resource id, then by week → summed factor. */
export function factorsByResourceWeek(
  allocations: Allocation[],
): Map<string, WeeklyFactorMap> {
  const byResource = new Map<string, WeeklyFactorMap>();
  for (const a of allocations) {
    let weeks = byResource.get(a.resource_id);
    if (!weeks) {
      weeks = new Map();
      byResource.set(a.resource_id, weeks);
    }
    weeks.set(a.week_start_date, (weeks.get(a.week_start_date) ?? 0) + a.allocation_factor);
  }
  return byResource;
}

/** Utilization % for a resource in a specific week. */
export function weeklyUtilizationPercent(
  allocations: Allocation[],
  weekStart: string,
): number {
  let factor = 0;
  for (const a of allocations) {
    if (a.week_start_date === weekStart) factor += a.allocation_factor;
  }
  return factorToPercent(factor);
}

/**
 * Average utilization % across a set of weeks. By default averages only the
 * weeks present in `weeks`; missing weeks count as 0% so the mean reflects the
 * full visible window (matching the Summary sheet's behaviour).
 */
export function averageUtilizationPercent(
  weeklyFactors: WeeklyFactorMap,
  weeks: string[],
): number {
  if (weeks.length === 0) return 0;
  let total = 0;
  for (const w of weeks) total += factorToPercent(weeklyFactors.get(w) ?? 0);
  return total / weeks.length;
}

/** Peak (max) weekly utilization % for a resource across the given weeks. */
export function peakUtilizationPercent(
  weeklyFactors: WeeklyFactorMap,
  weeks: string[],
): number {
  let peak = 0;
  for (const w of weeks) {
    const pct = factorToPercent(weeklyFactors.get(w) ?? 0);
    if (pct > peak) peak = pct;
  }
  return peak;
}

/** Weekly utilization% series for a resource across an ordered week list. */
export function utilizationSeries(
  weeklyFactors: WeeklyFactorMap,
  weeks: string[],
): number[] {
  return weeks.map((w) => factorToPercent(weeklyFactors.get(w) ?? 0));
}
