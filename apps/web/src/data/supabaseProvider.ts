/**
 * SupabaseDataProvider — PostgreSQL-backed implementation of DataProvider.
 *
 * Implements the exact same interface as LocalDataProvider, so selecting it
 * (see index.ts, gated on VITE_SUPABASE_* env vars) requires no UI changes.
 * Multi-user concurrency, realtime and server-enforced permissions come from
 * Supabase (RLS policies in supabase/policies.sql).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';
import type {
  Allocation, ActivityLog, AppSettings,
  Location, Discipline, Grade, Team, StageType, Holiday, Project, ProjectStage, LookAhead, AppUser,
} from '@engine';
import type {
  DataProvider, Repo, AllocationRepo, ActivityRepo, CreateInput, UpdateInput,
} from './provider';
import { DEFAULT_SETTINGS } from './localProvider';
import { buildDemoData } from './seed';

const SETTINGS_KEY = 'app_settings';

const TABLES = [
  'allocations', 'project_stages', 'projects', 'resources', 'look_ahead',
  'holidays', 'stage_types', 'grades', 'disciplines', 'teams', 'locations', 'activity_log',
];

function makeRepo<T extends { id: string }>(sb: SupabaseClient, table: string): Repo<T> {
  return {
    async list() {
      const { data, error } = await sb.from(table).select('*');
      if (error) throw error;
      return (data ?? []) as T[];
    },
    async get(id) {
      const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return (data ?? undefined) as T | undefined;
    },
    async create(input: CreateInput<T>) {
      // The untyped client treats payloads as `never`; cast since columns match the entity.
      const { data, error } = await sb.from(table).insert(input as Record<string, unknown>).select().single();
      if (error) throw error;
      return data as T;
    },
    async update(id, patch: UpdateInput<T>) {
      const { data, error } = await sb.from(table).update(patch as Record<string, unknown>).eq('id', id).select().single();
      if (error) throw error;
      return data as T;
    },
    async remove(id) {
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

function makeAllocationRepo(sb: SupabaseClient): AllocationRepo {
  const base = makeRepo<Allocation>(sb, 'allocations');
  return {
    ...base,
    async listByProject(projectId) {
      const { data, error } = await sb.from('allocations').select('*').eq('project_id', projectId);
      if (error) throw error;
      return (data ?? []) as Allocation[];
    },
    async listByResource(resourceId) {
      const { data, error } = await sb.from('allocations').select('*').eq('resource_id', resourceId);
      if (error) throw error;
      return (data ?? []) as Allocation[];
    },
    async bulkUpsert(rows: CreateInput<Allocation>[]) {
      if (rows.length === 0) return;
      const { error } = await sb.from('allocations').insert(rows as Record<string, unknown>[]);
      if (error) throw error;
    },
    async removeMany(ids) {
      if (ids.length === 0) return;
      const { error } = await sb.from('allocations').delete().in('id', ids);
      if (error) throw error;
    },
    async removeForAssignment(resourceId, projectId, stageId) {
      let q = sb.from('allocations').delete().eq('resource_id', resourceId).eq('project_id', projectId);
      if (stageId === null) q = q.is('stage_id', null);
      else if (stageId !== undefined) q = q.eq('stage_id', stageId);
      const { error } = await q;
      if (error) throw error;
    },
  };
}

function makeActivityRepo(sb: SupabaseClient): ActivityRepo {
  return {
    async list(limit = 50) {
      const { data, error } = await sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as ActivityLog[];
    },
    async log(entry) {
      const row = { ...entry, id: uuid() };
      const { data, error } = await sb.from('activity_log').insert(row).select().single();
      if (error) throw error;
      return data as ActivityLog;
    },
  };
}

export class SupabaseDataProvider implements DataProvider {
  private sb: SupabaseClient;
  locations: Repo<Location>;
  disciplines: Repo<Discipline>;
  grades: Repo<Grade>;
  teams: Repo<Team>;
  stageTypes: Repo<StageType>;
  holidays: Repo<Holiday>;
  resources: Repo<import('@engine').Resource>;
  projects: Repo<Project>;
  stages: Repo<ProjectStage>;
  allocations: AllocationRepo;
  lookAhead: Repo<LookAhead>;
  users: Repo<AppUser>;
  activity: ActivityRepo;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    this.locations = makeRepo<Location>(this.sb, 'locations');
    this.disciplines = makeRepo<Discipline>(this.sb, 'disciplines');
    this.grades = makeRepo<Grade>(this.sb, 'grades');
    this.teams = makeRepo<Team>(this.sb, 'teams');
    this.stageTypes = makeRepo<StageType>(this.sb, 'stage_types');
    this.holidays = makeRepo<Holiday>(this.sb, 'holidays');
    this.resources = makeRepo<import('@engine').Resource>(this.sb, 'resources');
    this.projects = makeRepo<Project>(this.sb, 'projects');
    this.stages = makeRepo<ProjectStage>(this.sb, 'project_stages');
    this.allocations = makeAllocationRepo(this.sb);
    this.lookAhead = makeRepo<LookAhead>(this.sb, 'look_ahead');
    this.users = makeRepo<AppUser>(this.sb, 'app_users');
    this.activity = makeActivityRepo(this.sb);
  }

  client(): SupabaseClient { return this.sb; }

  async getSettings(): Promise<AppSettings> {
    const { data } = await this.sb.from('settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
    return { ...DEFAULT_SETTINGS, ...((data?.value as AppSettings) ?? {}) };
  }
  async saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...(await this.getSettings()), ...patch };
    const { error } = await this.sb.from('settings').upsert({ key: SETTINGS_KEY, value: next });
    if (error) throw error;
    return next;
  }

  async isEmpty(): Promise<boolean> {
    const counts = await Promise.all(['resources', 'projects', 'allocations'].map(async (t) => {
      const { count } = await this.sb.from(t).select('id', { count: 'exact', head: true });
      return count ?? 0;
    }));
    return counts.every((c) => c === 0);
  }

  private async wipe(tables: string[]) {
    for (const t of tables) {
      const { error } = await this.sb.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    }
  }

  async clearAll(): Promise<void> {
    await this.wipe(TABLES);
    await this.sb.from('settings').upsert({ key: SETTINGS_KEY, value: DEFAULT_SETTINGS });
  }

  async resetDemoData(): Promise<void> {
    await this.wipe(TABLES);
    await this.activity.log({ user_id: null, action: 'reset', entity: 'system', entity_id: null, details: null });
  }

  /** Load removable demo data, remapping the seed's slug ids to UUIDs for FKs. */
  async seedDemoData(): Promise<void> {
    const demo = buildDemoData(DEFAULT_SETTINGS);
    const map = new Map<string, string>();
    const mid = (id: string) => { if (!map.has(id)) map.set(id, uuid()); return map.get(id)!; };
    [...demo.locations, ...demo.disciplines, ...demo.grades, ...demo.teams, ...demo.stageTypes,
      ...demo.resources, ...demo.projects, ...demo.stages].forEach((e) => mid(e.id));

    const strip = <T extends object>(o: T) => { const { created_at, updated_at, ...rest } = o as T & { created_at?: unknown; updated_at?: unknown }; void created_at; void updated_at; return rest; };

    const ins = async (table: string, rows: object[]) => { if (rows.length) { const { error } = await this.sb.from(table).insert(rows); if (error) throw error; } };

    await ins('locations', demo.locations.map((l) => ({ ...l, id: mid(l.id) })));
    await ins('disciplines', demo.disciplines.map((d) => ({ ...d, id: mid(d.id) })));
    await ins('grades', demo.grades.map((g) => ({ ...g, id: mid(g.id) })));
    await ins('teams', demo.teams.map((t) => ({ ...t, id: mid(t.id) })));
    await ins('stage_types', demo.stageTypes.map((s) => ({ ...s, id: mid(s.id) })));
    await ins('holidays', demo.holidays.map((h) => ({ id: uuid(), date: h.date, name: h.name, location_id: h.location_id ? mid(h.location_id) : null })));
    await ins('resources', demo.resources.map((r) => strip({ ...r, id: mid(r.id), discipline_id: r.discipline_id ? mid(r.discipline_id) : null, grade_id: r.grade_id ? mid(r.grade_id) : null, team_id: r.team_id ? mid(r.team_id) : null, location_id: r.location_id ? mid(r.location_id) : null })));
    await ins('projects', demo.projects.map((p) => strip({ ...p, id: mid(p.id), location_id: p.location_id ? mid(p.location_id) : null })));
    await ins('project_stages', demo.stages.map((s) => ({ ...s, id: mid(s.id), project_id: mid(s.project_id), stage_type_id: s.stage_type_id ? mid(s.stage_type_id) : null })));
    await ins('allocations', demo.allocations.map((a) => strip({ id: uuid(), resource_id: mid(a.resource_id), project_id: mid(a.project_id), stage_id: a.stage_id ? mid(a.stage_id) : null, week_start_date: a.week_start_date, allocation_factor: a.allocation_factor, created_by: 'demo' })));
    await this.sb.from('settings').upsert({ key: SETTINGS_KEY, value: demo.settings });
    await this.activity.log({ user_id: null, action: 'seed', entity: 'system', entity_id: null, details: { message: 'Loaded demo data' } });
  }
}
