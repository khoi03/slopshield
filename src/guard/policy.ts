import { RISK_ORDER } from '../format.ts';
import type { GuardConfig, GuardDecision, PackageAnalysis } from '../types.ts';

/**
 * Bucket analyzed packages into blocked / warned according to the guard policy.
 * Pure.
 *
 * - Allowlisted, `safe`, and `unknown` packages are passed (never blocked) —
 *   `unknown` keeps the engine's fail-open posture.
 * - In `block` mode, a package at or above `failOn` is blocked; anything risky
 *   below the threshold is a warning.
 * - In `warn` mode nothing is ever blocked; risky packages become warnings.
 */
export function decide(
  analyses: readonly PackageAnalysis[],
  config: GuardConfig,
): GuardDecision {
  const blocked: PackageAnalysis[] = [];
  const warned: PackageAnalysis[] = [];
  const threshold = config.failOn === 'none' ? Number.POSITIVE_INFINITY : RISK_ORDER[config.failOn];

  for (const analysis of analyses) {
    if (config.allow.has(analysis.name)) continue;
    if (analysis.level === 'safe' || analysis.level === 'unknown') continue;

    const meetsFailOn = RISK_ORDER[analysis.level] >= threshold;
    if (meetsFailOn && config.mode === 'block') {
      blocked.push(analysis);
    } else {
      warned.push(analysis);
    }
  }

  return { action: blocked.length > 0 ? 'block' : 'allow', blocked, warned };
}
