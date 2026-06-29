/**
 * Core types for the Slopshield detection engine.
 *
 * This module is types-only: it emits no runtime code and is excluded from
 * coverage. Keep all runtime constants in `config.ts`.
 */

/** Overall risk verdict for a package. Severity order: safe < medium < high < critical. */
export type RiskLevel = 'safe' | 'medium' | 'high' | 'critical';

/**
 * A verdict may also be `unknown` when registry data could not be retrieved.
 * Slopshield is fail-open: an `unknown` is surfaced as a warning and never
 * blocks (it is treated as neither safe nor risky for exit-code purposes).
 */
export type Verdict = RiskLevel | 'unknown';

/** The level at or above which the CLI exits non-zero. `none` never fails the run. */
export type FailOn = RiskLevel | 'none';

/** Identifiers for the five detection heuristics. */
export type SignalId =
  | 'nonexistent'
  | 'new'
  | 'low-downloads'
  | 'lookalike'
  | 'known-slop';

/** Result of evaluating one heuristic against a package. Immutable. */
export interface Signal {
  readonly id: SignalId;
  readonly triggered: boolean;
  /** Human-readable explanation. Present when `triggered` is true. */
  readonly reason?: string;
}

/**
 * Confident metadata from the npm registry.
 *
 * A `null` value returned by the registry client means "unknown" (the lookup
 * failed or timed out) and must be distinguished from `exists: false`, which
 * is a confident "this package is not registered".
 */
export interface RegistryMetadata {
  readonly name: string;
  readonly exists: boolean;
  /** ISO-8601 creation timestamp, or null when unpublished / unavailable. */
  readonly createdAt: string | null;
}

/** Raw data gathered for one package before signals run. */
export interface PackageData {
  readonly name: string;
  /** `null` ⇒ registry lookup failed/timed out ⇒ unknown verdict (fail-open). */
  readonly metadata: RegistryMetadata | null;
  /** Weekly downloads, or `null` when unavailable (the signal then does not fire). */
  readonly weeklyDownloads: number | null;
}

/** Seed data for the `known-slop` signal: exact names plus regex pattern sources. */
export interface KnownSlop {
  /** Exact package names known to be hallucinated or typosquats. */
  readonly names: readonly string[];
  /** Regex source strings (matched case-insensitively) for known-bad name shapes. */
  readonly patterns: readonly string[];
}

/** Final per-package analysis returned by the engine. Immutable. */
export interface PackageAnalysis {
  readonly name: string;
  readonly level: Verdict;
  readonly score: number;
  /** Ordered, human-readable reasons (most severe first). */
  readonly reasons: readonly string[];
  /** Every evaluated signal, in evaluation order (for `--json` consumers). */
  readonly signals: readonly Signal[];
}

// --- Install guard (Milestone 2) --------------------------------------------

/** Guard posture: `warn` (proceed after notice/confirm) or `block` (refuse risky installs). */
export type GuardMode = 'warn' | 'block';

/** Classification of an install specifier. Only `registry` names are checkable. */
export type SpecifierKind = 'registry' | 'git' | 'url' | 'file' | 'alias';

/** A parsed install specifier (e.g. `express@^4`, `@scope/pkg`, `git+https://…`). */
export interface Specifier {
  /** The original token as typed. */
  readonly raw: string;
  /** Bare package name with version/tag stripped (scope retained). */
  readonly name: string;
  readonly kind: SpecifierKind;
  /** True only when `name` is a registry package we can analyze. */
  readonly checkable: boolean;
}

/** Result of parsing an `npm install …` argument list. */
export interface ParsedInstall {
  readonly specifiers: readonly Specifier[];
  /** True if the install targets the global prefix (`-g` / `--global`). */
  readonly global: boolean;
}

/** Resolved guard policy (from `package.json#slopshield` merged with CLI flags). */
export interface GuardConfig {
  readonly mode: GuardMode;
  readonly failOn: FailOn;
  /** Package names exempt from flagging. */
  readonly allow: ReadonlySet<string>;
}

/** Decision produced by the guard for a set of analyzed packages. Immutable. */
export interface GuardDecision {
  /** `block` ⇒ refuse to install; `allow` ⇒ proceed (possibly after a warning/confirm). */
  readonly action: 'allow' | 'block';
  /** Packages meeting the block threshold (block mode only). */
  readonly blocked: readonly PackageAnalysis[];
  /** Risky packages surfaced as warnings (never block the run). */
  readonly warned: readonly PackageAnalysis[];
}
