/**
 * DataProvider — the repository contract the whole app codes against.
 *
 * The UI and query hooks depend only on this interface. Today it is backed by
 * IndexedDB (LocalDataProvider); the same contract will later be implemented by
 * a SupabaseDataProvider with zero changes to pages or hooks.
 */

import type {
  Location, Discipline, Grade, Team, StageType, ProjectTypeOption, Holiday,
  Resource, Project, ProjectStage, Allocation, LookAhead,
  ActivityLog, AppUser, AppSettings,
} from '@engine';

/** Fields the provider manages for you on writes. */
export type CreateInput<T extends { id: string }> = Omit<T, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<T, 'id'>>;
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'created_at'>>;

export interface Repo<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(input: CreateInput<T>): Promise<T>;
  update(id: string, patch: UpdateInput<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

export interface AllocationRepo extends Repo<Allocation> {
  listByProject(projectId: string): Promise<Allocation[]>;
  listByResource(resourceId: string): Promise<Allocation[]>;
  /** Insert or update many allocation rows in one transaction. */
  bulkUpsert(rows: CreateInput<Allocation>[]): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
  /** Remove every allocation for a (resource, project[, stage]) tuple. */
  removeForAssignment(resourceId: string, projectId: string, stageId?: string | null): Promise<void>;
}

export interface ActivityRepo {
  list(limit?: number): Promise<ActivityLog[]>;
  log(entry: Omit<ActivityLog, 'id' | 'created_at'>): Promise<ActivityLog>;
}

export interface DataProvider {
  locations: Repo<Location>;
  disciplines: Repo<Discipline>;
  grades: Repo<Grade>;
  teams: Repo<Team>;
  stageTypes: Repo<StageType>;
  projectTypes: Repo<ProjectTypeOption>;
  holidays: Repo<Holiday>;
  resources: Repo<Resource>;
  projects: Repo<Project>;
  stages: Repo<ProjectStage>;
  allocations: AllocationRepo;
  lookAhead: Repo<LookAhead>;
  users: Repo<AppUser>;
  activity: ActivityRepo;

  getSettings(): Promise<AppSettings>;
  saveSettings(patch: Partial<AppSettings>): Promise<AppSettings>;

  /** True once at least one entity row exists (used to decide first-run seeding UX). */
  isEmpty(): Promise<boolean>;
  /** Wipe everything (including settings reset to defaults). */
  clearAll(): Promise<void>;
  /** Load removable demo data (spec §8). */
  seedDemoData(): Promise<void>;
  /** Admin "Reset / clear demo data": wipe placeholder rows, keep a clean instance. */
  resetDemoData(): Promise<void>;
}
