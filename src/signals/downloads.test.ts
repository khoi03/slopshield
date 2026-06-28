import { test } from 'node:test';
import assert from 'node:assert/strict';

import { downloads } from './downloads.ts';
import type { PackageData } from '../types.ts';

function withDownloads(weeklyDownloads: number | null): PackageData {
  return {
    name: 'pkg',
    metadata: { name: 'pkg', exists: true, createdAt: '2024-01-01T00:00:00.000Z' },
    weeklyDownloads,
  };
}

test('triggers when weekly downloads are well below the threshold', () => {
  const signal = downloads(withDownloads(10));

  assert.equal(signal.id, 'low-downloads');
  assert.equal(signal.triggered, true);
  assert.match(signal.reason ?? '', /download/i);
});

test('triggers at zero downloads', () => {
  assert.equal(downloads(withDownloads(0)).triggered, true);
});

test('triggers exactly at the threshold (50)', () => {
  assert.equal(downloads(withDownloads(50)).triggered, true);
});

test('does not trigger just above the threshold (51)', () => {
  assert.equal(downloads(withDownloads(51)).triggered, false);
});

test('does not trigger for a heavily used package', () => {
  assert.equal(downloads(withDownloads(5_000_000)).triggered, false);
});

test('does not trigger when download data is unavailable (null)', () => {
  assert.equal(downloads(withDownloads(null)).triggered, false);
});
