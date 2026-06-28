import { test } from 'node:test';
import assert from 'node:assert/strict';

import { damerauLevenshtein } from './distance.ts';

test('returns 0 for identical strings', () => {
  assert.equal(damerauLevenshtein('express', 'express'), 0);
});

test('returns the other length when one string is empty', () => {
  assert.equal(damerauLevenshtein('', 'cat'), 3);
  assert.equal(damerauLevenshtein('cat', ''), 3);
  assert.equal(damerauLevenshtein('', ''), 0);
});

test('counts a single insertion as 1', () => {
  assert.equal(damerauLevenshtein('express', 'expresss'), 1);
  assert.equal(damerauLevenshtein('cat', 'cats'), 1);
});

test('counts a single deletion as 1', () => {
  assert.equal(damerauLevenshtein('cats', 'cat'), 1);
});

test('counts a single substitution as 1', () => {
  assert.equal(damerauLevenshtein('cat', 'cot'), 1);
});

test('counts an adjacent transposition as 1 (Damerau, not plain Levenshtein)', () => {
  assert.equal(damerauLevenshtein('ab', 'ba'), 1);
  assert.equal(damerauLevenshtein('form', 'from'), 1);
  // real typosquat shape: swapped neighbours
  assert.equal(damerauLevenshtein('request', 'reqeust'), 1);
  assert.equal(damerauLevenshtein('lodash', 'lodahs'), 1);
  assert.equal(damerauLevenshtein('react', 'raect'), 1);
});

test('accumulates independent edits', () => {
  // substitute + insert
  assert.equal(damerauLevenshtein('cat', 'cots'), 2);
});

test('is symmetric and matches the classic kitten/sitting case', () => {
  assert.equal(
    damerauLevenshtein('kitten', 'sitting'),
    damerauLevenshtein('sitting', 'kitten'),
  );
  assert.equal(damerauLevenshtein('kitten', 'sitting'), 3);
});
