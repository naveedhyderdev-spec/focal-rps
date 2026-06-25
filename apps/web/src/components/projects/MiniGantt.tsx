import { useMemo } from 'react';
import {
  daysBetween, parseISO, toISO, monthLabel, todayISO,
  type ProjectStage,
} from '@engine';
import type { Span, ResourceAssignment } from '../../lib/projects';
import { useReference } from '../../hooks/useReference';

function firstOfMonth(iso: string): string {
  const d = parseISO(iso);
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}
function addOneMonth(iso: string): string {
  const d = parseISO(iso);
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}

export function MiniGantt({
  span, stages, assignments,
}: {
  span: Span;
  stages: ProjectStage[];
  assignments: ResourceAssignment[];
}) {
  const ref = useReference();

  const model = useMemo(() => {
    if (!span.start || !span.end) return null;
    const total = Math.max(1, daysBetween(span.start, span.end));
    const pos = (iso: string) => Math.max(0, Math.min(100, (daysBetween(span.start!, iso) / total) * 100));
    const bar = (s: string, e: string) => {
      const left = pos(s);
      const right = pos(e);
      return { left, width: Math.max(1.5, right - left) };
    };
    const months: { label: string; left: number }[] = [];
    let m = firstOfMonth(span.start);
    let guard = 0;
    while (m <= span.end && guard < 60) {
      if (m >= span.start) months.push({ label: monthLabel(m), left: pos(m) });
      m = addOneMonth(m);
      guard++;
    }
    const today = todayISO();
    const todayLeft = today >= span.start && today <= span.end ? pos(today) : null;
    return { bar, months, todayLeft };
  }, [span]);

  if (!model) return <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>Add stages with dates to see the timeline.</div>;

  const Track = ({ children }: { children: React.ReactNode }) => (
    <div style={{ position: 'relative', height: 22, background: 'var(--gray-50)', borderRadius: 4 }}>
      {model.months.map((mo, i) => (
        <div key={i} style={{ position: 'absolute', left: `${mo.left}%`, top: 0, bottom: 0, width: 1, background: 'var(--gray-200)' }} />
      ))}
      {model.todayLeft != null && (
        <div style={{ position: 'absolute', left: `${model.todayLeft}%`, top: 0, bottom: 0, width: 2, background: 'var(--today-line)', zIndex: 2 }} />
      )}
      {children}
    </div>
  );

  const labelW = 150;

  return (
    <div>
      {/* Month axis */}
      <div className="row" style={{ marginBottom: 6 }}>
        <div style={{ width: labelW, flexShrink: 0 }} />
        <div style={{ position: 'relative', flex: 1, height: 16 }}>
          {model.months.map((mo, i) => (
            <span key={i} style={{ position: 'absolute', left: `${mo.left}%`, fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{mo.label}</span>
          ))}
        </div>
      </div>

      {/* Stage rows */}
      {stages.slice().sort((a, b) => a.start_date.localeCompare(b.start_date)).map((s) => {
        const b = model.bar(s.start_date, s.end_date);
        return (
          <div key={s.id} className="row" style={{ marginBottom: 4 }}>
            <div style={{ width: labelW, flexShrink: 0, fontSize: 'var(--text-xs)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.stage_name}</div>
            <div style={{ flex: 1 }}>
              <Track>
                <div title={`${s.stage_name}: ${s.start_date} → ${s.end_date}`} style={{
                  position: 'absolute', left: `${b.left}%`, width: `${b.width}%`, top: 4, height: 14,
                  background: 'var(--brand-primary)', borderRadius: 3, opacity: 0.85,
                }} />
              </Track>
            </div>
          </div>
        );
      })}

      {assignments.length > 0 && (
        <div style={{ borderTop: '1px solid var(--gray-200)', margin: '8px 0', paddingTop: 8 }}>
          <div className="muted" style={{ fontSize: 'var(--text-xs)', marginBottom: 6, marginLeft: 2 }}>Loaded resources</div>
          {assignments.map((a) => {
            const b = model.bar(a.start, a.end);
            const color = ref.disciplineById.get(a.resource.discipline_id ?? '')?.color ?? 'var(--gray-400)';
            return (
              <div key={a.resource.id} className="row" style={{ marginBottom: 4 }}>
                <div style={{ width: labelW, flexShrink: 0, fontSize: 'var(--text-xs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.resource.forename}</div>
                <div style={{ flex: 1 }}>
                  <Track>
                    <div title={`${a.resource.forename}: ${a.start} → ${a.end}`} style={{
                      position: 'absolute', left: `${b.left}%`, width: `${b.width}%`, top: 6, height: 10,
                      background: color, borderRadius: 3,
                    }} />
                  </Track>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
