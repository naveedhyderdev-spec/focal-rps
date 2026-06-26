/**
 * Theme system (DSU-2 §2). Persists a mode in localStorage and applies the
 * resolved theme via a data-theme attribute on <html>. Pure presentation —
 * no engine/data impact.
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'focal-theme';

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* private mode */ }
  return 'system';
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true;
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** Apply a mode to <html>, persist it, and return the resolved theme. */
export function applyTheme(mode: ThemeMode, animate = false): ResolvedTheme {
  const resolved = resolveTheme(mode);
  const el = document.documentElement;
  if (animate && !prefersReducedMotion()) {
    el.classList.add('theme-anim');
    window.setTimeout(() => el.classList.remove('theme-anim'), 260);
  }
  el.setAttribute('data-theme', resolved);
  try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
  return resolved;
}
