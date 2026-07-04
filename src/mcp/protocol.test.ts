import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeError,
  makeResult,
  parseMessage,
  serializeMessage,
  RPC_PARSE_ERROR,
} from './protocol.ts';

test('parseMessage: a request carries id, method, and params', () => {
  const parsed = parseMessage('{"jsonrpc":"2.0","id":7,"method":"tools/list","params":{"cursor":"x"}}');
  assert.equal(parsed.kind, 'request');
  if (parsed.kind !== 'request') return;
  assert.equal(parsed.request.id, 7);
  assert.equal(parsed.request.method, 'tools/list');
  assert.deepEqual(parsed.request.params, { cursor: 'x' });
});

test('parseMessage: id 0 is a valid request id (not treated as a notification)', () => {
  const parsed = parseMessage('{"jsonrpc":"2.0","id":0,"method":"ping"}');
  assert.equal(parsed.kind, 'request');
  if (parsed.kind !== 'request') return;
  assert.equal(parsed.request.id, 0);
});

test('parseMessage: string ids are preserved', () => {
  const parsed = parseMessage('{"jsonrpc":"2.0","id":"abc","method":"ping"}');
  assert.equal(parsed.kind, 'request');
  if (parsed.kind !== 'request') return;
  assert.equal(parsed.request.id, 'abc');
});

test('parseMessage: a message without an id is a notification', () => {
  const parsed = parseMessage('{"jsonrpc":"2.0","method":"notifications/initialized"}');
  assert.equal(parsed.kind, 'notification');
  if (parsed.kind !== 'notification') return;
  assert.equal(parsed.notification.method, 'notifications/initialized');
});

test('parseMessage: params are optional', () => {
  const parsed = parseMessage('{"jsonrpc":"2.0","id":1,"method":"ping"}');
  assert.equal(parsed.kind, 'request');
  if (parsed.kind !== 'request') return;
  assert.equal(parsed.request.params, undefined);
});

test('parseMessage: invalid JSON is a parse-error', () => {
  const parsed = parseMessage('{not json');
  assert.equal(parsed.kind, 'parse-error');
});

test('parseMessage: a top-level array (batch) is invalid with a null id', () => {
  const parsed = parseMessage('[{"jsonrpc":"2.0","id":1,"method":"ping"}]');
  assert.equal(parsed.kind, 'invalid');
  if (parsed.kind !== 'invalid') return;
  assert.equal(parsed.id, null);
});

test('parseMessage: a non-object JSON value is invalid', () => {
  const parsed = parseMessage('42');
  assert.equal(parsed.kind, 'invalid');
});

test('parseMessage: an object without a method string is invalid but echoes its id', () => {
  const parsed = parseMessage('{"jsonrpc":"2.0","id":5,"result":{}}');
  assert.equal(parsed.kind, 'invalid');
  if (parsed.kind !== 'invalid') return;
  assert.equal(parsed.id, 5);
});

test('makeResult: builds a JSON-RPC 2.0 success envelope', () => {
  const response = makeResult(3, { ok: true });
  assert.deepEqual(response, { jsonrpc: '2.0', id: 3, result: { ok: true } });
});

test('makeError: omits data when not provided', () => {
  const response = makeError(1, RPC_PARSE_ERROR, 'Parse error');
  assert.deepEqual(response, { jsonrpc: '2.0', id: 1, error: { code: RPC_PARSE_ERROR, message: 'Parse error' } });
});

test('makeError: includes data when provided', () => {
  const response = makeError(null, -32602, 'bad', { requested: '1.0.0' });
  assert.deepEqual(response.error, { code: -32602, message: 'bad', data: { requested: '1.0.0' } });
});

test('serializeMessage: emits single-line JSON with no embedded newline', () => {
  const line = serializeMessage(makeResult(1, { text: 'line one\nline two' }));
  assert.equal(line.includes('\n'), false);
  assert.deepEqual(JSON.parse(line).result.text, 'line one\nline two');
});
