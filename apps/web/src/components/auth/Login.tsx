import { useState } from 'react';
import { signIn, signUp, sendEmailCode, verifyEmailCode, updatePassword, isAllowedEmail, ALLOWED_EMAIL_DOMAIN } from '../../lib/auth';
import { useAppStore } from '../../store/appStore';
import { ThemeToggle } from '../shell/ThemeToggle';

// signin  = returning user, email + password
// signup  = create an account with email + password (no email verification needed)
// code    = enter email → we send a 6-digit code (first-time claim / forgot password — needs SMTP)
// verify  = enter the code + choose a password
// reset   = set a new password after arriving via a recovery link (AuthGate PASSWORD_RECOVERY)
type Mode = 'signin' | 'signup' | 'code' | 'verify' | 'reset';

// NOTE: the email-OTP ("code"/"verify") flow below is kept for later but has no UI
// entry yet (needs Supabase SMTP + a {{ .Token }} template + the prod Site URL).
// For now, first-time users set a password directly via "Forgot password" → signUp.

/**
 * Auth screen (Supabase Auth). Returning users sign in with a password; first-time
 * employees and anyone who forgot their password use an emailed 6-digit OTP code,
 * then choose a password. New accounts auto-link to their Person record by email.
 */
export function Login({ initialMode = 'signin', onResetDone }: { initialMode?: Mode; onResetDone?: () => void }) {
  const resolved = useAppStore((s) => s.resolvedTheme);
  const logo = resolved === 'light' ? 'focal-logo-blue.png' : 'focal-logo-white.png';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const go = (m: Mode) => { setMode(m); setError(null); setNotice(null); };

  const checkPassword = () => {
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    if (password !== confirm) throw new Error('Passwords do not match');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        // AuthGate reacts to the SIGNED_IN event.
      } else if (mode === 'signup') {
        if (!isAllowedEmail(email)) throw new Error(`Please use your @${ALLOWED_EMAIL_DOMAIN} email address`);
        checkPassword();
        const result = await signUp(email.trim(), password);
        if (result === 'exists') { setMode('signin'); setNotice(`${email.trim()} already has an account — just sign in with your password below.`); }
        else if (result === 'confirm') { setMode('signin'); setNotice('Account created — check your email to verify, then sign in.'); }
        // 'created' → a session exists (email confirmation OFF) → AuthGate loads the app.
      } else if (mode === 'code') {
        if (!isAllowedEmail(email)) throw new Error(`Please use your @${ALLOWED_EMAIL_DOMAIN} email address`);
        await sendEmailCode(email.trim());
        setCode(''); setPassword(''); setConfirm('');
        setMode('verify');
        setNotice(`We emailed a 6-digit code to ${email.trim()}. Enter it below and choose a password.`);
      } else if (mode === 'verify') {
        if (!/^\d{6}$/.test(code.trim())) throw new Error('Enter the 6-digit code from your email');
        checkPassword();
        await verifyEmailCode(email.trim(), code.trim());  // establishes a session
        await updatePassword(password);                    // set their chosen password
        // Session is live + password set → AuthGate loads the app.
      } else if (mode === 'reset') {
        checkPassword();
        await updatePassword(password);
        onResetDone?.();
      }
    } catch (err) {
      setError((err as Error).message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await sendEmailCode(email.trim());
      setNotice(`New code sent to ${email.trim()}.`);
    } catch (err) {
      setError((err as Error).message || 'Could not resend the code');
    } finally { setBusy(false); }
  };

  const titles: Record<Mode, string> = {
    signin: 'Sign in',
    signup: 'Set your password',
    code: 'Set up or reset your password',
    verify: 'Enter your code',
    reset: 'Set a new password',
  };
  const subtitles: Record<Mode, string> = {
    signin: '',
    signup: `Enter your @${ALLOWED_EMAIL_DOMAIN} email and choose a password — that's it, you're in. (Links to your Person record automatically.)`,
    code: `First time here, or forgot your password? Enter your @${ALLOWED_EMAIL_DOMAIN} email and we'll send a code.`,
    verify: '',
    reset: '',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)', padding: 'var(--space-4)' }}>
      <div style={{ position: 'fixed', top: 'var(--space-4)', right: 'var(--space-4)' }}><ThemeToggle /></div>
      <div className="card" style={{ width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-lg)' }}>
        <div className="card-body" style={{ padding: 'var(--space-8)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 'var(--space-6)' }}>
            <img src={`${import.meta.env.BASE_URL}${logo}`} alt="Focal" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
            <div className="muted" style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Resource Planning</div>
          </div>

          <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: subtitles[mode] ? 6 : 'var(--space-4)', textAlign: 'center' }}>{titles[mode]}</h2>
          {subtitles[mode] && <p className="muted" style={{ fontSize: 'var(--text-sm)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>{subtitles[mode]}</p>}

          <form onSubmit={submit}>
            {error && <div className="alert alert-danger" style={{ marginBottom: 14 }}><i className="ti ti-alert-circle" />{error}</div>}
            {notice && <div className="alert alert-success" style={{ marginBottom: 14 }}><i className="ti ti-mail" />{notice}</div>}

            {/* Email — shown for signin, signup & code */}
            {(mode === 'signin' || mode === 'signup' || mode === 'code') && (
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={email} autoFocus autoComplete="username"
                  onChange={(e) => setEmail(e.target.value)} placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`} required />
              </div>
            )}

            {mode === 'verify' && (
              <>
                <div className="form-group">
                  <label className="form-label">6-digit code</label>
                  <input className="form-control" value={code} autoFocus inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••"
                    style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: 'var(--text-lg)' }} required />
                  <div className="form-hint">Sent to {email}. <button type="button" className="btn btn-sm btn-ghost" onClick={resend} disabled={busy} style={{ padding: '0 4px' }}>Resend</button></div>
                </div>
              </>
            )}

            {mode === 'signin' && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-control" value={password} autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
            )}

            {(mode === 'verify' || mode === 'reset' || mode === 'signup') && (
              <>
                <div className="form-group">
                  <label className="form-label">{mode === 'reset' ? 'New password' : 'Choose a password'}</label>
                  <input type="password" className="form-control" value={password} autoComplete="new-password"
                    onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm password</label>
                  <input type="password" className="form-control" value={confirm} autoComplete="new-password"
                    onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required />
                </div>
              </>
            )}

            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => go('signup')} style={{ padding: '2px 6px', fontSize: 'var(--text-xs)' }}>Forgot password?</button>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4 }} disabled={busy}>
              {busy ? <><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} /> Please wait…</>
                : mode === 'signin' ? <><i className="ti ti-login-2" /> Sign in</>
                : mode === 'signup' ? <><i className="ti ti-key" /> Set password & sign in</>
                : mode === 'code' ? <><i className="ti ti-mail" /> Send code</>
                : mode === 'verify' ? <><i className="ti ti-check" /> Verify & set password</>
                : <><i className="ti ti-check" /> Update password</>}
            </button>
          </form>

          <div className="muted" style={{ fontSize: 'var(--text-sm)', textAlign: 'center', marginTop: 'var(--space-5)' }}>
            {mode === 'signin' && <>First time here? <button type="button" className="btn btn-sm btn-ghost" onClick={() => go('signup')}>Set your password</button></>}
            {mode === 'signup' && <>Already set up? <button type="button" className="btn btn-sm btn-ghost" onClick={() => go('signin')}>Sign in</button></>}
            {(mode === 'code' || mode === 'verify') && <button type="button" className="btn btn-sm btn-ghost" onClick={() => go('signin')}><i className="ti ti-arrow-left" /> Back to sign in</button>}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
