import { NavLink } from 'react-router-dom';
import type { AppRole } from '@engine';
import { useAppStore } from '../../store/appStore';
import { useWarnings } from '../../hooks/useDerived';
import { can, roleLabel } from '../../lib/permissions';

interface NavEntry {
  to: string;
  label: string;
  icon: string;
  badge?: number;
  visible: (role: AppRole) => boolean;
}

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);
  const role = useAppStore((s) => s.role);
  const userName = useAppStore((s) => s.currentUserName);
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const warnings = useWarnings();
  // White wordmark on the dark sidebar; blue wordmark on the light sidebar.
  const logo = resolvedTheme === 'light' ? 'focal-logo-blue.png' : 'focal-logo-white.png';
  // Staff don't see conflict counts (read-only, scoped to their own view).
  const conflictCount = role === 'staff' ? 0 : warnings.length;

  // Two labelled groups (Donezo-style): core navigation, then admin/output tools.
  const menuItems: NavEntry[] = [
    { to: '/', label: 'Dashboard', icon: 'ti-home', visible: (r) => r !== 'staff' },
    { to: '/me', label: 'My Allocation', icon: 'ti-user-check', visible: (r) => can(r, 'view_own') },
    { to: '/projects', label: 'Projects', icon: 'ti-folder', visible: (r) => can(r, 'view') },
    { to: '/resources', label: 'People', icon: 'ti-users', visible: (r) => can(r, 'edit_employees') },
    { to: '/board', label: 'Allocation Board', icon: 'ti-layout-kanban', badge: conflictCount || undefined, visible: (r) => can(r, 'view') },
    { to: '/summary', label: 'Resource Summary', icon: 'ti-table', visible: (r) => can(r, 'view') },
    { to: '/graphs', label: 'Insights', icon: 'ti-chart-bar', visible: (r) => can(r, 'view') },
    { to: '/capacity', label: 'Capacity Planning', icon: 'ti-chart-arrows-vertical', visible: (r) => r !== 'staff' },
  ];
  const generalItems: NavEntry[] = [
    { to: '/reports', label: 'Reports', icon: 'ti-file-spreadsheet', visible: (r) => can(r, 'export') },
    { to: '/admin', label: 'Admin', icon: 'ti-settings', visible: (r) => can(r, 'access_admin') },
  ];
  const groups: { label: string; items: NavEntry[] }[] = [
    { label: 'Menu', items: menuItems },
    { label: 'General', items: generalItems },
  ];

  const renderItem = (it: NavEntry) => (
    <NavLink
      key={it.to}
      to={it.to}
      end={it.to === '/'}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      data-label={it.label}
    >
      <i className={`ti ${it.icon}`} />
      <span className="nav-item-label">{it.label}</span>
      {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
    </NavLink>
  );

  return (
    <nav id="sidebar" className={collapsed ? 'collapsed' : ''} aria-label="Main navigation">
      <div className="sidebar-logo">
        <img src={`${import.meta.env.BASE_URL}${logo}`} alt="Focal" className="sidebar-logo-img"
          style={{ height: 26, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        <div className="sidebar-logo-text">
          <div className="tagline" style={{ letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: '10px' }}>Resource Planning</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {groups.map((g) => {
          const visible = g.items.filter((it) => it.visible(role));
          if (!visible.length) return null;
          return (
            <div className="nav-group" key={g.label}>
              <div className="nav-section-label">{g.label}</div>
              {visible.map(renderItem)}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{userName.slice(0, 2).toUpperCase()}</div>
          <div className="sidebar-user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role">{roleLabel(role)}</div>
          </div>
        </div>
        <button className="sidebar-collapse-btn" onClick={toggle}>
          <i className={`ti ${collapsed ? 'ti-layout-sidebar-left-expand' : 'ti-layout-sidebar-left-collapse'}`} />
          <span>Collapse</span>
        </button>
      </div>
    </nav>
  );
}
