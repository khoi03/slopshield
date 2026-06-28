import { NEW_PACKAGE_MAX_AGE_DAYS } from '../config.ts';
import type { PackageData, Signal } from '../types.ts';

const DAY_MS = 86_400_000;

/**
 * Signal (b): the package was first published very recently.
 *
 * Slopsquat packages are typically registered just before (or after) an AI
 * starts suggesting the name, so a brand-new publish date is suspicious in
 * combination with other signals. `now` is injectable for deterministic tests.
 */
export function age(data: PackageData, now: number = Date.now()): Signal {
  const createdAt = data.metadata?.createdAt;
  if (!createdAt) return { id: 'new', triggered: false };

  const createdMs = Date.parse(createdAt);
  if (Number.isNaN(createdMs)) return { id: 'new', triggered: false };

  const ageDays = (now - createdMs) / DAY_MS;
  if (ageDays >= 0 && ageDays < NEW_PACKAGE_MAX_AGE_DAYS) {
    const rounded = Math.floor(ageDays);
    return {
      id: 'new',
      triggered: true,
      reason: `Published ${rounded} day${rounded === 1 ? '' : 's'} ago (newer than the ${NEW_PACKAGE_MAX_AGE_DAYS}-day threshold).`,
    };
  }
  return { id: 'new', triggered: false };
}
