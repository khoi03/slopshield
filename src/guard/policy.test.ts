import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decide } from './policy.ts';
import type { GuardConfig, PackageAnalysis, Verdict } from '../types.ts';

function analysis(name: string, level: Verdict, reasons: string[] = ['reason']): PackageAnalysis {
  return { name, level, score: 0, reasons, signals: [] };
}

function cfg(partial: Partial<GuardConfig>): GuardConfig {
  return { mode: 'warn', failOn: 'high', allow: new Set(), ...partial };
}

test('warn mode never blocks; risky packages become warnings', () => {
  const d = decide([analysis('expresss', 'high')], cfg({ mode: 'warn' }));
  assert.equal(d.action, 'allow');
  assert.equal(d.warned.length, 1);
  assert.equal(d.blocked.length, 0);
});

test('block mode blocks packages at or above failOn', () => {
  const d = decide([analysis('ghost', 'critical')], cfg({ mode: 'block', failOn: 'high' }));
  assert.equal(d.action, 'block');
  assert.equal(d.blocked.length, 1);
});

test('block mode: risky below failOn is a warning, not a block', () => {
  const d = decide([analysis('x', 'medium')], cfg({ mode: 'block', failOn: 'high' }));
  assert.equal(d.action, 'allow');
  assert.equal(d.warned.length, 1);
  assert.equal(d.blocked.length, 0);
});

test('safe and unknown packages are neither blocked nor warned', () => {
  const d = decide(
    [analysis('lodash', 'safe', []), analysis('z', 'unknown')],
    cfg({ mode: 'block' }),
  );
  assert.equal(d.action, 'allow');
  assert.equal(d.blocked.length, 0);
  assert.equal(d.warned.length, 0);
});

test('allowlisted packages are skipped entirely', () => {
  const d = decide(
    [analysis('expresss', 'critical')],
    cfg({ mode: 'block', allow: new Set(['expresss']) }),
  );
  assert.equal(d.action, 'allow');
  assert.equal(d.blocked.length, 0);
  assert.equal(d.warned.length, 0);
});

test('failOn none never blocks', () => {
  const d = decide([analysis('ghost', 'critical')], cfg({ mode: 'block', failOn: 'none' }));
  assert.equal(d.action, 'allow');
  assert.equal(d.warned.length, 1);
});
