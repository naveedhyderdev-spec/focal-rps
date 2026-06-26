import { useAppStore } from '../../store/appStore';

/**
 * Light/Dark theme toggle (DSU-2 §2.3). A quiet 2-segment control reusing the
 * .view-toggle pattern. Default is OS preference until the user picks explicitly.
 */
export function ThemeToggle() {
  const resolved = useAppStore((s) => s.resolvedTheme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="view-toggle theme-toggle" role="radiogroup" aria-label="Colour theme" title="Toggle light / dark theme">
      <button
        className={`view-toggle-btn${resolved === 'light' ? ' active' : ''}`}
        role="radio" aria-checked={resolved === 'light'} aria-label="Light theme"
        onClick={() => setTheme('light')}
      >
        <i className="ti ti-sun" />
      </button>
      <button
        className={`view-toggle-btn${resolved === 'dark' ? ' active' : ''}`}
        role="radio" aria-checked={resolved === 'dark'} aria-label="Dark theme"
        onClick={() => setTheme('dark')}
      >
        <i className="ti ti-moon" />
      </button>
    </div>
  );
}
