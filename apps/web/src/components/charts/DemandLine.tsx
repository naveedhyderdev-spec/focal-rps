import { Line } from 'react-chartjs-2';
import type { ScriptableContext } from 'chart.js';
import { cssVar } from '../../lib/charts';

/**
 * Demand vs capacity over time — sleek, minimal (Apple/Whoop style): thin lines,
 * soft gradient fill, hairline grid, the capacity reference as a light dashed line.
 */
export function DemandLine({
  labels, demand, capacity, height = 230,
}: {
  labels: string[];
  demand: number[];
  capacity: number[];
  height?: number;
}) {
  const accent = cssVar('--brand-accent');
  const capLine = cssVar('--capacity-line');

  return (
    <div style={{ height }}>
      <Line
        data={{
          labels,
          datasets: [
            {
              label: 'Demand',
              data: demand,
              borderColor: accent,
              borderWidth: 2,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: accent,
              fill: true,
              backgroundColor: (ctx: ScriptableContext<'line'>) => {
                const { chart } = ctx;
                const { ctx: c, chartArea } = chart;
                if (!chartArea) return 'rgba(66,129,255,0.10)';
                const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                g.addColorStop(0, 'rgba(66,129,255,0.28)');
                g.addColorStop(1, 'rgba(66,129,255,0.01)');
                return g;
              },
            },
            {
              label: 'Capacity',
              data: capacity,
              borderColor: capLine,
              borderDash: [5, 5],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              tension: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, padding: 16 } },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${Math.round(Number(c.parsed.y))} h` } },
          },
          scales: {
            y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 10 }, maxTicksLimit: 5 } },
            x: { border: { display: false }, grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          },
        }}
      />
    </div>
  );
}
