import { test } from 'node:test';
import assert from 'node:assert/strict';

import { confirm } from './prompt.ts';

test('confirm returns true for affirmative answers', async () => {
  assert.equal(await confirm('Proceed?', async () => 'y'), true);
  assert.equal(await confirm('Proceed?', async () => 'YES'), true);
  assert.equal(await confirm('Proceed?', async () => '  Yes  '), true);
});

test('confirm returns false for negative or empty answers (safe default)', async () => {
  assert.equal(await confirm('Proceed?', async () => 'n'), false);
  assert.equal(await confirm('Proceed?', async () => ''), false);
  assert.equal(await confirm('Proceed?', async () => 'whatever'), false);
});
