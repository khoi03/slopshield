import { test } from 'node:test';
import assert from 'node:assert/strict';

import { similarity } from './similarity.ts';

const popular = new Set([
  'express',
  'react',
  'react-dom',
  'lodash',
  'request',
  'chalk',
  'webpack',
]);

test('flags a one-edit lookalike and names the suspected popular target', () => {
  const signal = similarity('expresss', popular);

  assert.equal(signal.id, 'lookalike');
  assert.equal(signal.triggered, true);
  assert.match(signal.reason ?? '', /express/);
});

test('flags a transposition lookalike (reqeust → request)', () => {
  const signal = similarity('reqeust', popular);

  assert.equal(signal.triggered, true);
  assert.match(signal.reason ?? '', /request/);
});

test('does not flag a name that is itself a popular package', () => {
  assert.equal(similarity('react', popular).triggered, false);
});

test('does not flag a name far from every popular package', () => {
  assert.equal(similarity('my-unique-internal-tool', popular).triggered, false);
});

test('uses the tighter distance-1 ceiling for short names', () => {
  const p = new Set(['aaaaa']); // length 5 → short
  assert.equal(similarity('aaaab', p).triggered, true); // distance 1 → flagged
  assert.equal(similarity('aaabb', p).triggered, false); // distance 2 → above short ceiling
});

test('allows the distance-2 ceiling for long names', () => {
  const p = new Set(['aaaaaaaaaa']); // length 10 → long
  assert.equal(similarity('aaaaaaaabb', p).triggered, true); // distance 2 → flagged
  assert.equal(similarity('aaaaaaabbb', p).triggered, false); // distance 3 → above long ceiling
});
