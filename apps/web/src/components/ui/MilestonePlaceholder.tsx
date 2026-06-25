import { PageHeader } from './PageHeader';

export function MilestonePlaceholder({
  title, subtitle, milestone, points,
}: {
  title: string;
  subtitle?: string;
  milestone: string;
  points: string[];
}) {
  return (
    <div className="page-container">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="card">
        <div className="card-body">
          <div className="badge badge-blue" style={{ marginBottom: 12 }}>
            <i className="ti ti-tools" /> {milestone}
          </div>
          <p className="muted" style={{ marginBottom: 12 }}>
            This screen is scaffolded and routed. Full functionality lands in the milestone above.
            Planned in this view:
          </p>
          <ul style={{ paddingLeft: 18, listStyle: 'disc', color: 'var(--gray-600)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
