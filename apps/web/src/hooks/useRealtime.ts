/**
 * Realtime sync (Supabase mode). Subscribes to postgres changes and invalidates
 * the matching TanStack Query cache so one user's edits appear for everyone
 * (the board, summary, dashboards refresh live). No-op in local mode.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usingSupabase, getSupabaseClient } from '../data';
import { qk } from '../lib/queryClient';

const TABLE_KEYS: Record<string, readonly unknown[]> = {
  allocations: qk.allocations,
  projects: qk.projects,
  project_stages: qk.stages,
  resources: qk.resources,
  holidays: qk.holidays,
  settings: qk.settings,
  app_users: qk.users,
  disciplines: qk.disciplines,
  teams: qk.teams,
  grades: qk.grades,
  locations: qk.locations,
  stage_types: qk.stageTypes,
  project_types: qk.projectTypes,
  look_ahead: qk.lookAhead,
  activity_log: qk.activity,
};

export function useRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!usingSupabase) return;
    const sb = getSupabaseClient();
    if (!sb) return;
    const channel = sb
      .channel('rps-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload: { table: string }) => {
        const key = TABLE_KEYS[payload.table];
        if (key) qc.invalidateQueries({ queryKey: key });
        qc.invalidateQueries({ queryKey: qk.activity });
      })
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [qc]);
}
