/**
 * Role-based access control (RBAC change prompt §3).
 * Hierarchy: Master Admin → Admin → Staff (default staff).
 * Enforced in the mutation layer (useData) AND mirrored by Supabase RLS.
 * The UI additionally HIDES (not disables) controls a role can't use.
 */
import type { AppRole } from '@engine';

export type Capability =
  | 'view'                 // browse dashboards/summary/board/graphs (read-only for staff)
  | 'view_own'             // personal "My Allocation" view — all roles
  | 'edit_allocations'
  | 'edit_projects'
  | 'delete_projects'
  | 'edit_employees'
  | 'delete_employees'
  | 'manage_master_data'   // teams/disciplines/grades/locations/stages/holidays
  | 'manage_users'         // appoint/remove Admins, accounts — Master Admin only
  | 'system_settings'      // capacity/thresholds/week-start/version — Master Admin only
  | 'access_admin'         // can open the Admin area at all
  | 'export';

const ADMIN_CAPS: Capability[] = [
  'view', 'view_own', 'edit_allocations', 'edit_projects', 'delete_projects',
  'edit_employees', 'delete_employees', 'manage_master_data', 'access_admin', 'export',
];

const MATRIX: Record<AppRole, Capability[]> = {
  master_admin: [...ADMIN_CAPS, 'manage_users', 'system_settings'],
  admin: ADMIN_CAPS,
  staff: ['view', 'view_own'],
};

export function can(role: AppRole, capability: Capability): boolean {
  return MATRIX[role]?.includes(capability) ?? false;
}

/**
 * Master data editing respects the optional toggle (§3 footnote): Admins may
 * edit master data only when `master_data_admin_editable` is on; Master Admin always can.
 */
export function canManageMasterData(role: AppRole, masterDataAdminEditable: boolean): boolean {
  if (role === 'master_admin') return true;
  return role === 'admin' && masterDataAdminEditable;
}

const ROLE_LABELS: Record<AppRole, string> = {
  master_admin: 'Master Admin',
  admin: 'Admin',
  staff: 'Staff',
};
export function roleLabel(role: AppRole): string {
  return ROLE_LABELS[role] ?? role;
}

export const ALL_ROLES: AppRole[] = ['master_admin', 'admin', 'staff'];
