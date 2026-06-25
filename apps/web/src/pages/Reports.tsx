import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  factorsByResourceWeek, factorToPercent, factorToHours, buildDemandCapacity,
} from '@engine';
import { PageHeader } from '../components/ui/PageHeader';
import { resourcesH, projectsH, useAllocations, useSettings } from '../hooks/useData';
import { useReference } from '../hooks/useReference';
import { useHorizonWeeks } from '../hooks/useDerived';
import { downloadWorkbook, stampedName, type Cell } from '../lib/excel';
import { parseFocalWorkbook, commitImport, type ImportPreview } from '../lib/importer';
import { useAppStore } from '../store/appStore';
import { can } from '../lib/permissions';

export function Reports() {
  const { data: resources } = resourcesH.useList();
  const { data: projects } = projectsH.useList();
  const { data: allocations } = useAllocations();
  const { data: settings } = useSettings();
  const ref = useReference();
  const horizonWeeks = useHorizonWeeks();
  const role = useAppStore((s) => s.role);
  const toast = useAppStore((s) => s.toast);
  const qc = useQueryClient();

  const canExport = can(role, 'export');
  const canImport = can(role, 'manage_master_data');

  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);

  const cap = settings?.weekly_capacity_hours ?? 42.5;
  const factors = () => factorsByResourceWeek(allocations ?? []);

  const exportSummary = () => {
    const f = factors();
    const header: Cell[] = ['Resource', 'Team', 'Discipline', 'Grade', 'Location', ...horizonWeeks];
    const aoa: Cell[][] = [header];
    for (const r of resources ?? []) {
      aoa.push([
        r.full_name || r.forename,
        ref.teamById.get(r.team_id ?? '')?.name ?? '',
        ref.disciplineById.get(r.discipline_id ?? '')?.name ?? '',
        ref.gradeById.get(r.grade_id ?? '')?.name ?? '',
        ref.locationById.get(r.location_id ?? '')?.code ?? '',
        ...horizonWeeks.map((w) => Math.round(factorToPercent(f.get(r.id)?.get(w) ?? 0))),
      ]);
    }
    downloadWorkbook(stampedName('FOCAL_Resource_Summary'), [{ name: 'Summary', aoa }]);
    toast('Exported Resource Summary', 'success');
  };

  const exportAllocations = () => {
    const projById = new Map((projects ?? []).map((p) => [p.id, p]));
    const resById = new Map((resources ?? []).map((r) => [r.id, r]));
    const aoa: Cell[][] = [['Project', 'Resource', 'Discipline', 'Week', 'Allocation %', 'Weekly hours']];
    for (const a of (allocations ?? []).slice().sort((x, y) => x.week_start_date.localeCompare(y.week_start_date))) {
      const r = resById.get(a.resource_id);
      const p = projById.get(a.project_id);
      aoa.push([
        p?.code || p?.name || a.project_id,
        r?.full_name || r?.forename || a.resource_id,
        ref.disciplineById.get(r?.discipline_id ?? '')?.name ?? '',
        a.week_start_date,
        Math.round(factorToPercent(a.allocation_factor)),
        Math.round(factorToHours(a.allocation_factor, r?.weekly_capacity_hours ?? cap) * 100) / 100,
      ]);
    }
    downloadWorkbook(stampedName('FOCAL_Project_Allocations'), [{ name: 'Allocations', aoa }]);
    toast('Exported Project Allocations', 'success');
  };

  const exportCapacity = () => {
    const mk = (series: ReturnType<typeof buildDemandCapacity>): Cell[][] => {
      const aoa: Cell[][] = [['Group', 'Week', 'Demand (h)', 'Capacity (h)', 'Utilization %']];
      for (const s of series) for (const p of s.points) {
        aoa.push([s.groupName, p.week, Math.round(p.demandHours), Math.round(p.capacityHours), p.capacityHours > 0 ? Math.round((p.demandHours / p.capacityHours) * 100) : 0]);
      }
      return aoa;
    };
    const teams = buildDemandCapacity(resources ?? [], allocations ?? [], horizonWeeks, (r) => r.team_id, (id) => ref.teamById.get(id)?.name ?? 'Unassigned');
    const disc = buildDemandCapacity(resources ?? [], allocations ?? [], horizonWeeks, (r) => r.discipline_id, (id) => ref.disciplineById.get(id)?.name ?? 'General');
    downloadWorkbook(stampedName('FOCAL_Capacity_Report'), [{ name: 'By Team', aoa: mk(teams) }, { name: 'By Discipline', aoa: mk(disc) }]);
    toast('Exported Capacity Report', 'success');
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const p = parseFocalWorkbook(buf);
      setPreview(p);
      toast(`Parsed: ${p.counts.people} people, ${p.counts.projects} projects, ${p.counts.allocations} allocations`, 'success');
    } catch (err) {
      toast(`Could not parse workbook: ${(err as Error).message}`, 'danger');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doCommit = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const { created } = await commitImport(preview);
      await qc.invalidateQueries();
      toast(`Imported ${created.resources} people, ${created.projects} projects, ${created.allocations} allocations`, 'success');
      setPreview(null);
    } catch (err) {
      toast(`Import failed: ${(err as Error).message}`, 'danger');
    } finally {
      setImporting(false);
    }
  };

  const EXPORTS = [
    { title: 'Resource Summary', desc: 'Weekly utilization % per resource across the full horizon.', icon: 'ti-table', fn: exportSummary },
    { title: 'Project Allocations', desc: 'Every allocation row: project, resource, week, % and hours.', icon: 'ti-list-details', fn: exportAllocations },
    { title: 'Capacity Report', desc: 'Demand vs capacity per week, by team and by discipline.', icon: 'ti-chart-area', fn: exportCapacity },
  ];

  return (
    <div className="page-container">
      <PageHeader title="Reports" subtitle="Excel export & live-workbook import (V1 — no PDF)" />

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-header"><div className="card-title">Excel exports</div></div>
        <div className="card-body">
          {!canExport && <div className="alert alert-warning" style={{ marginBottom: 12 }}><i className="ti ti-lock" /> Your role can't export. Switch to Planner or Admin.</div>}
          <div className="dashboard-grid-3">
            {EXPORTS.map((x) => (
              <div key={x.title} className="metric-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="row" style={{ gap: 8 }}><i className={`ti ${x.icon}`} style={{ fontSize: 20, color: 'var(--brand-accent)' }} /><strong style={{ color: 'var(--gray-900)' }}>{x.title}</strong></div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)', flex: 1 }}>{x.desc}</div>
                <button className="btn btn-primary btn-sm" disabled={!canExport} onClick={x.fn}><i className="ti ti-download" /> Export .xlsx</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Import live workbook</div></div>
        <div className="card-body">
          <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 12 }}>
            Bulk-load an existing <strong>Focal Resource Forecast</strong> workbook. The importer reads the
            <em> Staff Names</em> and <em>Project Resource</em> sheets, shows a dry-run preview, then writes people, projects, stages and allocations. Nothing is committed until you confirm.
          </p>
          {!canImport ? (
            <div className="alert alert-warning"><i className="ti ti-lock" /> Importing master data requires the Admin role.</div>
          ) : (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFile} style={{ display: 'none' }} />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={() => fileRef.current?.click()}><i className="ti ti-upload" /> Choose workbook (.xlsx)</button>
              </div>

              {preview && (
                <div style={{ marginTop: 'var(--space-5)' }}>
                  <div className="metric-grid metric-grid-5" style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    {Object.entries(preview.counts).map(([k, v]) => (
                      <div key={k} className="metric-card" style={{ padding: 'var(--space-3)' }}>
                        <div className="metric-label" style={{ textTransform: 'capitalize' }}>{k}</div>
                        <div className="metric-value" style={{ fontSize: 'var(--text-xl)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {preview.warnings.length > 0 && (
                    <div className="alert alert-warning" style={{ marginBottom: 12, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                      {preview.warnings.map((w, i) => <div key={i}><i className="ti ti-alert-triangle" /> {w}</div>)}
                    </div>
                  )}
                  <div className="alert alert-info" style={{ marginBottom: 12 }}>
                    <i className="ti ti-info-circle" /> Dry-run only. Weeks span {preview.weeks[0]} → {preview.weeks[preview.weeks.length - 1]}. Review the counts, then commit.
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-primary" disabled={importing} onClick={doCommit}><i className="ti ti-database-import" /> Commit import</button>
                    <button className="btn" disabled={importing} onClick={() => setPreview(null)}>Discard</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
