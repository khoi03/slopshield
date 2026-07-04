/**
 * Tunable thresholds and weights for the detection engine.
 *
 * This is the central false-positive dial flagged as make-or-break in the PRD.
 * Everything that decides "how aggressive are we" lives here and nowhere else.
 */

import type { FailOn, GuardMode, SignalId } from './types.ts';

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

/** Accepted `--fail-on` values (the risk levels plus `none`). */
export const VALID_FAIL_ON: readonly string[] = ['safe', 'medium', 'high', 'critical', 'none'];

/** Maximum concurrent registry lookups during a batch scan. */
export const MAX_CONCURRENCY = 8;

// --- Install guard (Milestone 2) --------------------------------------------

/** Default guard posture: warn with clear reasons; blocking is opt-in (per PRD). */
export const DEFAULT_GUARD_MODE: GuardMode = 'warn';

/** Manifest file the guard reads policy from. */
export const PACKAGE_JSON_FILE = 'package.json';

/** Field within package.json holding guard config: `{ "slopshield": { … } }`. */
export const CONFIG_FIELD = 'slopshield';

/** npm subcommands that install new packages (used by routing + shell integration). */
export const INSTALL_SUBCOMMANDS = ['install', 'i', 'add'] as const;

/** Process exit codes. */
export const EXIT_OK = 0;
export const EXIT_BLOCKED = 1;
export const EXIT_USAGE = 2;

// --- AI-agent guard (Milestone 4): MCP server + Claude Code hook ------------

/** Name reported to MCP clients in `serverInfo`. */
export const MCP_SERVER_NAME = 'slopshield';

/** The single tool the MCP server exposes. */
export const MCP_TOOL_NAME = 'check_package';

/** Latest MCP protocol revision we implement (sent when the client's is unknown). */
export const MCP_PROTOCOL_VERSION = '2025-06-18';

/** MCP protocol versions we accept during `initialize` (newest first). */
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;

/** Cap the packages checked per `check_package` call (bounds registry fan-out). */
export const MCP_MAX_NAMES = 100;

/** Drop any single stdin line longer than this (bytes) as malformed (DoS guard). */
export const MCP_MAX_LINE_BYTES = 1_000_000;
