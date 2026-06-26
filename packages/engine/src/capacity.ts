/**
 * Capacity model (spec §3.1).
 *
 * Weekly capacity = 42.5 hours = 100%. Allocation is stored as a *factor* (a
 * decimal multiplier of weekly capacity). Factors may exceed 1.0 — the engine
 * never silently clamps over-allocation; it must remain visible.
 */

export const DEFAULT_WEEKLY_CAPACITY = 42.5;

/** factor 1.0 → 100 */
export function factorToPercent(factor: number): number {
  return factor * 100;
}

/** 100 → factor 1.0 */
export function percentToFactor(percent: number): number {
  return percent / 100;
}

/** factor × capacity → hours/week */
export function factorToHours(factor: number, capacity = DEFAULT_WEEKLY_CAPACITY): number {
  return factor * capacity;
}

/** hours/week ÷ capacity → factor */
export function hoursToFactor(hours: number, capacity = DEFAULT_WEEKLY_CAPACITY): number {
  if (capacity <= 0) return 0;
  return hours / capacity;
}

/** percent → hours/week (via the 42.5 rule) */
export function percentToHours(percent: number, capacity = DEFAULT_WEEKLY_CAPACITY): number {
  return percentToFactor(percent) * capacity;
}

/** hours/week → percent (via the 42.5 rule) */
export function hoursToPercent(hours: number, capacity = DEFAULT_WEEKLY_CAPACITY): number {
  if (capacity <= 0) return 0;
  return (hours / capacity) * 100;
}

/** Round a factor to the workbook's 2-decimal precision (NUMERIC(4,2)). */
export function roundFactor(factor: number): number {
  return Math.round(factor * 100) / 100;
}

/** Round a percentage for display (no decimals by default). */
export function roundPercent(percent: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(percent * f) / f;
}

/** Round hours to 2 decimals (42.5, 21.25, 17, 8.5 …). */
export function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

/**
 * Real (leave/holiday-adjusted) capacity breakdown for a group in a week
 * (DSU-2 §3.4). `headcount` = people normally available (Active + On Leave);
 * `onLeave` of them are out; `holidayDays` reduce those present by capacity/5 each.
 * v1 treats On-Leave as whole-FTE for the period (precise per-day leave is future).
 */
export interface RealCapacity {
  nominalHours: number;
  leaveCutHours: number;
  holidayCutHours: number;
  realHours: number;
}
export function realCapacity(input: {
  headcount: number;
  onLeave: number;
  holidayDays: number;
  capacity?: number;
}): RealCapacity {
  const capacity = input.capacity ?? DEFAULT_WEEKLY_CAPACITY;
  const present = Math.max(0, input.headcount - input.onLeave);
  const nominalHours = input.headcount * capacity;
  const leaveCutHours = input.onLeave * capacity;
  const holidayCutHours = Math.min(input.holidayDays, 5) * (capacity / 5) * present;
  const realHours = Math.max(0, nominalHours - leaveCutHours - holidayCutHours);
  return {
    nominalHours,
    leaveCutHours,
    holidayCutHours: Math.round(holidayCutHours * 100) / 100,
    realHours: Math.round(realHours * 100) / 100,
  };
}

/** The canonical factor → %/hours reference table from the spec. */
export const FACTOR_REFERENCE = [
  { factor: 1.0, percent: 100, hours: 42.5 },
  { factor: 0.5, percent: 50, hours: 21.25 },
  { factor: 0.4, percent: 40, hours: 17.0 },
  { factor: 0.2, percent: 20, hours: 8.5 },
] as const;
