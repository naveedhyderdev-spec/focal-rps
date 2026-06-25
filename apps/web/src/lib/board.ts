/**
 * Allocation Board timeline model. Allocations are stored weekly, so the Week
 * view is the native granularity; Day repeats a week's value across its days
 * (with weekend/holiday shading); Month/Quarter aggregate (average util%).
 */
import {
  generateWeeks, startOfWeek, daysOfWeek, isWeekend, todayISO,
  monthLabel, monthKey, quarterLabel, quarterKey, weekLabelMap, shortDateLabel,
  factorToPercent, addDays, parseISO,
  type WeekStartDay,
} from '@engine';

export type ViewMode = 'day' | 'week' | 'month' | 'quarter';

export interface BoardColumn {
  key: string;
  label: string;
  sublabel?: string;
  weeks: string[]; // underlying week-start dates aggregated into this column
  widthPx: number;
  isWeekend: boolean;
  isHoliday: boolean;
  isToday: boolean;
  /** index range into the master weeks[] array, for bar positioning */
}

export const COL_WIDTH: Record<ViewMode, number> = { day: 30, week: 46, month: 70, quarter: 86 };

/** Default visible-window length (in months) per view, to bound column count. */
export const DEFAULT_WINDOW_MONTHS: Record<ViewMode, number> = { day: 1.5, week: 6, month: 18, quarter: 30 };

export interface BoardModel {
  columns: BoardColumn[];
  /** Master ordered list of week-start dates spanning the window. */
  weeks: string[];
  /** week-start → column index (for placing weekly allocations onto columns). */
  weekToCol: Map<string, number>;
  weekLabels: Map<string, string>;
}

export function buildBoardModel(
  viewMode: ViewMode,
  fromISO: string,
  toISO: string,
  weekStartDay: WeekStartDay,
  holidayDates: Set<string>,
): BoardModel {
  const weeks = generateWeeks(fromISO, toISO, weekStartDay);
  const weekLabels = weekLabelMap(weeks);
  const today = todayISO();
  const todayWeek = startOfWeek(today, weekStartDay);
  const columns: BoardColumn[] = [];
  const weekToCol = new Map<string, number>();
  const w = COL_WIDTH[viewMode];

  if (viewMode === 'week') {
    weeks.forEach((wk, i) => {
      weekToCol.set(wk, i);
      const hol = daysOfWeek(wk).some((d) => holidayDates.has(d));
      columns.push({
        key: wk, label: weekLabels.get(wk) ?? shortDateLabel(wk), sublabel: shortDateLabel(wk),
        weeks: [wk], widthPx: w, isWeekend: false, isHoliday: hol, isToday: wk === todayWeek,
      });
    });
  } else if (viewMode === 'day') {
    // Each day is a column; it maps to its week-start for util lookup.
    let cursor = fromISO;
    const end = toISO;
    let guard = 0;
    weeks.forEach((wk, i) => weekToCol.set(wk, i));
    while (cursor <= end && guard < 800) {
      const wk = startOfWeek(cursor, weekStartDay);
      const d = parseISO(cursor);
      columns.push({
        key: cursor,
        label: String(d.getUTCDate()),
        sublabel: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getUTCDay()],
        weeks: [wk], widthPx: w,
        isWeekend: isWeekend(cursor),
        isHoliday: holidayDates.has(cursor),
        isToday: cursor === today,
      });
      cursor = addDays(cursor, 1);
      guard++;
    }
  } else if (viewMode === 'month') {
    weeks.forEach((wk, i) => weekToCol.set(wk, i));
    const groups = new Map<string, string[]>();
    for (const wk of weeks) {
      const k = monthKey(wk);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(wk);
    }
    for (const [, wks] of groups) {
      const first = wks[0];
      columns.push({
        key: monthKey(first), label: monthLabel(first), weeks: wks, widthPx: w,
        isWeekend: false, isHoliday: false, isToday: wks.includes(todayWeek),
      });
    }
  } else {
    // quarter
    weeks.forEach((wk, i) => weekToCol.set(wk, i));
    const groups = new Map<string, string[]>();
    for (const wk of weeks) {
      const k = quarterKey(wk);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(wk);
    }
    for (const [, wks] of groups) {
      const first = wks[0];
      columns.push({
        key: quarterKey(first), label: quarterLabel(first), weeks: wks, widthPx: w,
        isWeekend: false, isHoliday: false, isToday: wks.includes(todayWeek),
      });
    }
  }

  return { columns, weeks, weekToCol, weekLabels };
}

/** Average utilization% for a column from a resource's weekly factor map. */
export function columnUtilPercent(weeklyFactors: Map<string, number> | undefined, col: BoardColumn): number {
  if (!weeklyFactors || col.weeks.length === 0) return 0;
  let sum = 0;
  for (const wk of col.weeks) sum += factorToPercent(weeklyFactors.get(wk) ?? 0);
  return sum / col.weeks.length;
}
