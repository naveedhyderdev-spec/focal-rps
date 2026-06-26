import { Doughnut } from 'react-chartjs-2';
import { cssVar, applyChartTheme } from '../../lib/charts';
import { useAppStore } from '../../store/appStore';

export function UtilDonut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const theme = useAppStore((s) => s.resolvedTheme);
  applyChartTheme();
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) return <div className="muted" style={{ fontSize: 'var(--text-sm)', padding: 12 }}>No allocations to chart.</div>;
  return (
    <Doughnut
      key={theme}
      data={{
        labels: filtered.map((d) => d.label),
        datasets: [{
          data: filtered.map((d) => Math.round(d.value)),
          backgroundColor: filtered.map((d) => d.color),
          borderWidth: 3,
          borderColor: cssVar('--surface-card'),
          hoverOffset: 6,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, padding: 12 } },
          tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} h` } },
        },
      }}
    />
  );
}
