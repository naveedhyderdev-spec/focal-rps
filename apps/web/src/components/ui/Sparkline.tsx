/** Tiny inline SVG sparkline (no chart lib needed). */
export function Sparkline({
  values, width = 90, height = 24, color = 'var(--brand-accent)', max,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  max?: number;
}) {
  if (values.length === 0) return null;
  const hi = max ?? Math.max(100, ...values);
  const lo = 0;
  const span = hi - lo || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - lo) / span) * height;
    return `${x.toFixed(1)},${Math.max(1, Math.min(height - 1, y)).toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* 100% reference */}
      <line x1={0} x2={width} y1={height - (100 / span) * height} y2={height - (100 / span) * height}
        stroke="var(--gray-200)" strokeWidth={1} strokeDasharray="2 2" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
