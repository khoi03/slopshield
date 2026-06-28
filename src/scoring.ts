import {
  HIGH_SCORE_THRESHOLD,
  MEDIUM_SCORE_THRESHOLD,
  SIGNAL_WEIGHTS,
} from './config.ts';
import type { RiskLevel, Signal } from './types.ts';

export interface Scored {
  /** Bucketed verdict. `unknown` is never produced here — the analyzer owns it. */
  readonly level: RiskLevel;
  /** Sum of triggered signal weights. */
  readonly score: number;
  /** Triggered reasons, ordered most-severe (highest weight) first. */
  readonly reasons: readonly string[];
}

/**
 * Combine evaluated signals into a single verdict.
 *
 * A triggered `nonexistent` signal forces `critical` regardless of score (an
 * AI-hallucinated, unregistered name is the worst case). Otherwise the summed
 * weight is bucketed: a single heuristic stays below `high`, so only a
 * combination of signals — or a curated known-slop match — reaches the
 * blocking level. Reasons are ordered by descending weight so the most
 * important explanation is read first.
 */
export function scoreSignals(signals: readonly Signal[]): Scored {
  const triggered = signals.filter((s) => s.triggered);
  const ordered = [...triggered].sort(
    (a, b) => SIGNAL_WEIGHTS[b.id] - SIGNAL_WEIGHTS[a.id],
  );

  const score = ordered.reduce((sum, s) => sum + SIGNAL_WEIGHTS[s.id], 0);
  const reasons = ordered
    .map((s) => s.reason)
    .filter((r): r is string => typeof r === 'string' && r.length > 0);

  const level = deriveLevel(triggered, score);
  return { level, score, reasons };
}

function deriveLevel(triggered: readonly Signal[], score: number): RiskLevel {
  if (triggered.some((s) => s.id === 'nonexistent')) return 'critical';
  if (score >= HIGH_SCORE_THRESHOLD) return 'high';
  if (score >= MEDIUM_SCORE_THRESHOLD) return 'medium';
  return 'safe';
}
