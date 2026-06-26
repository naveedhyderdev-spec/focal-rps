import { Line } from 'react-chartjs-2';
import type { Scriptable, ScriptableLineSegmentContext, ScriptableContext } from 'chart.js';
import { cssVar, applyChartTheme } from '../../lib/charts';
import { useAppStore } from '../../store/appStore';

/**
 * Small-multiple utilization trend (DSU-2 §3.2): weekly util% line with a flat
 * 100% capacity reference. The line reddens above the over threshold and ambers
 * in the slight-over band, so over-utilisation is unmistakable.
 */
export function TrendMini({
  labels, values, peak, fullMax = 100, slightOverMax = 110, height = 200,
}: {
  labels: string[];
  values: (number | null)[];
  peak: number;
  fullMax?: number;
  slightOverMax?: number;
  height?: number;
}) {
  const theme = useAppStore((s) => s.resolvedTheme);
  applyChartTheme();
  const accent = cssVar('--brand-accent');
  const danger = cssVar('--color-danger');
  const warning = cssVar('--color-warning');
  const capLine = cssVar('--capacity-line');
  const over = peak > slightOverMax;

  const segColor: Scriptable<string, ScriptableLineSegmentContext> = (ctx) => {
    const y = ctx.p1?.parsed?.y ?? 0;
    if (y > slightOverMax) return danger;
    if (y > fullMax) return warning;
    return accent;
  };

  return (
    <div style={{ height }}>
      <Line
        key={theme}
        data={{
          labels,
          datasets: [
            {
              label: 'Utilization',
              data: values,
              borderColor: accent,
              borderWidth: 2,
              segment: { borderColor: segColor },
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 4,
              spanGaps: true,
              fill: true,
              backgroundColor: (ctx: ScriptableContext<'line'>) => {
                const { chart } = ctx; const { ctx: c, chartArea } = chart;
                if (!chartArea) return 'rgba(66,129,255,0.08)';
                const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                const base = over ? '226,96,79' : '66,129,255';
                g.addColorStop(0, `rgba(${base},0.20)`); g.addColorStop(1, `rgba(${base},0.01)`);
                return g;
              },
            },
            {
              label: 'Capacity (100%)',
              data: labels.map(() => 100),
              borderColor: capLine,
              borderDash: [5, 5],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label === 'Utilization' ? '' : ''}${Math.round(Number(c.parsed.y))}%` } },
          },
          scales: {
            y: { beginAtZero: true, suggestedMax: Math.max(120, Math.ceil(peak / 10) * 10 + 10), border: { display: false }, grid: { color: cssVar('--border-subtle') }, ticks: { font: { size: 10 }, maxTicksLimit: 4, callback: (v) => `${v}%` } },
            x: { border: { display: false }, grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
          },
        }}
      />
    </div>
  );
}
