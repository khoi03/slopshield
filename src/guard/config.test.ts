import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeGuardConfig, resolveGuardConfig } from './config.ts';

test('mergeGuardConfig uses defaults for an empty field', () => {
  const c = mergeGuardConfig({}, {});
  assert.equal(c.mode, 'warn');
  assert.equal(c.failOn, 'high');
  assert.equal(c.allow.size, 0);
});

test('mergeGuardConfig reads mode, failOn, and allow from the field', () => {
  const c = mergeGuardConfig({ mode: 'block', failOn: 'medium', allow: ['lodash'] }, {});
  assert.equal(c.mode, 'block');
  assert.equal(c.failOn, 'medium');
  assert.ok(c.allow.has('lodash'));
});

test('mergeGuardConfig: CLI flags override the field', () => {
  const c = mergeGuardConfig({ mode: 'warn' }, { block: true, failOn: 'critical', allow: ['x'] });
  assert.equal(c.mode, 'block');
  assert.equal(c.failOn, 'critical');
  assert.ok(c.allow.has('x'));
});

test('mergeGuardConfig unions the field and flag allowlists', () => {
  const c = mergeGuardConfig({ allow: ['a'] }, { allow: ['b'] });
  assert.ok(c.allow.has('a') && c.allow.has('b'));
});

test('mergeGuardConfig ignores invalid field values (fail-open to defaults)', () => {
  const c = mergeGuardConfig({ mode: 'nonsense', failOn: 'bogus', allow: 'notarray' }, {});
  assert.equal(c.mode, 'warn');
  assert.equal(c.failOn, 'high');
  assert.equal(c.allow.size, 0);
});

test('resolveGuardConfig reads package.json#slopshield via injected readFile', async () => {
  const readFile = async (): Promise<string> =>
    JSON.stringify({ slopshield: { mode: 'block', allow: ['foo'] } });
  const c = await resolveGuardConfig({}, readFile);
  assert.equal(c.mode, 'block');
  assert.ok(c.allow.has('foo'));
});

test('resolveGuardConfig falls back to defaults when package.json is missing', async () => {
  const readFile = async (): Promise<string> => {
    throw new Error('ENOENT');
  };
  assert.equal((await resolveGuardConfig({}, readFile)).mode, 'warn');
});

test('resolveGuardConfig falls back to defaults on malformed package.json', async () => {
  const readFile = async (): Promise<string> => '{ not json';
  assert.equal((await resolveGuardConfig({}, readFile)).mode, 'warn');
});
