/**
 * Derived/aggregate hooks built on top of the raw data hooks + the engine.
 * In the local-first phase these compute client-side; when Supabase is wired
 * the heavy aggregates can move to SQL views (v_weekly_utilization, etc.).
 */
import { useMemo } from 'react';
import {
  generateWeeks, addMonths, startOfWeek, todayISO, detectAllWarnings,
  type Warning,
} from '@engine';
import { useSettings, useAllocations, resourcesH, projectsH, stagesH } from './useData';

/** All week-start dates across the configured planning horizon. */
export function useHorizonWeeks(): string[] {
  const { data: settings } = useSettings();
  return useMemo(() => {
    if (!settings) return [];
    const end = addMonths(settings.planner_start, settings.horizon_months);
    return generateWeeks(settings.planner_start, end, settings.week_start_day);
  }, [settings]);
}

/** Conflict/warning list for the notification centre + dashboard (spec §3.6). */
export function useWarnings(): Warning[] {
  const { data: settings } = useSettings();
  const resources = resourcesH.useList().data ?? [];
  const projects = projectsH.useList().data ?? [];
  const stages = stagesH.useList().data ?? [];
  const allocations = useAllocations().data ?? [];
  const weeks = useHorizonWeeks();

  return useMemo(() => {
    if (!settings || weeks.length === 0) return [];
    const today = todayISO();
    const from = startOfWeek(today, settings.week_start_day);
    // "upcoming" window: the next 8 weeks from today (spec §3.6).
    const upcoming = weeks.filter((w) => w >= from).slice(0, 8);
    const windowWeeks = upcoming.length > 0 ? upcoming : weeks.slice(0, 8);
    return detectAllWarnings({
      resources, projects, stages, allocations,
      weeks: windowWeeks,
      todayISO: today,
      opts: {
        overallocThreshold: settings.overalloc_threshold,
        benchThreshold: settings.bench_threshold,
      },
    });
  }, [settings, resources, projects, stages, allocations, weeks]);
}
