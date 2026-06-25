import type { Discipline } from '@engine';

export function DisciplineTag({ discipline }: { discipline?: Discipline }) {
  if (!discipline) return <span className="muted">—</span>;
  return (
    <span className="row" style={{ gap: 6, whiteSpace: 'nowrap' }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: discipline.color, display: 'inline-block', flexShrink: 0,
      }} />
      {discipline.name}
    </span>
  );
}
