import { useEffect, useState, type ReactNode } from 'react';
import { usingSupabase, getSessionUser, onAuthChange, fetchProfile, signOut, type SessionUser } from '../../lib/auth';
import { useAppStore } from '../../store/appStore';
import { Login } from './Login';

/**
 * Gates the app. In Supabase mode it requires a session and loads the user's
 * app_users profile (role/identity drive the whole app). In local mode it's a
 * transparent passthrough (dev role switcher stays).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!usingSupabase) return <>{children}</>;
  return <SupabaseAuthGate>{children}</SupabaseAuthGate>;
}

function FullLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)', color: 'var(--gray-400)' }}>
      <i className="ti ti-loader-2" style={{ fontSize: 30, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DeniedScreen({ reason, email }: { reason: 'inactive' | 'pending'; email?: string }) {
  const title = reason === 'inactive' ? 'Access deactivated' : 'Account not set up';
  const message =
    reason === 'inactive'
      ? 'Your account has been deactivated. Please contact your administrator to restore access.'
      : "Your account isn't linked to a profile yet. Please ask your administrator to enable it.";
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)' }}>
      <div className="card" style={{ maxWidth: 420, textAlign: 'center', padding: 32, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <i className="ti ti-lock-x" style={{ fontSize: 40, color: 'var(--danger)' }} />
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p className="muted" style={{ margin: 0 }}>{message}</p>
        {email && <p className="muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>Signed in as {email}</p>}
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => signOut()}><i className="ti ti-logout" /> Sign out</button>
      </div>
    </div>
  );
}

function SupabaseAuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'unauthed' | 'authed' | 'denied'>('loading');
  const [denied, setDenied] = useState<{ reason: 'inactive' | 'pending'; email?: string } | null>(null);
  const [recovery, setRecovery] = useState(false);
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    let active = true;
    const load = async (sessionUser: SessionUser | null, event?: string) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); return; }
      if (!sessionUser) { setState('unauthed'); return; }
      const profile = await fetchProfile(sessionUser.id).catch(() => null);
      if (!active) return;
      if (profile && profile.status === 'Active') {
        setUser({ id: profile.id, name: profile.name, role: profile.role, resourceId: profile.resourceId });
        setState('authed');
      } else {
        // Deactivated, or removed/never-provisioned (deleting the app_users row
        // here, or in Admin → Users, revokes access). Block — do NOT fall back to staff.
        setDenied({ reason: profile ? 'inactive' : 'pending', email: sessionUser.email });
        setState('denied');
      }
    };
    getSessionUser().then((u) => load(u));
    const unsub = onAuthChange(load);
    return () => { active = false; unsub(); };
  }, [setUser]);

  // Arrived via a password-reset link → force setting a new password first.
  if (recovery) {
    return <Login initialMode="reset" onResetDone={() => { setRecovery(false); getSessionUser().then((u) => { if (u) setState('authed'); }); }} />;
  }
  if (state === 'loading') return <FullLoader />;
  if (state === 'unauthed') return <Login />;
  if (state === 'denied' && denied) return <DeniedScreen reason={denied.reason} email={denied.email} />;
  return <>{children}</>;
}
