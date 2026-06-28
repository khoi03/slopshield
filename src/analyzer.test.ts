import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeNames, analyzePackage } from './analyzer.ts';
import type { RegistryClient } from './registry/client.ts';
import type { KnownSlop, RegistryMetadata } from './types.ts';

const NOW = Date.parse('2026-06-28T00:00:00.000Z');
const DAY_MS = 86_400_000;

const popular = new Set(['express', 'react', 'lodash', 'request']);
const knownSlop: KnownSlop = { names: ['evil-pkg'], patterns: ['^malware-'] };

function client(metadata: RegistryMetadata | null, downloads: number | null): RegistryClient {
  return {
    getPackageMetadata: async () => metadata,
    getWeeklyDownloads: async () => downloads,
  };
}

function meta(name: string, exists: boolean, ageDays?: number): RegistryMetadata {
  const createdAt = ageDays === undefined ? null : new Date(NOW - ageDays * DAY_MS).toISOString();
  return { name, exists, createdAt };
}

function deps(c: RegistryClient) {
  return { client: c, popular, knownSlop, now: NOW };
}

test('a nonexistent package is critical', async () => {
  const analysis = await analyzePackage('ghostpkg', deps(client(meta('ghostpkg', false), null)));

  assert.equal(analysis.level, 'critical');
  assert.match(analysis.reasons.join(' '), /does not exist/i);
});

test('an established, well-used package is safe with no reasons', async () => {
  const analysis = await analyzePackage('lodash', deps(client(meta('lodash', true, 2000), 5_000_000)));

  assert.equal(analysis.level, 'safe');
  assert.deepEqual(analysis.reasons, []);
});

test('a brand-new package with near-zero downloads is medium (combined heuristics)', async () => {
  const analysis = await analyzePackage('my-fresh-lib', deps(client(meta('my-fresh-lib', true, 3), 2)));

  assert.equal(analysis.level, 'medium');
});

test('a lookalike that is also new and barely downloaded is high and names the target', async () => {
  const analysis = await analyzePackage('expresss', deps(client(meta('expresss', true, 3), 1)));

  assert.equal(analysis.level, 'high');
  assert.match(analysis.reasons.join(' '), /express/);
});

test('a nonexistent lookalike is critical and still names the suspected target', async () => {
  const analysis = await analyzePackage('expresss', deps(client(meta('expresss', false), null)));

  assert.equal(analysis.level, 'critical');
  assert.match(analysis.reasons.join(' '), /does not exist/i);
  assert.match(analysis.reasons.join(' '), /express/);
});

test('a known-slop name is flagged high', async () => {
  const analysis = await analyzePackage('evil-pkg', deps(client(meta('evil-pkg', true, 1000), 5)));

  assert.equal(analysis.level, 'high');
});

test('an unreachable registry yields unknown (fail-open) but still reports name-based findings', async () => {
  const analysis = await analyzePackage('expresss', deps(client(null, null)));

  assert.equal(analysis.level, 'unknown');
  assert.match(analysis.reasons.join(' '), /registry/i); // could-not-verify note
  assert.match(analysis.reasons.join(' '), /express/); // lookalike still computed offline
});

test('an unreachable registry on a benign name is unknown and never blocks', async () => {
  const analysis = await analyzePackage('totally-fine-name', deps(client(null, null)));

  assert.equal(analysis.level, 'unknown');
  assert.match(analysis.reasons.join(' '), /registry/i);
});

test('the analysis echoes the queried name and exposes its signals', async () => {
  const analysis = await analyzePackage('lodash', deps(client(meta('lodash', true, 2000), 5_000_000)));

  assert.equal(analysis.name, 'lodash');
  assert.ok(Array.isArray(analysis.signals));
});

test('analyzeNames returns one analysis per input, in input order', async () => {
  const results = await analyzeNames(
    ['lodash', 'express', 'react'],
    deps(client(meta('x', true, 2000), 5_000_000)),
  );

  assert.equal(results.length, 3);
  assert.deepEqual(
    results.map((r) => r.name),
    ['lodash', 'express', 'react'],
  );
});

test('analyzeNames handles an empty list', async () => {
  const results = await analyzeNames([], deps(client(null, null)));
  assert.deepEqual(results, []);
});
