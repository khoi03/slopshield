import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exists } from './exists.ts';
import type { PackageData } from '../types.ts';

test('triggers when the registry confidently reports the package does not exist', () => {
  const data: PackageData = {
    name: 'ghost-pkg',
    metadata: { name: 'ghost-pkg', exists: false, createdAt: null },
    weeklyDownloads: null,
  };

  const signal = exists(data);

  assert.equal(signal.id, 'nonexistent');
  assert.equal(signal.triggered, true);
  assert.match(signal.reason ?? '', /does not exist/i);
});

test('does not trigger for a package that exists', () => {
  const data: PackageData = {
    name: 'express',
    metadata: { name: 'express', exists: true, createdAt: '2010-01-01T00:00:00.000Z' },
    weeklyDownloads: 1_000_000,
  };

  assert.equal(exists(data).triggered, false);
});

test('does not trigger when registry metadata is unknown (fail-open)', () => {
  const data: PackageData = { name: 'maybe', metadata: null, weeklyDownloads: null };

  assert.equal(exists(data).triggered, false);
});
