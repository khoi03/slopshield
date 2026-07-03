import { plainPalette, type Colorize, type Palette } from './color.ts';
import type {
  FailOn,
  GuardDecision,
  PackageAnalysis,
  RiskLevel,
  Verdict,
} from './types.ts';

/** Severity ranking used for the `--fail-on` exit-code gate and guard decisions. */
export const RISK_ORDER: Record<RiskLevel, number> = {
  safe: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/** Single-character markers for the human renderer. */
const MARKERS: Record<Verdict, string> = {
  safe: '✓',
  medium: '!',
  high: '✖',
  critical: '✖',
  unknown: '?',
};

/**
 * Semantic style for a verdict: green (safe) → yellow (medium) → red (high) →
 * bold red (critical) → dim (unknown). Returns an identity function when the
 * palette is plain, so callers never branch on whether color is enabled.
 */
function levelPaint(palette: Palette, level: Verdict): Colorize {
  switch (level) {
    case 'safe':
      return palette.green;
    case 'medium':
      return palette.yellow;
    case 'high':
      return palette.red;
    case 'critical':
      return (text) => palette.bold(palette.red(text));
    case 'unknown':
      return palette.dim;
  }
}

/**
 * Derive the process exit code.
 *
 * Returns 1 if any package's verdict is at or above `failOn`, else 0.
 * `unknown` verdicts never fail the run (fail-open), and `failOn: 'none'`
 * disables the gate entirely.
 */
export function deriveExitCode(analyses: readonly PackageAnalysis[], failOn: FailOn): number {
  if (failOn === 'none') return 0;

  const threshold = RISK_ORDER[failOn];
  for (const analysis of analyses) {
    if (analysis.level === 'unknown') continue;
    if (RISK_ORDER[analysis.level] >= threshold) return 1;
  }
  return 0;
}

/**
 * Render analyses as human-readable text. Pass a real `palette` (from
 * `createPalette`) to colorize; the default plain palette leaves output
 * untouched, which keeps `--json` and non-TTY streams free of ANSI codes.
 */
export function formatHuman(
  analyses: readonly PackageAnalysis[],
  palette: Palette = plainPalette,
): string {
  return analyses.map((analysis) => formatOne(analysis, palette)).join('\n');
}

function formatOne(analysis: PackageAnalysis, palette: Palette): string {
  const paint = levelPaint(palette, analysis.level);
  const head = `${paint(MARKERS[analysis.level])} ${analysis.name} — ${paint(analysis.level)}`;
  if (analysis.reasons.length === 0) {
    return analysis.level === 'safe'
      ? `${head}${palette.dim(' (no risk signals detected)')}`
      : head;
  }
  return `${head}\n${formatReasons(analysis.reasons, palette)}`;
}

/** Render reason bullets, dimmed so they recede behind the colored verdict. */
function formatReasons(reasons: readonly string[], palette: Palette): string {
  return reasons.map((reason) => palette.dim(`    • ${reason}`)).join('\n');
}

/** Verdicts worth surfacing: everything except a clean `safe`. */
export function flaggedAnalyses(
  analyses: readonly PackageAnalysis[],
): readonly PackageAnalysis[] {
  return analyses.filter((analysis) => analysis.level !== 'safe');
}

/** Verdict buckets shown in the summary, in the order they are listed (safe last). */
const SUMMARY_LEVELS: readonly RiskLevel[] = ['critical', 'high', 'medium', 'safe'];

/**
 * One-line tally for the end of a scan, e.g.
 * `6 checked — 1 critical, 2 high, 1 medium, 2 safe`. Buckets are colored by
 * level and zero buckets are omitted; `unknown` is reported separately (dimmed).
 * A fully clean run collapses to the reassuring `N checked — all safe`. Plain by
 * default so `--json` is unaffected.
 */
export function formatSummary(
  analyses: readonly PackageAnalysis[],
  palette: Palette = plainPalette,
): string {
  const counts = tallyLevels(analyses);
  const total = analyses.length;
  const head = palette.dim(`${total} checked`);

  // Everything safe → a single reassuring line instead of "N safe".
  if (total > 0 && counts.safe === total) return `${head} — ${palette.green('all safe')}`;

  const parts = SUMMARY_LEVELS.filter((level) => counts[level] > 0).map((level) =>
    levelPaint(palette, level)(`${counts[level]} ${level}`),
  );
  if (counts.unknown > 0) parts.push(palette.dim(`${counts.unknown} unknown`));

  const tail = parts.length > 0 ? parts.join(', ') : palette.green('all safe');
  return `${head} — ${tail}`;
}

/** Count analyses per verdict. */
function tallyLevels(analyses: readonly PackageAnalysis[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = {
    safe: 0,
    medium: 0,
    high: 0,
    critical: 0,
    unknown: 0,
  };
  for (const analysis of analyses) counts[analysis.level]++;
  return counts;
}

/** Render analyses as a pretty-printed JSON array (machine-readable output). */
export function formatJson(analyses: readonly PackageAnalysis[]): string {
  return JSON.stringify(analyses, null, 2);
}

/**
 * Render a guard decision for humans. Returns '' when nothing was flagged, so a
 * safe install stays completely silent.
 */
export function formatGuard(decision: GuardDecision, palette: Palette = plainPalette): string {
  const lines = [
    ...decision.blocked.map((a) => renderFlagged('✖', a, palette)),
    ...decision.warned.map((a) => renderFlagged('!', a, palette)),
  ];
  if (lines.length === 0) return '';

  const summary =
    decision.action === 'block'
      ? `Blocked ${decision.blocked.length} package(s); ${decision.warned.length} warning(s).`
      : `${decision.warned.length} warning(s).`;
  return [...lines, '', summary].join('\n');
}

function renderFlagged(marker: string, analysis: PackageAnalysis, palette: Palette): string {
  const paint = levelPaint(palette, analysis.level);
  const head = `${paint(marker)} ${analysis.name} — ${paint(analysis.level)}`;
  if (analysis.reasons.length === 0) return head;
  return `${head}\n${formatReasons(analysis.reasons, palette)}`;
}
