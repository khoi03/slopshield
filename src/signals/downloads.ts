import { LOW_DOWNLOADS_WEEKLY_THRESHOLD } from '../config.ts';
import type { PackageData, Signal } from '../types.ts';

/**
 * Signal (c): near-zero real-world usage.
 *
 * A package almost nobody downloads has little legitimate footprint — a red
 * flag for a freshly planted slopsquat. When download data is unavailable
 * (null), the signal stays quiet (fail-open) rather than assuming zero.
 */
export function downloads(data: PackageData): Signal {
  const weekly = data.weeklyDownloads;
  if (weekly !== null && weekly <= LOW_DOWNLOADS_WEEKLY_THRESHOLD) {
    return {
      id: 'low-downloads',
      triggered: true,
      reason: `Only ${weekly} download${weekly === 1 ? '' : 's'} last week (at or below ${LOW_DOWNLOADS_WEEKLY_THRESHOLD}).`,
    };
  }
  return { id: 'low-downloads', triggered: false };
}
