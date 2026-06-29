import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSpecifier } from './specifier.ts';

test('a plain registry name is checkable', () => {
  const s = normalizeSpecifier('express');
  assert.equal(s.name, 'express');
  assert.equal(s.kind, 'registry');
  assert.equal(s.checkable, true);
});

test('strips version and tag from unscoped names', () => {
  assert.equal(normalizeSpecifier('lodash@^4.17.21').name, 'lodash');
  assert.equal(normalizeSpecifier('express@latest').name, 'express');
  assert.equal(normalizeSpecifier('react@18').name, 'react');
});

test('keeps the scope and strips the version from scoped names', () => {
  assert.equal(normalizeSpecifier('@types/node').name, '@types/node');
  assert.equal(normalizeSpecifier('@types/node@20.1.0').name, '@types/node');
  assert.equal(normalizeSpecifier('@scope/pkg@^1').kind, 'registry');
});

test('classifies git specifiers as non-checkable', () => {
  for (const raw of [
    'git+https://github.com/u/r.git',
    'github:user/repo',
    'git@github.com:u/r.git',
    'user/repo',
  ]) {
    const s = normalizeSpecifier(raw);
    assert.equal(s.kind, 'git', raw);
    assert.equal(s.checkable, false, raw);
  }
});

test('classifies url tarballs as non-checkable', () => {
  const s = normalizeSpecifier('https://example.com/pkg.tgz');
  assert.equal(s.kind, 'url');
  assert.equal(s.checkable, false);
});

test('classifies file specifiers as non-checkable', () => {
  for (const raw of ['./local', '../sibling', '/abs/path', 'file:../x']) {
    assert.equal(normalizeSpecifier(raw).kind, 'file', raw);
  }
});

test('classifies npm aliases as non-checkable', () => {
  const s = normalizeSpecifier('mypkg@npm:realpkg@1.2.3');
  assert.equal(s.kind, 'alias');
  assert.equal(s.checkable, false);
});

test('preserves the raw token', () => {
  assert.equal(normalizeSpecifier('lodash@4').raw, 'lodash@4');
});
