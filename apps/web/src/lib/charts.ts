/**
 * Chart.js registration + theme. Defaults are read from semantic tokens via
 * cssVar() so charts match the active light/dark theme. Call applyChartTheme()
 * before a chart (re)mounts; chart components key on the resolved theme so they
 * remount and pick up fresh token colours when the theme flips (DSU-2 §2.5).
 */
import {
  Chart, ArcElement, BarElement, LineElement, PointElement,
  BarController, LineController, DoughnutController,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
} from 'chart.js';

Chart.register(
  ArcElement, BarElement, LineElement, PointElement,
  BarController, LineController, DoughnutController,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
);

/** Resolve a CSS custom-property to its computed colour for the active theme. */
export function cssVar(name: string): string {
  if (typeof document === 'undefined') return '#888';
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || '#888';
}

/** Push current theme tokens into Chart.js global defaults (idempotent). */
export function applyChartTheme(): void {
  Chart.defaults.color = cssVar('--gray-600');
  Chart.defaults.font.family = "'Montserrat', system-ui, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.borderColor = cssVar('--border-subtle');
  const t = Chart.defaults.plugins.tooltip;
  t.backgroundColor = cssVar('--surface-overlay');
  t.borderColor = cssVar('--border-default');
  t.borderWidth = 1;
  t.titleColor = cssVar('--gray-900');
  t.bodyColor = cssVar('--gray-800');
  t.padding = 10;
  t.cornerRadius = 6;
  t.displayColors = false;
}

// Initial application (browser only).
if (typeof document !== 'undefined') applyChartTheme();
