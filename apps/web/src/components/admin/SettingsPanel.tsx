import { useEffect, useState } from 'react';
import type { AppSettings, WeekStartDay } from '@engine';
import { Field, Select } from '../ui/Field';
import { useSettings, useSaveSettings } from '../../hooks/useData';
import { useAppStore } from '../../store/appStore';
import { classifyBand } from '@engine';

const WEEK_DAYS = [
  { value: '6', label: 'Saturday (matches workbook)' },
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
];

export function SettingsPanel() {
  const { data: settings } = useSettings();
  const saveSettings = useSaveSettings();
  const toast = useAppStore((s) => s.toast);
  const [draft, setDraft] = useState<AppSettings | null>(null);

  useEffect(() => { if (settings) setDraft(settings); }, [settings]);
  if (!draft) return null;

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setDraft({ ...draft, [k]: v });
  const setT = (k: keyof AppSettings['util_thresholds'], v: number) =>
    setDraft({ ...draft, util_thresholds: { ...draft.util_thresholds, [k]: v } });

  const save = async () => {
    try { await saveSettings.mutateAsync(draft); toast('Settings saved', 'success'); }
    catch (e) { toast((e as Error).message, 'danger'); }
  };

  const t = draft.util_thresholds;
  const bandPreview = [0, 85, 95, 105, 130].map((p) => ({ p, band: classifyBand(p, t) }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div className="card">
        <div className="card-header"><div className="card-title">Capacity & calendar</div></div>
        <div className="card-body">
          <div className="form-row-3">
            <Field label="Weekly capacity (hours)" hint="100% = this many hours">
              <input type="number" step="0.5" className="form-control" value={draft.weekly_capacity_hours} onChange={(e) => set('weekly_capacity_hours', Number(e.target.value))} />
            </Field>
            <Field label="Week starts on">
              <Select value={String(draft.week_start_day)} onChange={(v) => set('week_start_day', Number(v) as WeekStartDay)} options={WEEK_DAYS} />
            </Field>
            <Field label="Planner start date">
              <input type="date" className="form-control" value={draft.planner_start} onChange={(e) => set('planner_start', e.target.value)} />
            </Field>
          </div>
          <div className="form-row-3">
            <Field label="Horizon (months)">
              <input type="number" className="form-control" value={draft.horizon_months} onChange={(e) => set('horizon_months', Number(e.target.value))} />
            </Field>
            <Field label="App version">
              <input className="form-control" value={draft.version} onChange={(e) => set('version', e.target.value)} />
            </Field>
            <div />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Utilization thresholds & warnings</div></div>
        <div className="card-body">
          <div className="form-row-3">
            <Field label="Under-utilized up to %" hint="Blue band ceiling"><input type="number" className="form-control" value={t.underMax} onChange={(e) => setT('underMax', Number(e.target.value))} /></Field>
            <Field label="Moderate up to %" hint="Lavender ceiling"><input type="number" className="form-control" value={t.moderateMax} onChange={(e) => setT('moderateMax', Number(e.target.value))} /></Field>
            <Field label="Fully utilized up to %" hint="Green ceiling"><input type="number" className="form-control" value={t.fullMax} onChange={(e) => setT('fullMax', Number(e.target.value))} /></Field>
          </div>
          <div className="form-row-3">
            <Field label="Slightly over up to %" hint="Orange ceiling; above is red"><input type="number" className="form-control" value={t.slightOverMax} onChange={(e) => setT('slightOverMax', Number(e.target.value))} /></Field>
            <Field label="Over-allocation flag %" hint="Weeks above this are flagged"><input type="number" className="form-control" value={draft.overalloc_threshold} onChange={(e) => set('overalloc_threshold', Number(e.target.value))} /></Field>
            <Field label="Bench / gap threshold %" hint="Active staff below this = a gap"><input type="number" className="form-control" value={draft.bench_threshold} onChange={(e) => set('bench_threshold', Number(e.target.value))} /></Field>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>Preview:</span>
            {bandPreview.map(({ p, band }) => (
              <span key={p} className={`badge util-cell-${band}`}>{p}%</span>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Access</div></div>
        <div className="card-body">
          <label className="row" style={{ gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={draft.master_data_admin_editable} onChange={(e) => set('master_data_admin_editable', e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              <div style={{ fontWeight: 500, color: 'var(--gray-900)' }}>Admins can edit master data</div>
              <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>When off, only the Master Admin can manage teams, disciplines, grades, locations, stages and holidays. Master-Admin-only settings (this page, users) are always restricted to you.</div>
            </span>
          </label>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={saveSettings.isPending}><i className="ti ti-device-floppy" /> Save settings</button>
      </div>
    </div>
  );
}
