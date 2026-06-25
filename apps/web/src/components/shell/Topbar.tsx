import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppRole } from '@engine';
import { useAppStore } from '../../store/appStore';
import { useWarnings } from '../../hooks/useDerived';
import { usersH } from '../../hooks/useData';
import { ALL_ROLES, roleLabel } from '../../lib/permissions';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/me': 'My Allocation',
  '/projects': 'Projects',
  '/resources': 'People',
  '/board': 'Allocation Board',
  '/summary': 'Resource Summary',
  '/graphs': 'Insights',
  '/reports': 'Reports',
  '/admin': 'Admin',
  '/search': 'Search',
};

const SEVERITY_ICON: Record<string, string> = {
  danger: 'ti-alert-circle',
  warning: 'ti-alert-triangle',
  info: 'ti-info-circle',
};

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const setUser = useAppStore((s) => s.setUser);
  const userName = useAppStore((s) => s.currentUserName);
  const warnings = useWarnings();
  const { data: users } = usersH.useList();

  /** Dev "view as role": adopt a representative seeded account so the experience
   *  (name, linked resource for Staff, landing page) matches the role. */
  const switchRole = (r: AppRole) => {
    const u = (users ?? []).find((x) => x.role === r && x.status === 'Active');
    if (u) setUser({ id: u.id, name: u.name, role: r, resourceId: u.resource_id });
    else setRole(r);
    setOpenMenu(null);
    navigate(r === 'staff' ? '/me' : '/');
  };

  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<'notif' | 'user' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const title = TITLES[location.pathname]
    ?? (location.pathname.startsWith('/projects/') ? 'Project Details' : 'FOCAL');

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <header id="topbar" ref={ref}>
      <div className="topbar-breadcrumb">
        <span className="crumb">FOCAL</span>
        <span className="sep">/</span>
        <span className="crumb current">{title}</span>
      </div>

      <form className="topbar-search" onSubmit={submitSearch}>
        <i className="ti ti-search topbar-search-icon" />
        <input
          type="text"
          placeholder="Search people, projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="search-kbd">↵</span>
      </form>

      <div className="topbar-actions">
        {/* Notifications */}
        <div className="dropdown">
          <button
            className="topbar-btn"
            title="Notifications"
            onClick={() => setOpenMenu(openMenu === 'notif' ? null : 'notif')}
          >
            <i className="ti ti-bell" />
            {warnings.length > 0 && <span className="notif-count">{warnings.length}</span>}
          </button>
          <div className={`dropdown-menu${openMenu === 'notif' ? ' open' : ''}`} style={{ minWidth: 320, maxHeight: 420, overflowY: 'auto' }}>
            <div style={{ padding: '10px 16px', fontWeight: 600, borderBottom: '1px solid var(--gray-100)' }}>
              Notifications ({warnings.length})
            </div>
            {warnings.length === 0 ? (
              <div className="dropdown-item" style={{ color: 'var(--gray-400)' }}>No active warnings 🎉</div>
            ) : (
              warnings.slice(0, 12).map((w, i) => (
                <div key={i} className="dropdown-item" style={{ alignItems: 'flex-start', cursor: 'pointer' }}
                  onClick={() => { setOpenMenu(null); navigate(w.entity === 'project' ? `/projects/${w.entityId}` : '/board'); }}>
                  <i className={`ti ${SEVERITY_ICON[w.severity]}`} style={{ color: `var(--color-${w.severity})` }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{w.title}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{w.detail}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="topbar-divider" />

        {/* User menu + role switcher (frontend-first auth stand-in) */}
        <div className="dropdown">
          <button className="topbar-btn" title="Account" onClick={() => setOpenMenu(openMenu === 'user' ? null : 'user')}>
            <i className="ti ti-user" />
          </button>
          <div className={`dropdown-menu${openMenu === 'user' ? ' open' : ''}`}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ fontWeight: 600 }}>{userName}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{roleLabel(role)}</div>
            </div>
            <div style={{ padding: '8px 16px' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginBottom: 6 }}>View as role</div>
              {ALL_ROLES.map((r) => (
                <button
                  key={r}
                  className={`btn btn-sm${role === r ? ' btn-primary' : ''}`}
                  style={{ marginRight: 4, marginBottom: 4 }}
                  onClick={() => switchRole(r)}
                >
                  {roleLabel(r)}
                </button>
              ))}
            </div>
            <div className="dropdown-divider" />
            <div className="dropdown-item danger"><i className="ti ti-logout" /> Sign out</div>
          </div>
        </div>
      </div>
    </header>
  );
}
