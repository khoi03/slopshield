import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveExitCode, formatHuman, formatJson } from './format.ts';
import type { PackageAnalysis, Verdict } from './types.ts';

function analysis(name: string, level: Verdict, reasons: string[] = []): PackageAnalysis {
  return { name, level, score: 0, reasons, signals: [] };
}

test('deriveExitCode: a safe package passes at fail-on high', () => {
  assert.equal(deriveExitCode([analysis('a', 'safe')], 'high'), 0);
});

test('deriveExitCode: high and critical fail at fail-on high', () => {
  assert.equal(deriveExitCode([analysis('a', 'high', ['r'])], 'high'), 1);
  assert.equal(deriveExitCode([analysis('a', 'critical', ['r'])], 'high'), 1);
});

test('deriveExitCode: medium passes at high but fails at medium', () => {
  assert.equal(deriveExitCode([analysis('a', 'medium', ['r'])], 'high'), 0);
  assert.equal(deriveExitCode([analysis('a', 'medium', ['r'])], 'medium'), 1);
});

test('deriveExitCode: high passes when fail-on is critical', () => {
  assert.equal(deriveExitCode([analysis('a', 'high', ['r'])], 'critical'), 0);
});

test('deriveExitCode: unknown never fails the run', () => {
  assert.equal(deriveExitCode([analysis('a', 'unknown', ['r'])], 'high'), 0);
  assert.equal(deriveExitCode([analysis('a', 'unknown', ['r'])], 'medium'), 0);
});

test('deriveExitCode: fail-on none never fails the run', () => {
  assert.equal(deriveExitCode([analysis('a', 'critical', ['r'])], 'none'), 0);
});

test('deriveExitCode: any failing package in a batch fails the run', () => {
  assert.equal(deriveExitCode([analysis('a', 'safe'), analysis('b', 'high', ['r'])], 'high'), 1);
});

test('formatHuman includes the name, level, and reasons', () => {
  const out = formatHuman([analysis('expresss', 'high', ['Looks like a typo of "express"'])]);

  assert.match(out, /expresss/);
  assert.match(out, /high/i);
  assert.match(out, /Looks like a typo/);
});

test('formatHuman marks a safe package clearly', () => {
  const out = formatHuman([analysis('lodash', 'safe')]);

  assert.match(out, /lodash/);
  assert.match(out, /safe/i);
});

test('formatJson round-trips to the analyses array', () => {
  const analyses = [analysis('a', 'safe'), analysis('b', 'critical', ['gone'])];

  const parsed = JSON.parse(formatJson(analyses)) as PackageAnalysis[];

  assert.equal(parsed.length, 2);
  assert.equal(parsed[1]?.level, 'critical');
});
