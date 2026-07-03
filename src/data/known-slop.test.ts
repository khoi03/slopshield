import { test } from 'node:test';
import assert from 'node:assert/strict';

import { patterns } from '../signals/patterns.ts';
import { loadKnownSlop } from './loader.ts';

const corpus = loadKnownSlop();

/** Names newly curated from public disclosures (sources noted in known-bad.txt). */
const CURATED = ['nodetensorflow', 'react-codeshift'];

/** Real, popular packages that must never appear on the known-slop list. */
const LEGIT = ['react', 'express', 'lodash', 'typescript', 'vue', 'next', 'axios', 'mariadb'];

test('known-slop corpus has no duplicate names', () => {
  const lowered = corpus.names.map((name) => name.toLowerCase());

  assert.equal(new Set(lowered).size, lowered.length);
});

test('every curated slop name is flagged by the known-slop signal', () => {
  for (const name of CURATED) {
    assert.equal(patterns(name, corpus).triggered, true, `expected "${name}" to be flagged`);
  }
});

test('no legitimate popular package is on the known-slop list', () => {
  for (const name of LEGIT) {
    assert.equal(patterns(name, corpus).triggered, false, `"${name}" must not be flagged`);
  }
});
