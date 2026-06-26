import { useEffect, useRef, useState } from 'react';
import type { RealCapacity } from '@engine';
import { fmtHours } from '../../lib/format';

/**
 * Dynamic-capacity indicator (DSU-2 §3.4). Shows an ⓘ that opens a breakdown
 * popover (nominal − leave − holiday = real) and, when capacity is reduced this
 * period, an amber "−Xh" chip. Reusable anywhere a capacity figure appears.
 */
export function RealCapacityIndicator({
  breakdown, onLeave, holidayDays,
}: {
  breakdown: RealCapacity;
  onLeave: number;
  holidayDays: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const reduction = breakdown.leaveCutHours + breakdown.holidayCutHours;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <span className="row" style={{ gap: 6, position: 'relative' }} ref={ref}>
      <button
        type="button"
        aria-label="Real capacity breakdown"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--gray-400)', display: 'inline-flex' }}
        onMouseEnter={() => setOpen(true)}
      >
        <i className="ti ti-info-circle" style={{ fontSize: 14 }} />
      </button>
      {reduction > 0 && (
        <span className="badge badge-amber" title="Capacity reduced by leave / holidays this period" style={{ fontSize: 'var(--text-xs)' }}>
          <i className="ti ti-calendar-minus" style={{ fontSize: 12 }} /> −{fmtHours(reduction)}
        </span>
      )}
      {open && (
        <div className="dropdown-menu open" role="tooltip" style={{ left: 0, right: 'auto', top: 'calc(100% + 6px)', minWidth: 280, padding: '12px 14px' }}>
          <div style={{ fontWeight: 600, color: 'var(--gray-900)', marginBottom: 8 }}>Real capacity this period</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 5, fontSize: 'var(--text-sm)' }}>
            <span className="muted">Nominal</span><span className="text-right">{fmtHours(breakdown.nominalHours)}</span>
            <span style={{ color: 'var(--color-warning)' }}>− Leave ({onLeave})</span><span className="text-right" style={{ color: 'var(--color-warning)' }}>−{fmtHours(breakdown.leaveCutHours)}</span>
            <span style={{ color: 'var(--color-warning)' }}>− Holidays ({holidayDays}d)</span><span className="text-right" style={{ color: 'var(--color-warning)' }}>−{fmtHours(breakdown.holidayCutHours)}</span>
            <span style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--gray-200)', margin: '4px 0' }} />
            <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Real capacity</span>
            <span className="text-right" style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmtHours(breakdown.realHours)}</span>
          </div>
          <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 8 }}>Reduced by approved leave and public holidays.</div>
        </div>
      )}
    </span>
  );
}
