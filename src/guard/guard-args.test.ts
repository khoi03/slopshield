import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseGuardArgs } from './guard-args.ts';

test('parseGuardArgs tolerates npm install flags and extracts only the package', () => {
  // This is the M2 shell-integration bug: `npm install lodash --save-dev` used
  // to error on the unknown flag instead of checking lodash.
  const p = parseGuardArgs(['lodash', '--save-dev']);
  assert.deepEqual(
    p.specifiers.map((s) => s.name),
    ['lodash'],
  );
  assert.equal(p.flags.block, false);
  assert.equal(p.hadArgs, true);
});

test('parseGuardArgs flags no arguments at all (direct-use usage error)', () => {
  const p = parseGuardArgs([]);
  assert.equal(p.hadArgs, false);
  assert.equal(p.specifiers.length, 0);
});

test('parseGuardArgs: only npm flags (no package) yields zero specifiers but hadArgs', () => {
  // e.g. the shadow on `npm install --save-dev` — nothing to check, allow.
  const p = parseGuardArgs(['--save-dev', '-g']);
  assert.equal(p.hadArgs, true);
  assert.equal(p.specifiers.length, 0);
});

test('parseGuardArgs honors --block / --allow / --fail-on alongside names', () => {
  const p = parseGuardArgs(['express', 'lodash', '--block', '--fail-on', 'medium', '--allow', 'foo']);
  assert.deepEqual(
    p.specifiers.map((s) => s.name),
    ['express', 'lodash'],
  );
  assert.equal(p.flags.block, true);
  assert.equal(p.flags.failOn, 'medium');
  assert.deepEqual([...(p.flags.allow ?? [])], ['foo']);
  assert.equal(p.invalidFailOn, undefined);
});

test('parseGuardArgs reports an invalid --fail-on value', () => {
  const p = parseGuardArgs(['expresss', '--fail-on', 'bogus']);
  assert.equal(p.invalidFailOn, 'bogus');
  assert.equal(p.flags.failOn, undefined);
});

test('parseGuardArgs keeps non-registry specifiers (marked unchecked)', () => {
  const p = parseGuardArgs(['react', 'git+https://github.com/u/r.git']);
  assert.ok(p.specifiers.map((s) => s.name).includes('react'));
  const git = p.specifiers.find((s) => s.kind === 'git');
  assert.ok(git && git.checkable === false);
});
