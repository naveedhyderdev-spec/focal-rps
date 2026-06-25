/**
 * Chart.js registration — imported once so charts work app-wide. Keeps the
 * registration in one place (Dashboard + Insights both rely on it).
 */
import {
  Chart, ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
} from 'chart.js';

Chart.register(
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
);

// Sleek, minimal dark defaults (Apple/Whoop-style): muted labels, hairline grid,
// Montserrat, restrained tooltips.
Chart.defaults.color = 'rgba(154,163,180,0.85)';
Chart.defaults.font.family = "'Montserrat', system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(38,38,46,0.96)';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.14)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = '#FFFFFF';
Chart.defaults.plugins.tooltip.bodyColor = '#DCE1EB';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 6;
Chart.defaults.plugins.tooltip.displayColors = false;

/** Resolve a CSS custom-property to its computed colour (Chart.js needs real values). */
export function cssVar(name: string): string {
  if (typeof document === 'undefined') return '#000';
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || '#000';
}
