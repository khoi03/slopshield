import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadKnownSlop, loadPopular } from './loader.ts';
import { analyzePackage } from '../analyzer.ts';
import type { RegistryClient, RegistryMetadata } from '../types.ts';

test('loadPopular returns a non-empty set including well-known packages', () => {
  const popular = loadPopular();

  assert.ok(popular.size > 50);
  for (const name of ['express', 'react', 'lodash', 'request', 'chalk', 'webpack']) {
    assert.ok(popular.has(name), `expected popular set to include ${name}`);
  }
});

test('loadPopular is memoized (returns the same instance)', () => {
  assert.equal(loadPopular(), loadPopular());
});

test('loadKnownSlop returns names and patterns arrays with a seeded name list', () => {
  const slop = loadKnownSlop();

  assert.ok(Array.isArray(slop.names));
  assert.ok(Array.isArray(slop.patterns));
  assert.ok(slop.names.length > 0);
});

test('the bundled data flags a seeded lookalike (expresss → express)', async () => {
  const NOW = Date.parse('2026-06-28T00:00:00.000Z');
  const metadata: RegistryMetadata = {
    name: 'expresss',
    exists: true,
    createdAt: new Date(NOW - 3 * 86_400_000).toISOString(),
  };
  const client: RegistryClient = {
    getPackageMetadata: async () => metadata,
    getWeeklyDownloads: async () => 2,
  };

  const analysis = await analyzePackage('expresss', {
    client,
    popular: loadPopular(),
    knownSlop: loadKnownSlop(),
    now: NOW,
  });

  assert.equal(analysis.level, 'high');
  assert.match(analysis.reasons.join(' '), /express/);
});

test('a known-slop name from the bundled seed is flagged', async () => {
  const NOW = Date.parse('2026-06-28T00:00:00.000Z');
  const metadata: RegistryMetadata = {
    name: 'crossenv',
    exists: true,
    createdAt: new Date(NOW - 4000 * 86_400_000).toISOString(),
  };
  const client: RegistryClient = {
    getPackageMetadata: async () => metadata,
    getWeeklyDownloads: async () => 1000,
  };

  const analysis = await analyzePackage('crossenv', {
    client,
    popular: loadPopular(),
    knownSlop: loadKnownSlop(),
    now: NOW,
  });

  // 'crossenv' is on the known-slop seed list ⇒ at least high.
  assert.ok(analysis.level === 'high' || analysis.level === 'critical');
});
