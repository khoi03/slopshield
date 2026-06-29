/**
 * Measure slopshield's detection quality against a curated corpus:
 *   - recall: how many KNOWN-BAD names are flagged at the default gate (>= high)
 *   - false-positive rate: how many LEGITIMATE top packages are flagged (>= high)
 *
 * Hits the live npm registry. This is a maintainer/CI tool, not part of the
 * runtime. Exits non-zero if a confident known-bad name is missed or the
 * false-positive rate meets/exceeds the target.
 *
 *   npm run validate
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { analyzeNames } from '../src/analyzer.ts';
import { loadKnownSlop, loadPopular } from '../src/data/loader.ts';
import { RISK_ORDER } from '../src/format.ts';
import { createRegistryClient } from '../src/registry/client.ts';
import type { PackageAnalysis, RiskLevel } from '../src/types.ts';

/** Default `--fail-on` gate: a name is "flagged" at this level or above. */
const GATE: RiskLevel = 'high';

/** False-positive target: strictly fewer than this fraction of legit names flagged. */
const FP_TARGET = 0.05;

const KNOWN_BAD_PATH = fileURLToPath(new URL('./corpus/known-bad.txt', import.meta.url));
const LEGIT_PATH = fileURLToPath(new URL('./corpus/legit-top.txt', import.meta.url));

async function readNames(path: string): Promise<string[]> {
  const raw = await readFile(path, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function isFlagged(analysis: PackageAnalysis): boolean {
  return analysis.level !== 'unknown' && RISK_ORDER[analysis.level] >= RISK_ORDER[GATE];
}

async function analyze(names: readonly string[]): Promise<PackageAnalysis[]> {
  return analyzeNames(names, {
    client: createRegistryClient(),
    popular: loadPopular(),
    knownSlop: loadKnownSlop(),
  });
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const [knownBad, legit] = await Promise.all([readNames(KNOWN_BAD_PATH), readNames(LEGIT_PATH)]);
  console.log(
    `Analyzing ${knownBad.length} known-bad + ${legit.length} legit names against the live registry…\n`,
  );

  const [badResults, legitResults] = await Promise.all([analyze(knownBad), analyze(legit)]);

  // Recall over known-bad. Registry-"unknown" names can't be measured (network).
  const badMeasured = badResults.filter((a) => a.level !== 'unknown');
  const badUnknown = badResults.length - badMeasured.length;
  const misses = badMeasured.filter((a) => !isFlagged(a));
  const recall = badMeasured.length ? (badMeasured.length - misses.length) / badMeasured.length : 0;

  // False positives over legit.
  const legitMeasured = legitResults.filter((a) => a.level !== 'unknown');
  const legitUnknown = legitResults.length - legitMeasured.length;
  const falsePositives = legitMeasured.filter(isFlagged);
  const fpRate = legitMeasured.length ? falsePositives.length / legitMeasured.length : 0;

  console.log('── Recall (known-bad flagged ≥ high) ──');
  console.log(
    `  ${badMeasured.length - misses.length}/${badMeasured.length} flagged = ${pct(recall)}` +
      (badUnknown ? `  (${badUnknown} unmeasurable: registry unknown)` : ''),
  );
  for (const miss of misses) console.log(`  MISSED → ${miss.name}: ${miss.level}`);

  console.log('\n── False positives (legit flagged ≥ high) ──');
  console.log(
    `  ${falsePositives.length}/${legitMeasured.length} flagged = ${pct(fpRate)}` +
      (legitUnknown ? `  (${legitUnknown} unmeasurable: registry unknown)` : ''),
  );
  for (const fp of falsePositives) {
    console.log(`  FALSE POSITIVE → ${fp.name} (${fp.level}): ${fp.reasons.join('; ')}`);
  }

  // If the whole run came back unknown, the registry is unreachable — don't
  // report a misleading pass/fail.
  if (badMeasured.length === 0 && legitMeasured.length === 0) {
    console.error('\n⚠ Registry unreachable (all results unknown) — cannot measure. Try again with network access.');
    process.exit(1);
  }

  const recallOk = misses.length === 0;
  const fpOk = fpRate < FP_TARGET;
  console.log(
    `\nTargets — recall 100% (confident): ${recallOk ? 'PASS' : 'FAIL'};  FP < ${pct(FP_TARGET)}: ${fpOk ? 'PASS' : 'FAIL'}`,
  );

  if (!recallOk || !fpOk) process.exit(1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`validate-corpus failed: ${message}`);
  process.exit(1);
});
