import type { FailOn, PackageAnalysis, RiskLevel, Verdict } from './types.ts';

/** Severity ranking used for the `--fail-on` exit-code gate. */
const RISK_ORDER: Record<RiskLevel, number> = {
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

/** Render analyses as human-readable text. */
export function formatHuman(analyses: readonly PackageAnalysis[]): string {
  return analyses.map(formatOne).join('\n');
}

function formatOne(analysis: PackageAnalysis): string {
  const head = `${MARKERS[analysis.level]} ${analysis.name} — ${analysis.level}`;
  if (analysis.reasons.length === 0) {
    return analysis.level === 'safe' ? `${head} (no risk signals detected)` : head;
  }
  const body = analysis.reasons.map((reason) => `    • ${reason}`).join('\n');
  return `${head}\n${body}`;
}

/** Render analyses as a pretty-printed JSON array (machine-readable output). */
export function formatJson(analyses: readonly PackageAnalysis[]): string {
  return JSON.stringify(analyses, null, 2);
}
