import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shellInitSnippet } from './shell-init.ts';

test('bash/zsh snippet defines an npm wrapper that calls slopshield guard', () => {
  for (const shell of ['bash', 'zsh'] as const) {
    const snippet = shellInitSnippet(shell);
    assert.match(snippet, /npm\s*\(\)/, shell);
    assert.match(snippet, /slopshield guard/, shell);
    // Only guards when packages are named, so a bare `npm install` is not blocked.
    assert.match(snippet, /-gt 1/, shell);
  }
});

test('fish snippet defines an npm function that calls slopshield guard', () => {
  const snippet = shellInitSnippet('fish');
  assert.match(snippet, /function npm/);
  assert.match(snippet, /slopshield guard/);
  assert.match(snippet, /count \$argv\) -gt 1/);
});
