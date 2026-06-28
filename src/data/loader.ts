/**
 * Loads the bundled reference data (popular package names + known-slop seed).
 *
 * The JSON files are imported with an import attribute so the bundler inlines
 * them into the published binary — the shipped CLI carries its own data and
 * makes no extra file reads at runtime. Regenerate the popular list with
 * `npm run build:data` (see `scripts/build-popular.ts`).
 */

import knownSlopData from './known-slop.json' with { type: 'json' };
import popularPackages from './popular-packages.json' with { type: 'json' };
import type { KnownSlop } from '../types.ts';

let popularSet: ReadonlySet<string> | null = null;

/** The set of popular package names used as the similarity reference. Memoized. */
export function loadPopular(): ReadonlySet<string> {
  if (popularSet === null) {
    popularSet = new Set(popularPackages as readonly string[]);
  }
  return popularSet;
}

/** The curated known-hallucination / typosquat seed data. */
export function loadKnownSlop(): KnownSlop {
  return knownSlopData as KnownSlop;
}
