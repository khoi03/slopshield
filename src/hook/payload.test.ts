import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePreToolUsePayload } from './payload.ts';

test('parsePreToolUsePayload: reads tool_name, the Bash command, and cwd', () => {
  const payload = parsePreToolUsePayload(
    JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm install express' }, cwd: '/repo' }),
  );
  assert.deepEqual(payload, { toolName: 'Bash', command: 'npm install express', cwd: '/repo' });
});

test('parsePreToolUsePayload: a tool_input without a command yields a null command', () => {
  const payload = parsePreToolUsePayload(JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'a.ts' } }));
  assert.equal(payload?.toolName, 'Edit');
  assert.equal(payload?.command, null);
});

test('parsePreToolUsePayload: a missing cwd is null', () => {
  const payload = parsePreToolUsePayload(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } }));
  assert.equal(payload?.cwd, null);
});

test('parsePreToolUsePayload: invalid JSON returns null', () => {
  assert.equal(parsePreToolUsePayload('{not json'), null);
});

test('parsePreToolUsePayload: a missing tool_name returns null', () => {
  assert.equal(parsePreToolUsePayload(JSON.stringify({ tool_input: { command: 'ls' } })), null);
});

test('parsePreToolUsePayload: a non-object payload returns null', () => {
  assert.equal(parsePreToolUsePayload('42'), null);
});
