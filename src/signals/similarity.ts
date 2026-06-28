import {
  LONG_NAME_MAX_DISTANCE,
  LONG_NAME_MIN_LENGTH,
  SHORT_NAME_MAX_DISTANCE,
} from '../config.ts';
import { damerauLevenshtein } from '../distance.ts';
import type { Signal } from '../types.ts';

/** The edit-distance ceiling for a queried name, based on its length. */
function distanceCeiling(name: string): number {
  return name.length >= LONG_NAME_MIN_LENGTH
    ? LONG_NAME_MAX_DISTANCE
    : SHORT_NAME_MAX_DISTANCE;
}

/**
 * Signal (d): the name is a near-miss of a much more popular package.
 *
 * Fires only when the queried name is NOT itself popular and is within the
 * edit-distance ceiling of some name in the popular set — the classic typosquat
 * shape. The popular set doubles as the "much more popular" proxy: membership
 * means the suspected target genuinely dwarfs the queried name. Iteration order
 * of the set is preserved, so when several targets tie on distance the
 * higher-ranked (earlier-inserted) one wins.
 */
export function similarity(name: string, popular: ReadonlySet<string>): Signal {
  const notTriggered: Signal = { id: 'lookalike', triggered: false };
  if (popular.has(name)) return notTriggered;

  const ceiling = distanceCeiling(name);
  let best: { target: string; distance: number } | null = null;

  for (const candidate of popular) {
    // Cheap length prune: distance is at least the length difference.
    if (Math.abs(candidate.length - name.length) > ceiling) continue;

    const distance = damerauLevenshtein(name, candidate);
    if (distance > 0 && distance <= ceiling && (best === null || distance < best.distance)) {
      best = { target: candidate, distance };
      if (distance === 1) break; // cannot do better than 1
    }
  }

  if (best === null) return notTriggered;
  return {
    id: 'lookalike',
    triggered: true,
    reason: `Looks like a typo of the popular package "${best.target}" (edit distance ${best.distance}).`,
  };
}
