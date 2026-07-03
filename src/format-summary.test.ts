import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPalette } from './color.ts';
import { flaggedAnalyses, formatSummary } from './format.ts';
import type { PackageAnalysis, Verdict } from './types.ts';

function a(name: string, level: Verdict): PackageAnalysis {
  return { name, level, score: 0, reasons: [], signals: [] };
}

test('formatSummary: reports count and "all safe" when nothing is flagged', () => {
  assert.equal(formatSummary([a('x', 'safe'), a('y', 'safe')]), '2 checked — all safe');
});

test('formatSummary: empty input reports zero checked, all safe', () => {
  assert.equal(formatSummary([]), '0 checked — all safe');
});

test('formatSummary: tallies buckets in severity order (safe last), omitting zeros', () => {
  const out = formatSummary([
    a('a', 'critical'),
    a('b', 'high'),
    a('c', 'high'),
    a('d', 'medium'),
    a('e', 'safe'),
    a('f', 'safe'),
  ]);

  assert.equal(out, '6 checked — 1 critical, 2 high, 1 medium, 2 safe');
});

test('formatSummary: includes the safe count and unknown when mixed', () => {
  assert.equal(formatSummary([a('a', 'safe'), a('b', 'unknown')]), '2 checked — 1 safe, 1 unknown');
});

test('formatSummary: is plain by default (no ANSI)', () => {
  assert.doesNotMatch(formatSummary([a('a', 'critical')]), /\x1b\[/);
});

test('formatSummary: colors the counts when a palette is provided', () => {
  const out = formatSummary([a('a', 'high')], createPalette(true));

  assert.match(out, /\x1b\[/);
});

test('flaggedAnalyses: keeps every verdict except safe (unknown stays visible)', () => {
  const flagged = flaggedAnalyses([
    a('s', 'safe'),
    a('m', 'medium'),
    a('h', 'high'),
    a('c', 'critical'),
    a('u', 'unknown'),
  ]);

  assert.deepEqual(
    flagged.map((x) => x.level),
    ['medium', 'high', 'critical', 'unknown'],
  );
});

test('flaggedAnalyses: returns an empty array when all packages are safe', () => {
  assert.deepEqual(flaggedAnalyses([a('a', 'safe'), a('b', 'safe')]), []);
});
