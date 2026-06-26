/**
 * Pure, timezone-safe date & week-bucket utilities.
 *
 * The planning horizon is a series of weekly buckets, each identified by its
 * week-start date (a Saturday by default — see §3.2). All arithmetic is done in
 * UTC against `YYYY-MM-DD` strings to avoid local-timezone drift.
 */

import type { WeekStartDay } from './types.js';

const MS_PER_DAY = 86_400_000;
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Parse a `YYYY-MM-DD` string into a UTC-midnight Date. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a Date as a `YYYY-MM-DD` string (UTC). */
export function toISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, n: number): string {
  return toISO(new Date(parseISO(iso).getTime() + n * MS_PER_DAY));
}

export function addWeeks(iso: string, n: number): string {
  return addDays(iso, n * 7);
}

export function addMonths(iso: string, n: number): string {
  const d = parseISO(iso);
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate())));
}

/** Day of week, 0 = Sunday … 6 = Saturday (UTC). */
export function dayOfWeek(iso: string): number {
  return parseISO(iso).getUTCDay();
}

/** Saturday (6) and Sunday (0) are weekend days. */
export function isWeekend(iso: string): boolean {
  const d = dayOfWeek(iso);
  return d === 0 || d === 6;
}

/** Snap a date back to the most recent week-start for the configured start day. */
export function startOfWeek(iso: string, weekStartDay: WeekStartDay): string {
  const dow = dayOfWeek(iso);
  const diff = (dow - weekStartDay + 7) % 7;
  return addDays(iso, -diff);
}

/** Inclusive number of whole days between two ISO dates. */
export function daysBetween(startISO: string, endISO: string): number {
  return Math.round((parseISO(endISO).getTime() - parseISO(startISO).getTime()) / MS_PER_DAY);
}

/**
 * Number of weeks a stage spans, inclusive of both ends.
 * Matches the workbook's "Duration (weeks)" column: ceil(days / 7).
 */
export function durationWeeks(startISO: string, endISO: string): number {
  const days = daysBetween(startISO, endISO);
  if (days < 0) return 0;
  return Math.max(1, Math.ceil((days + 1) / 7));
}

/**
 * Generate the list of week-start dates between two dates (inclusive of any
 * week that overlaps the range). `from` is snapped to its week-start first.
 */
export function generateWeeks(
  fromISO: string,
  toISODate: string,
  weekStartDay: WeekStartDay,
): string[] {
  const weeks: string[] = [];
  let cursor = startOfWeek(fromISO, weekStartDay);
  const end = parseISO(toISODate).getTime();
  // guard against pathological inputs
  let guard = 0;
  while (parseISO(cursor).getTime() <= end && guard < 5000) {
    weeks.push(cursor);
    cursor = addWeeks(cursor, 1);
    guard++;
  }
  return weeks;
}

/** Generate `count` consecutive week-start dates starting at (snapped) `fromISO`. */
export function generateWeeksByCount(
  fromISO: string,
  count: number,
  weekStartDay: WeekStartDay,
): string[] {
  const weeks: string[] = [];
  let cursor = startOfWeek(fromISO, weekStartDay);
  for (let i = 0; i < count; i++) {
    weeks.push(cursor);
    cursor = addWeeks(cursor, 1);
  }
  return weeks;
}

/** The seven calendar days that make up a week bucket. */
export function daysOfWeek(weekStartISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartISO, i));
}

// ─── Labels & grouping ───────────────────────────────────────────────────────

/** `2025-06-07` → `Jun-25`. */
export function monthLabel(iso: string): string {
  const d = parseISO(iso);
  return `${MONTH_ABBR[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(-2)}`;
}

/** `2025-06` style key used for grouping weeks into months. */
export function monthKey(iso: string): string {
  const d = parseISO(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** `2025-06-07` → `Q2-25`. */
export function quarterLabel(iso: string): string {
  const d = parseISO(iso);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q}-${String(d.getUTCFullYear()).slice(-2)}`;
}

export function quarterKey(iso: string): string {
  const d = parseISO(iso);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

export interface MonthGroup {
  key: string; // YYYY-MM
  label: string; // Jun-25
  weeks: string[]; // week-start ISO dates belonging to this month
  weekLabels: string[]; // Jun W1, Jun W2 …
}

/**
 * Group an ordered list of week-start dates into months, labelling each week
 * within its month as `Jun W1`, `Jun W2`, … (spec §3.2). A week belongs to the
 * month of its week-start date.
 */
export function groupWeeksByMonth(weeks: string[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  let current: MonthGroup | null = null;
  for (const w of weeks) {
    const key = monthKey(w);
    if (!current || current.key !== key) {
      const d = parseISO(w);
      current = {
        key,
        label: monthLabel(w),
        weeks: [],
        weekLabels: [],
      };
      // store month abbreviation for week labelling
      (current as MonthGroup & { _abbr: string })._abbr = MONTH_ABBR[d.getUTCMonth()];
      groups.push(current);
    }
    current.weeks.push(w);
    const abbr = (current as MonthGroup & { _abbr: string })._abbr;
    current.weekLabels.push(`${abbr} W${current.weeks.length}`);
  }
  return groups;
}

export interface PeriodGroup {
  key: string;    // YYYY-MM or YYYY-Qn
  label: string;  // Jun-25 or Q2-25
  weeks: string[];
}

/** Group ordered week-start dates into quarters (label `Q2-25`). */
export function groupWeeksByQuarter(weeks: string[]): PeriodGroup[] {
  const groups: PeriodGroup[] = [];
  let current: PeriodGroup | null = null;
  for (const w of weeks) {
    const key = quarterKey(w);
    if (!current || current.key !== key) {
      current = { key, label: quarterLabel(w), weeks: [] };
      groups.push(current);
    }
    current.weeks.push(w);
  }
  return groups;
}

/** Group ordered week-start dates by a period mode (week = one bucket each). */
export function groupWeeksByPeriod(weeks: string[], mode: 'week' | 'month' | 'quarter'): PeriodGroup[] {
  if (mode === 'month') return groupWeeksByMonth(weeks).map((g) => ({ key: g.key, label: g.label, weeks: g.weeks }));
  if (mode === 'quarter') return groupWeeksByQuarter(weeks);
  return weeks.map((w) => ({ key: w, label: shortDateLabel(w), weeks: [w] }));
}

/** Build a `weekStart -> "Jun W1"` lookup for the given ordered weeks. */
export function weekLabelMap(weeks: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const g of groupWeeksByMonth(weeks)) {
    g.weeks.forEach((w, i) => map.set(w, g.weekLabels[i]));
  }
  return map;
}

/** `2025-06-07` → `7 Jun` (compact human label for a week-start). */
export function shortDateLabel(iso: string): string {
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]}`;
}

/** The Monday-based ISO-ish today, as YYYY-MM-DD in UTC. */
export function todayISO(now: Date = new Date()): string {
  return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export { MONTH_ABBR };
