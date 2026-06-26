import { Chart } from 'react-chartjs-2';
import type { ScriptableContext } from 'chart.js';
import { cssVar, applyChartTheme } from '../../lib/charts';
import { useAppStore } from '../../store/appStore';

export interface CapacityPoint {
  label: string;
  available: number;   // real capacity hours
  allocated: number;   // booked hours
  required: number;    // required hours (target)
  gap: number;         // available − required (negative = shortage)
}

/**
 * Supply-vs-demand chart (DSU-2 §3.1): Available (area), Allocated (bars),
 * Required (dashed line), Gap/Surplus (bars from baseline, red below / green above).
 */
export function CapacityPlanChart({ points, height = 300 }: { points: CapacityPoint[]; height?: number }) {
  const theme = useAppStore((s) => s.resolvedTheme);
  applyChartTheme();
  const accent = cssVar('--brand-accent');
  const primary = cssVar('--brand-primary');
  const warning = cssVar('--color-warning');
  const danger = cssVar('--color-danger');
  const success = cssVar('--color-success');

  return (
    <div style={{ height }}>
      <Chart
        key={theme}
        type="bar"
        data={{
          labels: points.map((p) => p.label),
          datasets: [
            {
              type: 'line' as const, label: 'Available', data: points.map((p) => Math.round(p.available)),
              borderColor: accent, borderWidth: 2, tension: 0.35, pointRadius: 0, pointHoverRadius: 4, fill: true, order: 3,
              backgroundColor: (ctx: ScriptableContext<'line'>) => {
                const { chart } = ctx; const { ctx: c, chartArea } = chart;
                if (!chartArea) return 'rgba(66,129,255,0.10)';
                const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                g.addColorStop(0, 'rgba(66,129,255,0.22)'); g.addColorStop(1, 'rgba(66,129,255,0.01)');
                return g;
              },
            },
            { type: 'bar' as const, label: 'Allocated', data: points.map((p) => Math.round(p.allocated)), backgroundColor: primary, borderRadius: 6, borderSkipped: false, barPercentage: 0.55, categoryPercentage: 0.6, order: 2 },
            { type: 'line' as const, label: 'Required', data: points.map((p) => Math.round(p.required)), borderColor: warning, borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false, tension: 0, order: 1 },
            {
              type: 'bar' as const, label: 'Gap', data: points.map((p) => Math.round(p.gap)), borderRadius: 6, borderSkipped: false, barPercentage: 0.55, categoryPercentage: 0.6, order: 4,
              backgroundColor: points.map((p) => (p.gap < 0 ? danger : success)),
            },
          ],
        }}
        options={{
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded', font: { size: 11 }, padding: 14 } },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${Math.round(Number(c.parsed.y))} h` } },
          },
          scales: {
            y: { beginAtZero: false, border: { display: false }, grid: { color: cssVar('--border-subtle') }, ticks: { font: { size: 10 }, callback: (v) => `${v}h` } },
            x: { border: { display: false }, grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
          },
        }}
      />
    </div>
  );
}
