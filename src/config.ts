/**
 * Tunable thresholds and weights for the detection engine.
 *
 * This is the central false-positive dial flagged as make-or-break in the PRD.
 * Everything that decides "how aggressive are we" lives here and nowhere else.
 */

import type { FailOn, SignalId } from './types.ts';

// --- Heuristic thresholds ---------------------------------------------------

/** A package first published more recently than this many days ago is "new". */
export const NEW_PACKAGE_MAX_AGE_DAYS = 30;

/** Weekly downloads at or below this count are treated as "near-zero usage". */
export const LOW_DOWNLOADS_WEEKLY_THRESHOLD = 50;

/** Lookalike edit-distance ceiling for short names (Damerau-Levenshtein). */
export const SHORT_NAME_MAX_DISTANCE = 1;

/** Lookalike edit-distance ceiling for long names. */
export const LONG_NAME_MAX_DISTANCE = 2;

/** Names at least this many characters long may use the larger distance ceiling. */
export const LONG_NAME_MIN_LENGTH = 10;

// --- Registry network settings ----------------------------------------------

/** Abort a registry request after this many milliseconds (fail-open on timeout). */
export const REGISTRY_TIMEOUT_MS = 5000;

/** npm registry base URL for package metadata (packuments). */
export const REGISTRY_BASE_URL = 'https://registry.npmjs.org';

/** npm downloads API base URL for last-week download counts. */
export const DOWNLOADS_BASE_URL = 'https://api.npmjs.org/downloads/point/last-week';

// --- Scoring ----------------------------------------------------------------

/**
 * Score contributed by each triggered signal.
 *
 * `nonexistent` short-circuits to `critical` regardless of its weight; the
 * large value is a safety net. The remaining weights are calibrated so that a
 * *single* heuristic signal (new OR low-downloads OR lookalike) stays below the
 * `high` threshold — only a combination reaches the blocking level — while a
 * curated `known-slop` match clears `high` on its own.
 */
export const SIGNAL_WEIGHTS: Record<SignalId, number> = {
  nonexistent: 1000,
  'known-slop': 60,
  lookalike: 35,
  new: 20,
  'low-downloads': 20,
};

/** Combined score at or above this is `high` (blocks at the default `--fail-on`). */
export const HIGH_SCORE_THRESHOLD = 50;

/** Combined score at or above this (but below `high`) is `medium`. */
export const MEDIUM_SCORE_THRESHOLD = 20;

// --- CLI defaults -----------------------------------------------------------

/** Default exit-code gate: fail the run on `high` or `critical`. */
export const DEFAULT_FAIL_ON: FailOn = 'high';

/** Maximum concurrent registry lookups during a batch scan. */
export const MAX_CONCURRENCY = 8;
