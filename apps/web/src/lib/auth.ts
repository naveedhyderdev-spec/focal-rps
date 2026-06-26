/**
 * Authentication (Supabase Auth, email + password). Reuses the ONE shared
 * Supabase client (so auth + data share a session). In local mode every call
 * is a no-op and the app runs unauthenticated with the dev role switcher.
 */
import type { AppRole, AppUser } from '@engine';
import { getSupabaseClient, usingSupabase, provider } from '../data';

export interface SessionUser { id: string; email: string }
export interface Profile { id: string; name: string; role: AppRole; resourceId: string | null; status: string }

/** App URL used for email redirect links (must be allow-listed in Supabase Auth). */
function appUrl(): string {
  return window.location.origin + window.location.pathname;
}

export async function signIn(email: string, password: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Company domain that accounts must use (mirrors the DB enforce_email_domain guard). */
export const ALLOWED_EMAIL_DOMAIN = 'focalpm.com';
export function isAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

export type SignUpResult = 'created' | 'confirm' | 'exists';

/** Self-service sign-up. Distinguishes created / needs-confirmation / already-exists. */
export async function signUp(email: string, password: string, name?: string): Promise<SignUpResult> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Auth is not configured');
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: name ? { name } : undefined, emailRedirectTo: appUrl() },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return 'exists';
    throw error;
  }
  // With email-confirmation ON, an existing address returns a user with NO identities.
  if (data.user && (data.user.identities?.length ?? 0) === 0) return 'exists';
  if (data.session) return 'created';
  return 'confirm';
}

/** Send a password-reset email (link returns to the app's reset screen). */
export async function resetPassword(email: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Auth is not configured');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  if (error) throw error;
}

/**
 * Send a 6-digit email sign-in code. Creates the auth account if it doesn't
 * exist yet (so an imported employee can "claim" their login — the DB trigger
 * then auto-links it to their Person by email), and just sends a code to anyone
 * who already has an account (forgot-password). The @focalpm.com domain guard
 * still applies (client check here + DB enforce_email_domain trigger).
 */
export async function sendEmailCode(email: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Auth is not configured');
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true, emailRedirectTo: appUrl() },
  });
  if (error) throw error;
}

/** Verify the emailed 6-digit code → establishes a session. */
export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Auth is not configured');
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
  if (error) throw error;
}

/** Set a new password (after verifying a code / arriving via a recovery link / while signed in). */
export async function updatePassword(newPassword: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Auth is not configured');
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? '' } : null;
}

/** Subscribe to auth state changes; returns an unsubscribe function. */
export function onAuthChange(cb: (user: SessionUser | null, event: string) => void): () => void {
  const sb = getSupabaseClient();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((event, session) => {
    const u = session?.user;
    cb(u ? { id: u.id, email: u.email ?? '' } : null, event);
  });
  return () => data.subscription.unsubscribe();
}

/** Look up the signed-in user's app_users profile (role/identity/link). */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const all = (await provider.users.list()) as AppUser[];
  const u = all.find((x) => x.id === userId);
  if (!u) return null;
  return { id: u.id, name: u.name, role: u.role, resourceId: u.resource_id, status: u.status };
}

export { usingSupabase };
