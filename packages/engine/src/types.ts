/**
 * Canonical domain types for the FOCAL Resource Planning System.
 *
 * These mirror the database schema in §6 of the build spec. They are defined in
 * the framework-agnostic engine package so both the calculation engine and the
 * web app share one source of truth. Everything is data-driven — no entity is
 * fixed; all are CRUD-managed at runtime.
 */

// ─── Enumerations ────────────────────────────────────────────────────────────

export type EmploymentType = 'In House' | 'Agency';

export type ResourceStatus =
  | 'Active'
  | 'On Leave'
  | 'Future Joiner'
  | 'Resigned'
  | 'Inactive';

/** Statuses that exclude a resource from allocation dropdowns (history kept). */
export const ALLOCATABLE_EXCLUDED_STATUSES: ResourceStatus[] = ['Resigned', 'Inactive'];

export type ProjectStatus = 'Active' | 'On Hold' | 'Archived';

export type ProjectType = 'ENG' | 'MULTI' | 'C' | 'M';

/** Three-tier role hierarchy: Master Admin → Admin → Staff (default staff). */
export type AppRole = 'master_admin' | 'admin' | 'staff';

export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday … 6 = Saturday

// ─── Reference / master data ─────────────────────────────────────────────────

export interface Location {
  id: string;
  code: string; // COK, DXB, SRI, BLR
  name: string;
  is_active: boolean;
}

export interface Discipline {
  id: string;
  name: string; // Mechanical, Electrical, Public Health, BIM
  color: string; // CSS colour value used on chips / bars / charts
  sort_order: number;
  is_active: boolean;
}

export interface Grade {
  id: string;
  name: string; // Engineer (M), Senior Engineer (E), Associate, GET …
  discipline_category: string | null;
  sort_order: number;
}

export interface Team {
  id: string;
  name: string; // Team-A … Team-D, Shared Support
  is_active: boolean;
}

export interface StageType {
  id: string;
  name: string; // SV, CD, SD 50%, DD 100%, IFC …
  sort_order: number;
  is_active: boolean;
}

export interface Holiday {
  id: string;
  location_id: string | null; // null = applies to all locations
  date: string; // YYYY-MM-DD
  name: string;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface UtilThresholds {
  /** upper bound (inclusive) of the "under-utilized" blue band */
  underMax: number; // default 79
  /** upper bound of the lavender "moderate" band */
  moderateMax: number; // default 90
  /** upper bound of the green "fully utilized" band */
  fullMax: number; // default 100
  /** upper bound of the orange "slightly over" band; above this is red */
  slightOverMax: number; // default 110
}

export interface AppSettings {
  weekly_capacity_hours: number; // default 42.5
  week_start_day: WeekStartDay; // default 6 (Saturday)
  util_thresholds: UtilThresholds;
  planner_start: string; // YYYY-MM-DD
  horizon_months: number; // default 24
  bench_threshold: number; // util% below which an Active resource is a "gap"; default 50
  overalloc_threshold: number; // util% above which a week is over-allocated; default 110
  /** Whether Admins (not just Master Admin) may edit master data (RBAC §3 toggle). */
  master_data_admin_editable: boolean;
  version: string;
}

// ─── People ──────────────────────────────────────────────────────────────────

export interface Resource {
  id: string;
  forename: string;
  full_name: string; // composed "{Team} - {Discipline} {Grade} - {Forename}"
  discipline_id: string | null;
  grade_id: string | null;
  team_id: string | null;
  location_id: string | null;
  employment_type: EmploymentType;
  employee_code: string | null;
  role_title: string | null;
  weekly_capacity_hours: number; // default 42.5
  status: ResourceStatus;
  join_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Projects & stages ───────────────────────────────────────────────────────

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string | null;
  location_id: string | null;
  project_manager: string | null;
  project_type: ProjectType | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectStage {
  id: string;
  project_id: string;
  stage_type_id: string | null;
  stage_name: string; // denormalized label for display
  start_date: string;
  end_date: string;
  duration_weeks: number;
  sort_order: number;
}

// ─── The time-phased allocation grid (heart of the system) ───────────────────

export interface Allocation {
  id: string;
  resource_id: string;
  project_id: string;
  stage_id: string | null;
  week_start_date: string; // YYYY-MM-DD, the configured week-start (Saturday default)
  allocation_factor: number; // 1.00 = 100% = weekly_capacity hours; may exceed 1.00
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Project look-ahead tracker ──────────────────────────────────────────────

export interface LookAhead {
  id: string;
  project_id: string;
  task: string;
  project_lead: string | null;
  status: string | null;
  priority: string | null;
  complete_pct: number | null;
  remarks: string | null;
  week_start_date: string | null;
  sort_order: number;
}

// ─── Audit & users ───────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string; // create | update | delete | archive | import | reset …
  entity: string; // resource | project | allocation | stage | …
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  status: 'Active' | 'Inactive';
  /** Links a Staff account to its resource record so "My Allocation" knows who they are. */
  resource_id: string | null;
}
