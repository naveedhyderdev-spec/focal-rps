import type { ReactNode } from 'react';

export function PageHeader({
  title, subtitle, children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {children && <div className="page-header-right">{children}</div>}
    </div>
  );
}
