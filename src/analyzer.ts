import { MAX_CONCURRENCY } from './config.ts';
import { scoreSignals } from './scoring.ts';
import { age } from './signals/age.ts';
import { downloads } from './signals/downloads.ts';
import { exists } from './signals/exists.ts';
import { patterns } from './signals/patterns.ts';
import { similarity } from './signals/similarity.ts';
import type { RegistryClient } from './registry/client.ts';
import type { KnownSlop, PackageAnalysis, Signal } from './types.ts';

export interface AnalyzerDeps {
  readonly client: RegistryClient;
  readonly popular: ReadonlySet<string>;
  readonly knownSlop: KnownSlop;
  /** Injectable "now" (ms) for the age signal; defaults to the real clock. */
  readonly now?: number;
}

const UNKNOWN_REASON =
  'Could not verify against the npm registry; result is unknown (not blocked).';

/**
 * Analyze a single package name.
 *
 * Gathers registry data, runs the five signals, and scores them. Name-only
 * signals (lookalike, known-slop) are computed even when the registry is
 * unreachable, so an offline run still surfaces typosquat shapes — but the
 * verdict is downgraded to `unknown` (fail-open) since existence, age, and
 * downloads could not be confirmed.
 */
export async function analyzePackage(
  name: string,
  deps: AnalyzerDeps,
): Promise<PackageAnalysis> {
  const { client, popular, knownSlop, now } = deps;

  const [metadata, weeklyDownloads] = await Promise.all([
    client.getPackageMetadata(name),
    client.getWeeklyDownloads(name),
  ]);

  const nameSignals: Signal[] = [similarity(name, popular), patterns(name, knownSlop)];

  if (metadata === null) {
    const reasons = [
      UNKNOWN_REASON,
      ...triggeredReasons(nameSignals),
    ];
    return { name, level: 'unknown', score: 0, reasons, signals: nameSignals };
  }

  const data = { name, metadata, weeklyDownloads };
  const signals: Signal[] = [
    exists(data),
    age(data, now),
    downloads(data),
    ...nameSignals,
  ];

  const scored = scoreSignals(signals);
  return {
    name,
    level: scored.level,
    score: scored.score,
    reasons: scored.reasons,
    signals,
  };
}

function triggeredReasons(signals: readonly Signal[]): string[] {
  return signals
    .filter((s) => s.triggered)
    .map((s) => s.reason)
    .filter((r): r is string => typeof r === 'string' && r.length > 0);
}

/**
 * Analyze many names with a bounded number of concurrent registry lookups,
 * preserving input order in the results.
 */
export async function analyzeNames(
  names: readonly string[],
  deps: AnalyzerDeps,
  concurrency: number = MAX_CONCURRENCY,
): Promise<PackageAnalysis[]> {
  const results = new Array<PackageAnalysis>(names.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < names.length) {
      const index = next++;
      results[index] = await analyzePackage(names[index]!, deps);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), names.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
