import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';

export function NotFound() {
  return (
    <div className="page-container">
      <div className="card"><div className="card-body">
        <EmptyState
          icon="ti-map-search"
          title="Page not found"
          message="That route doesn't exist."
          action={<Link to="/" className="btn btn-primary">Go to Dashboard</Link>}
        />
      </div></div>
    </div>
  );
}
