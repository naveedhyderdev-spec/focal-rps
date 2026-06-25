/**
 * LocalDataProvider — IndexedDB-backed implementation of DataProvider.
 */

import { v4 as uuid } from 'uuid';
import type { Table } from 'dexie';
import type {
  Allocation, ActivityLog, AppSettings,
} from '@engine';
import { DEFAULT_UTIL_THRESHOLDS } from '@engine';
import { db } from './db';
import type {
  DataProvider, Repo, AllocationRepo, ActivityRepo, CreateInput, UpdateInput,
} from './provider';
import { buildDemoData } from './seed';

const SETTINGS_KEY = 'app_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  weekly_capacity_hours: 42.5,
  week_start_day: 6, // Saturday — matches the live workbook
  util_thresholds: { ...DEFAULT_UTIL_THRESHOLDS },
  planner_start: '2025-06-07',
  horizon_months: 24,
  bench_threshold: 50,
  overalloc_threshold: 110,
  master_data_admin_editable: true,
  version: '1.0.0',
};

function nowISO(): string {
  return new Date().toISOString();
}

/** Generic CRUD over a Dexie table with managed id/timestamps. */
function makeRepo<T extends { id: string; created_at?: string; updated_at?: string }>(
  table: Table<T, string>,
): Repo<T> {
  return {
    async list() {
      return table.toArray();
    },
    async get(id: string) {
      return table.get(id);
    },
    async create(input: CreateInput<T>) {
      const ts = nowISO();
      const row = {
        ...(input as object),
        id: (input as { id?: string }).id ?? uuid(),
        created_at: ts,
        updated_at: ts,
      } as T;
      await table.put(row);
      return row;
    },
    async update(id: string, patch: UpdateInput<T>) {
      const existing = await table.get(id);
      if (!existing) throw new Error(`Record ${id} not found`);
      const row = { ...existing, ...patch, id, updated_at: nowISO() } as T;
      await table.put(row);
      return row;
    },
    async remove(id: string) {
      await table.delete(id);
    },
  };
}

function makeAllocationRepo(): AllocationRepo {
  const base = makeRepo<Allocation>(db.allocations);
  return {
    ...base,
    async listByProject(projectId: string) {
      return db.allocations.where('project_id').equals(projectId).toArray();
    },
    async listByResource(resourceId: string) {
      return db.allocations.where('resource_id').equals(resourceId).toArray();
    },
    async bulkUpsert(rows: CreateInput<Allocation>[]) {
      const ts = nowISO();
      const prepared: Allocation[] = rows.map((r) => ({
        ...(r as object),
        id: (r as { id?: string }).id ?? uuid(),
        created_at: (r as { created_at?: string }).created_at ?? ts,
        updated_at: ts,
      })) as Allocation[];
      await db.allocations.bulkPut(prepared);
    },
    async removeMany(ids: string[]) {
      await db.allocations.bulkDelete(ids);
    },
    async removeForAssignment(resourceId, projectId, stageId) {
      const rows = await db.allocations
        .where('[resource_id+project_id]')
        .equals([resourceId, projectId])
        .toArray();
      const toDelete = rows
        .filter((r) => (stageId === undefined ? true : r.stage_id === stageId))
        .map((r) => r.id);
      await db.allocations.bulkDelete(toDelete);
    },
  };
}

function makeActivityRepo(): ActivityRepo {
  return {
    async list(limit = 50) {
      const rows = await db.activity.orderBy('created_at').reverse().limit(limit).toArray();
      return rows;
    },
    async log(entry) {
      const row: ActivityLog = { ...entry, id: uuid(), created_at: nowISO() };
      await db.activity.put(row);
      return row;
    },
  };
}

export class LocalDataProvider implements DataProvider {
  locations = makeRepo(db.locations);
  disciplines = makeRepo(db.disciplines);
  grades = makeRepo(db.grades);
  teams = makeRepo(db.teams);
  stageTypes = makeRepo(db.stageTypes);
  holidays = makeRepo(db.holidays);
  resources = makeRepo(db.resources);
  projects = makeRepo(db.projects);
  stages = makeRepo(db.stages);
  allocations = makeAllocationRepo();
  lookAhead = makeRepo(db.lookAhead);
  users = makeRepo(db.users);
  activity = makeActivityRepo();

  async getSettings(): Promise<AppSettings> {
    const row = await db.meta.get(SETTINGS_KEY);
    if (!row) {
      await db.meta.put({ key: SETTINGS_KEY, value: DEFAULT_SETTINGS });
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...(row.value as AppSettings) };
  }

  async saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const next = { ...current, ...patch };
    await db.meta.put({ key: SETTINGS_KEY, value: next });
    return next;
  }

  async isEmpty(): Promise<boolean> {
    const counts = await Promise.all([
      db.resources.count(),
      db.projects.count(),
      db.allocations.count(),
    ]);
    return counts.every((c) => c === 0);
  }

  async clearAll(): Promise<void> {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
    });
    await db.meta.put({ key: SETTINGS_KEY, value: DEFAULT_SETTINGS });
  }

  async seedDemoData(): Promise<void> {
    const data = buildDemoData(DEFAULT_SETTINGS);
    await db.transaction('rw', db.tables, async () => {
      await db.locations.bulkPut(data.locations);
      await db.disciplines.bulkPut(data.disciplines);
      await db.grades.bulkPut(data.grades);
      await db.teams.bulkPut(data.teams);
      await db.stageTypes.bulkPut(data.stageTypes);
      await db.holidays.bulkPut(data.holidays);
      await db.resources.bulkPut(data.resources);
      await db.projects.bulkPut(data.projects);
      await db.stages.bulkPut(data.stages);
      await db.allocations.bulkPut(data.allocations);
      await db.users.bulkPut(data.users);
      await db.meta.put({ key: SETTINGS_KEY, value: data.settings });
    });
    await this.activity.log({
      user_id: null, action: 'seed', entity: 'system', entity_id: null,
      details: { message: 'Loaded demo data' },
    });
  }

  async resetDemoData(): Promise<void> {
    // Wipe everything except keep settings/users baseline, leaving a clean instance.
    await db.transaction('rw', db.tables, async () => {
      await Promise.all([
        db.locations.clear(), db.disciplines.clear(), db.grades.clear(),
        db.teams.clear(), db.stageTypes.clear(), db.holidays.clear(),
        db.resources.clear(), db.projects.clear(), db.stages.clear(),
        db.allocations.clear(), db.lookAhead.clear(), db.activity.clear(),
      ]);
    });
    await this.activity.log({
      user_id: null, action: 'reset', entity: 'system', entity_id: null,
      details: { message: 'Cleared demo data' },
    });
  }
}
