/**
 * The single data-layer entry point. Everything imports `provider` from here.
 * Swap LocalDataProvider for SupabaseDataProvider in one line when wiring the
 * real backend — no other file changes.
 */

import { LocalDataProvider } from './localProvider';
import { SupabaseDataProvider } from './supabaseProvider';
import type { DataProvider } from './provider';
import { db } from './db';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when Supabase env vars are configured (else local-first IndexedDB). */
export const usingSupabase = !!(SUPABASE_URL && SUPABASE_KEY);

export const provider: DataProvider = usingSupabase
  ? new SupabaseDataProvider(SUPABASE_URL!, SUPABASE_KEY!)
  : new LocalDataProvider();

/** The shared Supabase client (auth + data use ONE client), or null in local mode. */
export function getSupabaseClient() {
  return usingSupabase ? (provider as SupabaseDataProvider).client() : null;
}

const INIT_FLAG = 'initialized';

/**
 * First-run bootstrap: seed removable demo data once so screens aren't empty
 * on first load (spec §8). After an Admin reset the flag remains set, so we
 * never re-seed over an intentionally cleaned instance. Only the local provider
 * auto-seeds; a Supabase instance is seeded via supabase/seed.sql + the importer.
 */
const RBAC_FLAG = 'rbac_roles_v2';

export async function initData(): Promise<void> {
  if (usingSupabase) return;
  const flag = await db.meta.get(INIT_FLAG);
  if (!flag) {
    const empty = await provider.isEmpty();
    if (empty) await provider.seedDemoData();
    await db.meta.put({ key: INIT_FLAG, value: true });
  }
  // One-time migration to the three-tier RBAC demo users (Master/Admin/Staff).
  // Re-seeds clean so the old Admin/Planner/Viewer rows don't linger.
  const migrated = await db.meta.get(RBAC_FLAG);
  if (!migrated) {
    await provider.clearAll();
    await provider.seedDemoData();
    await db.meta.put({ key: RBAC_FLAG, value: true });
  }
}

export * from './provider';
