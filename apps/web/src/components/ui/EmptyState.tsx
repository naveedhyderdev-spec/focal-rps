import type { ReactNode } from 'react';

export function EmptyState({
  icon = 'ti-inbox', title, message, action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <i className={`ti ${icon}`} />
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
