/**
 * Display helpers: utilization band classes, formatting, status chips.
 */
import { classifyBand, type UtilBand, type UtilThresholds, type ResourceStatus } from '@engine';

export function bandClass(percent: number, thresholds?: UtilThresholds): UtilBand {
  return classifyBand(percent, thresholds);
}

export function utilTextClass(percent: number, thresholds?: UtilThresholds): string {
  return `util-${bandClass(percent, thresholds)}`;
}

export function utilCellClass(percent: number, thresholds?: UtilThresholds): string {
  return `util-cell-${bandClass(percent, thresholds)}`;
}

export function fmtPercent(percent: number, decimals = 0): string {
  if (!Number.isFinite(percent)) return '—';
  return `${percent.toFixed(decimals)}%`;
}

export function fmtHours(hours: number): string {
  if (!Number.isFinite(hours)) return '—';
  const r = Math.round(hours * 100) / 100;
  return `${r}h`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const STATUS_BADGE: Record<ResourceStatus, string> = {
  Active: 'badge-green',
  'On Leave': 'badge-amber',
  'Future Joiner': 'badge-blue',
  Resigned: 'badge-gray',
  Inactive: 'badge-gray',
};
export function statusBadgeClass(status: ResourceStatus): string {
  return STATUS_BADGE[status] ?? 'badge-gray';
}

export function projectStatusBadge(status: string): string {
  switch (status) {
    case 'Active': return 'badge-green';
    case 'On Hold': return 'badge-amber';
    case 'Archived': return 'badge-gray';
    default: return 'badge-gray';
  }
}

/** Resolve a discipline colour CSS value (handles tokens or hex). */
export function disciplineColor(color: string | undefined): string {
  return color ?? 'var(--gray-400)';
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}
