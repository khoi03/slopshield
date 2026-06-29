import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseInstallArgs } from './install-args.ts';

test('separates specifiers from flags', () => {
  const r = parseInstallArgs(['express', '-D', 'lodash@^4', '--save-exact']);
  assert.deepEqual(
    r.specifiers.map((s) => s.name),
    ['express', 'lodash'],
  );
  assert.equal(r.global, false);
});

test('detects the global flag in either form', () => {
  assert.equal(parseInstallArgs(['-g', 'typescript']).global, true);
  assert.equal(parseInstallArgs(['--global', 'typescript']).global, true);
});

test('skips the value of a value-taking flag (registry URL is not a package)', () => {
  const r = parseInstallArgs(['--registry', 'https://r.example.com', 'express']);
  assert.deepEqual(
    r.specifiers.map((s) => s.name),
    ['express'],
  );
});

test('handles scoped and versioned specifiers', () => {
  const r = parseInstallArgs(['@types/node@20', 'react']);
  assert.deepEqual(
    r.specifiers.map((s) => s.name),
    ['@types/node', 'react'],
  );
});

test('returns no specifiers for a flags-only or empty install', () => {
  assert.deepEqual(parseInstallArgs(['--save-dev']).specifiers, []);
  assert.deepEqual(parseInstallArgs([]).specifiers, []);
});

test('keeps non-registry specifiers but marks them non-checkable', () => {
  const r = parseInstallArgs(['express', 'git+https://github.com/u/r.git']);
  assert.deepEqual(
    r.specifiers.filter((s) => s.checkable).map((s) => s.name),
    ['express'],
  );
  assert.equal(r.specifiers.length, 2);
});
