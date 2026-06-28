import { test } from 'node:test';
import assert from 'node:assert/strict';

import { age } from './age.ts';
import type { PackageData } from '../types.ts';

const NOW = Date.parse('2026-06-28T00:00:00.000Z');
const DAY_MS = 86_400_000;

function published(daysAgo: number): PackageData {
  const createdAt = new Date(NOW - daysAgo * DAY_MS).toISOString();
  return {
    name: 'pkg',
    metadata: { name: 'pkg', exists: true, createdAt },
    weeklyDownloads: 0,
  };
}

test('triggers for a package published within the last 30 days', () => {
  const signal = age(published(5), NOW);

  assert.equal(signal.id, 'new');
  assert.equal(signal.triggered, true);
  assert.match(signal.reason ?? '', /day/i);
});

test('does not trigger for an old, established package', () => {
  assert.equal(age(published(400), NOW).triggered, false);
});

test('does not trigger exactly at the 30-day boundary', () => {
  assert.equal(age(published(30), NOW).triggered, false);
});

test('triggers just inside the boundary (29 days)', () => {
  assert.equal(age(published(29), NOW).triggered, true);
});

test('does not trigger when the creation date is unknown', () => {
  const data: PackageData = {
    name: 'pkg',
    metadata: { name: 'pkg', exists: true, createdAt: null },
    weeklyDownloads: 0,
  };
  assert.equal(age(data, NOW).triggered, false);
});

test('does not trigger when registry metadata is unknown', () => {
  const data: PackageData = { name: 'pkg', metadata: null, weeklyDownloads: null };
  assert.equal(age(data, NOW).triggered, false);
});
