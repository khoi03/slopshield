import { test } from 'node:test';
import assert from 'node:assert/strict';

import { patterns } from './patterns.ts';
import type { KnownSlop } from '../types.ts';

const knownSlop: KnownSlop = {
  names: ['totally-fake-ai-pkg', 'reqwest-utils'],
  patterns: ['-ai-helper$', '^fake-'],
};

test('flags a name on the known-slop exact-name list', () => {
  const signal = patterns('totally-fake-ai-pkg', knownSlop);

  assert.equal(signal.id, 'known-slop');
  assert.equal(signal.triggered, true);
  assert.ok((signal.reason ?? '').length > 0);
});

test('flags a name matching a known-slop regex pattern', () => {
  assert.equal(patterns('super-ai-helper', knownSlop).triggered, true);
  assert.equal(patterns('fake-router', knownSlop).triggered, true);
});

test('does not flag an unrelated, legitimate name', () => {
  assert.equal(patterns('express', knownSlop).triggered, false);
});

test('matches names case-insensitively', () => {
  assert.equal(patterns('Totally-Fake-AI-Pkg', knownSlop).triggered, true);
});

test('ignores an invalid regex pattern without throwing', () => {
  const bad: KnownSlop = { names: [], patterns: ['('] }; // unbalanced paren
  assert.equal(patterns('anything', bad).triggered, false);
});
