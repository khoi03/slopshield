import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scoreSignals } from './scoring.ts';
import type { Signal, SignalId } from './types.ts';

function sig(id: SignalId, triggered = true, reason = `reason:${id}`): Signal {
  return triggered ? { id, triggered, reason } : { id, triggered: false };
}

test('no triggered signals yields safe, zero score, and no reasons', () => {
  const result = scoreSignals([sig('new', false), sig('lookalike', false)]);

  assert.equal(result.level, 'safe');
  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons, []);
});

test('a nonexistent package is always critical', () => {
  assert.equal(scoreSignals([sig('nonexistent', true, 'gone')]).level, 'critical');
});

test('nonexistent dominates: its reason is listed first', () => {
  const result = scoreSignals([
    sig('lookalike', true, 'looks like express'),
    sig('nonexistent', true, 'does not exist'),
  ]);

  assert.equal(result.level, 'critical');
  assert.equal(result.reasons[0], 'does not exist');
  assert.equal(result.reasons.length, 2);
});

test('a lone lookalike stays medium (one heuristic must not reach high)', () => {
  assert.equal(scoreSignals([sig('lookalike')]).level, 'medium');
});

test('a lone new-package signal is medium', () => {
  assert.equal(scoreSignals([sig('new')]).level, 'medium');
});

test('a lone low-downloads signal is medium', () => {
  assert.equal(scoreSignals([sig('low-downloads')]).level, 'medium');
});

test('new plus low-downloads stays medium', () => {
  assert.equal(scoreSignals([sig('new'), sig('low-downloads')]).level, 'medium');
});

test('lookalike combined with new reaches high', () => {
  assert.equal(scoreSignals([sig('lookalike'), sig('new')]).level, 'high');
});

test('a curated known-slop match is high on its own', () => {
  assert.equal(scoreSignals([sig('known-slop')]).level, 'high');
});

test('reasons are ordered by descending signal weight', () => {
  const result = scoreSignals([
    sig('low-downloads', true, 'low'),
    sig('known-slop', true, 'slop'),
  ]);

  assert.deepEqual(result.reasons, ['slop', 'low']);
});
