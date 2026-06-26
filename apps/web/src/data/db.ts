/**
 * IndexedDB schema (via Dexie) for the local-first data layer.
 *
 * This is the *current* persistence backend. The app never touches Dexie
 * directly — it goes through the DataProvider interface (see provider.ts), so
 * swapping in a SupabaseDataProvider later requires no UI changes.
 */

import Dexie, { type Table } from 'dexie';
import type {
  Location, Discipline, Grade, Team, StageType, ProjectTypeOption, Holiday,
  Resource, Project, ProjectStage, Allocation, LookAhead,
  ActivityLog, AppUser,
} from '@engine';

export interface MetaRow {
  key: string;
  value: unknown;
}

export class FocalDB extends Dexie {
  locations!: Table<Location, string>;
  disciplines!: Table<Discipline, string>;
  grades!: Table<Grade, string>;
  teams!: Table<Team, string>;
  stageTypes!: Table<StageType, string>;
  projectTypes!: Table<ProjectTypeOption, string>;
  holidays!: Table<Holiday, string>;
  resources!: Table<Resource, string>;
  projects!: Table<Project, string>;
  stages!: Table<ProjectStage, string>;
  allocations!: Table<Allocation, string>;
  lookAhead!: Table<LookAhead, string>;
  activity!: Table<ActivityLog, string>;
  users!: Table<AppUser, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('focal_rps');
    this.version(1).stores({
      locations: 'id, code, is_active',
      disciplines: 'id, sort_order, is_active',
      grades: 'id, sort_order',
      teams: 'id, is_active',
      stageTypes: 'id, sort_order, is_active',
      holidays: 'id, date, location_id',
      resources: 'id, team_id, discipline_id, grade_id, location_id, status',
      projects: 'id, code, status, location_id',
      stages: 'id, project_id, stage_type_id',
      allocations:
        'id, resource_id, project_id, stage_id, week_start_date, [resource_id+week_start_date], [project_id+week_start_date], [resource_id+project_id]',
      lookAhead: 'id, project_id, week_start_date',
      activity: 'id, created_at, entity, entity_id',
      users: 'id, email, role',
      meta: 'key',
    });
    // v2: configurable Project Types master list (keeps all v1 stores + data).
    this.version(2).stores({
      projectTypes: 'id, sort_order, is_active',
    });
  }
}

export const db = new FocalDB();
