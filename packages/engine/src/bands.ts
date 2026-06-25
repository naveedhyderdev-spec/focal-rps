/**
 * Utilization colour bands (spec §3.4). Thresholds are configurable in
 * Admin → Settings and stored as data, never hard-coded into UI logic.
 */

import type { UtilThresholds } from './types.js';

export const DEFAULT_UTIL_THRESHOLDS: UtilThresholds = {
  underMax: 79, // 0–79%   Blue   under-utilized
  moderateMax: 90, // 80–90%  Lavender moderately utilized
  fullMax: 100, // 91–100% Green  fully utilized
  slightOverMax: 110, // 101–110% Orange slightly over; >110 Red
};

export type UtilBand = 'under' | 'moderate' | 'full' | 'slightOver' | 'over';

export interface BandInfo {
  band: UtilBand;
  label: string;
  /** CSS custom-property name carrying the band's colour. */
  colorVar: string;
  bgVar: string;
}

const BAND_META: Record<UtilBand, Omit<BandInfo, 'band'>> = {
  under: { label: 'Under-utilized', colorVar: '--color-info', bgVar: '--color-info-bg' },
  moderate: { label: 'Moderately utilized', colorVar: '--color-purple', bgVar: '--color-purple-bg' },
  full: { label: 'Fully utilized', colorVar: '--color-success', bgVar: '--color-success-bg' },
  slightOver: { label: 'Slightly over-utilized', colorVar: '--color-warning', bgVar: '--color-warning-bg' },
  over: { label: 'Significantly over-utilized', colorVar: '--color-danger', bgVar: '--color-danger-bg' },
};

/** Classify a utilization percentage into its band key. */
export function classifyBand(
  percent: number,
  thresholds: UtilThresholds = DEFAULT_UTIL_THRESHOLDS,
): UtilBand {
  if (percent <= thresholds.underMax) return 'under';
  if (percent <= thresholds.moderateMax) return 'moderate';
  if (percent <= thresholds.fullMax) return 'full';
  if (percent <= thresholds.slightOverMax) return 'slightOver';
  return 'over';
}

/** Full band metadata for a utilization percentage. */
export function bandInfo(
  percent: number,
  thresholds: UtilThresholds = DEFAULT_UTIL_THRESHOLDS,
): BandInfo {
  const band = classifyBand(percent, thresholds);
  return { band, ...BAND_META[band] };
}

export function bandMeta(band: UtilBand): Omit<BandInfo, 'band'> {
  return BAND_META[band];
}
