import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Toaster } from '../ui/Toaster';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useSettings } from '../../hooks/useData';

export function Layout() {
  const { data: settings } = useSettings();
  const location = useLocation();
  const year = new Date().getFullYear();
  const version = settings?.version ?? '1.0.0';
  return (
    <div id="app">
      <Sidebar />
      <div id="main">
        <Topbar />
        <div id="content">
          {/* keyed by route so the boundary resets on navigation */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
        <footer className="app-footer">
          FOCAL Project Management — Resource Planning System · v{version} · {year}
        </footer>
      </div>
      <Toaster />
    </div>
  );
}
