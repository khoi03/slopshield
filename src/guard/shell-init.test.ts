import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shellInitSnippet } from './shell-init.ts';

test('bash/zsh snippet defines an npm wrapper that calls slopcheck guard', () => {
  for (const shell of ['bash', 'zsh'] as const) {
    const snippet = shellInitSnippet(shell);
    assert.match(snippet, /npm\s*\(\)/, shell);
    assert.match(snippet, /slopcheck guard/, shell);
  }
});

test('fish snippet defines an npm function that calls slopcheck guard', () => {
  const snippet = shellInitSnippet('fish');
  assert.match(snippet, /function npm/);
  assert.match(snippet, /slopcheck guard/);
});
