import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { MasterEditor, type FieldDef } from '../components/admin/MasterEditor';
import { SettingsPanel } from '../components/admin/SettingsPanel';
import { UserManagement } from '../components/admin/UserManagement';
import { provider } from '../data';
import {
  resourcesH, projectsH, useAllocations,
  locationsH, disciplinesH, teamsH, gradesH, stageTypesH, projectTypesH, holidaysH, useSettings,
} from '../hooks/useData';
import { useAppStore } from '../store/appStore';
import { can, canManageMasterData, roleLabel } from '../lib/permissions';

type Tab = 'settings' | 'teams' | 'disciplines' | 'grades' | 'locations' | 'stages' | 'projectTypes' | 'holidays' | 'users' | 'data';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'settings', label: 'Settings', icon: 'ti-adjustments' },
  { key: 'users', label: 'Users', icon: 'ti-user-shield' },
  { key: 'teams', label: 'Teams', icon: 'ti-users-group' },
  { key: 'disciplines', label: 'Disciplines', icon: 'ti-stack-2' },
  { key: 'grades', label: 'Grades', icon: 'ti-award' },
  { key: 'locations', label: 'Locations', icon: 'ti-map-pin' },
  { key: 'stages', label: 'Stages', icon: 'ti-timeline' },
  { key: 'projectTypes', label: 'Project Types', icon: 'ti-category' },
  { key: 'holidays', label: 'Holidays', icon: 'ti-calendar-off' },
  { key: 'data', label: 'Demo data', icon: 'ti-database' },
];

const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function Admin() {
  const role = useAppStore((s) => s.role);
  const toast = useAppStore((s) => s.toast);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('settings');
  const [busy, setBusy] = useState(false);

  const { data: settings } = useSettings();
  const { data: locations } = locationsH.useList();
  const counts = {
    resources: resourcesH.useList().data?.length ?? 0,
    projects: projectsH.useList().data?.length ?? 0,
    allocations: useAllocations().data?.length ?? 0,
  };

  const masterDataEditable = settings?.master_data_admin_editable ?? true;
  const canMasterData = canManageMasterData(role, masterDataEditable);

  const tabAllowed = (k: Tab): boolean => {
    switch (k) {
      case 'settings': return can(role, 'system_settings');
      case 'users': return can(role, 'manage_users');
      case 'data': return can(role, 'manage_master_data');
      default: return canMasterData; // teams/disciplines/grades/locations/stages/holidays
    }
  };
  const visibleTabs = TABS.filter((t) => tabAllowed(t.key));
  const activeTab: Tab | undefined = tabAllowed(tab) ? tab : visibleTabs[0]?.key;

  const locationOptions = useMemo(
    () => [{ value: '', label: 'All locations' }, ...(locations ?? []).map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))],
    [locations],
  );

  if (!can(role, 'access_admin')) {
    return (
      <div className="page-container">
        <PageHeader title="Admin" />
        <div className="card"><div className="card-body">
          <EmptyState icon="ti-lock" title="Admin access required"
            message={`Your role (${roleLabel(role)}) cannot access the Admin area.`} />
        </div></div>
      </div>
    );
  }

  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true);
    try { await fn(); await qc.invalidateQueries(); toast(msg, 'success'); }
    catch (e) { toast(`Failed: ${(e as Error).message}`, 'danger'); }
    finally { setBusy(false); }
  };

  const teamFields: FieldDef[] = [{ key: 'name', label: 'Team name', type: 'text', required: true }, { key: 'is_active', label: 'Active', type: 'toggle', default: true }];
  const discFields: FieldDef[] = [{ key: 'name', label: 'Discipline', type: 'text', required: true }, { key: 'color', label: 'Colour', type: 'color', default: 'var(--disc-mech)' }, { key: 'sort_order', label: 'Order', type: 'number', width: '80px' }, { key: 'is_active', label: 'Active', type: 'toggle', default: true }];
  const gradeFields: FieldDef[] = [{ key: 'name', label: 'Grade', type: 'text', required: true }, { key: 'discipline_category', label: 'Category', type: 'text', placeholder: 'M / E / PH / GET' }, { key: 'sort_order', label: 'Order', type: 'number', width: '80px' }];
  const locFields: FieldDef[] = [{ key: 'code', label: 'Code', type: 'text', required: true, width: '90px' }, { key: 'name', label: 'Name', type: 'text', required: true }, { key: 'is_active', label: 'Active', type: 'toggle', default: true }];
  const stageFields: FieldDef[] = [{ key: 'name', label: 'Stage name', type: 'text', required: true }, { key: 'sort_order', label: 'Order', type: 'number', width: '80px' }, { key: 'is_active', label: 'Active', type: 'toggle', default: true }];
  const projectTypeFields: FieldDef[] = [{ key: 'name', label: 'Type', type: 'text', required: true }, { key: 'sort_order', label: 'Order', type: 'number', width: '80px' }, { key: 'is_active', label: 'Active', type: 'toggle', default: true }];
  const holidayFields: FieldDef[] = [{ key: 'date', label: 'Date', type: 'date', required: true, width: '140px' }, { key: 'name', label: 'Holiday', type: 'text', required: true }, { key: 'location_id', label: 'Applies to', type: 'select', options: locationOptions, default: '' }];

  return (
    <div className="page-container">
      <PageHeader title={role === 'master_admin' ? 'Admin — Master' : 'Admin'} subtitle="Master data, users & settings" />

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="tabs" style={{ overflowX: 'auto' }}>
          {visibleTabs.map((t) => (
            <button key={t.key} className={`tab-btn${activeTab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              <i className={`ti ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'settings' && <SettingsPanel />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'teams' && <MasterEditor title="Teams" hooks={teamsH} fields={teamFields} sortBy={byName} />}
      {activeTab === 'disciplines' && <MasterEditor title="Disciplines" description="Colour drives chips, bars and charts across the app." hooks={disciplinesH} fields={discFields} sortBy={bySortOrder} />}
      {activeTab === 'grades' && <MasterEditor title="Grades" hooks={gradesH} fields={gradeFields} sortBy={bySortOrder} />}
      {activeTab === 'locations' && <MasterEditor title="Locations" hooks={locationsH} fields={locFields} sortBy={(a, b) => a.code.localeCompare(b.code)} labelField="code" />}
      {activeTab === 'stages' && <MasterEditor title="Project Stages" description="Master list of stage names used in the project stage builder." hooks={stageTypesH} fields={stageFields} sortBy={bySortOrder} />}
      {activeTab === 'projectTypes' && <MasterEditor title="Project Types" description="The Type options shown when creating or editing a project." hooks={projectTypesH} fields={projectTypeFields} sortBy={bySortOrder} />}
      {activeTab === 'holidays' && <MasterEditor title="Public Holidays" description="Holiday dates render with pink shading on the Allocation Board. Leave 'Applies to' as All for global holidays." hooks={holidaysH} fields={holidayFields} sortBy={(a, b) => a.date.localeCompare(b.date)} labelField="name" />}

      {activeTab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Data overview</div></div>
            <div className="card-body">
              <div className="metric-grid metric-grid-3" style={{ gap: 'var(--space-3)' }}>
                {Object.entries(counts).map(([k, v]) => (
                  <div key={k} className="metric-card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div className="metric-label" style={{ textTransform: 'capitalize' }}>{k}</div>
                    <div className="metric-value" style={{ fontSize: 'var(--text-xl)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Demo data</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="muted">The system is fully data-driven. Placeholder records exist only so screens aren't empty during development — wipe them in one click to leave a clean production-ready instance.</p>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary" disabled={busy} onClick={() => run(() => provider.seedDemoData(), 'Demo data loaded')}><i className="ti ti-database-import" /> Load demo data</button>
                <button className="btn btn-danger" disabled={busy} onClick={() => run(() => provider.resetDemoData(), 'Demo data cleared')}><i className="ti ti-trash" /> Reset / clear demo data</button>
                <button className="btn" disabled={busy} onClick={() => run(() => provider.clearAll(), 'All data wiped')}><i className="ti ti-eraser" /> Wipe everything</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
