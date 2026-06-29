import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatGuard } from './format.ts';
import type { PackageAnalysis, Verdict } from './types.ts';

function a(name: string, level: Verdict, reasons: string[] = ['because']): PackageAnalysis {
  return { name, level, score: 0, reasons, signals: [] };
}

test('formatGuard is empty when nothing is flagged (stays silent on safe installs)', () => {
  assert.equal(formatGuard({ action: 'allow', blocked: [], warned: [] }), '');
});

test('formatGuard lists blocked packages with reasons and a block summary', () => {
  const out = formatGuard({
    action: 'block',
    blocked: [a('ghost', 'critical', ['does not exist'])],
    warned: [],
  });
  assert.match(out, /ghost/);
  assert.match(out, /does not exist/);
  assert.match(out, /Blocked 1/);
});

test('formatGuard lists warnings without a block summary', () => {
  const out = formatGuard({
    action: 'allow',
    blocked: [],
    warned: [a('expresss', 'medium', ['looks like express'])],
  });
  assert.match(out, /expresss/);
  assert.match(out, /warning/i);
  assert.doesNotMatch(out, /Blocked/);
});
