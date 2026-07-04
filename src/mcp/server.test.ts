import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runMcpServer } from './server.ts';
import type { PackageAnalysis, Verdict } from '../types.ts';

function analysis(name: string, level: Verdict): PackageAnalysis {
  return { name, level, score: 0, reasons: [], signals: [] };
}

const analyze = async (names: readonly string[]): Promise<PackageAnalysis[]> =>
  names.map((n) => analysis(n, n === 'reqeust' ? 'high' : 'safe'));

/** Drive the server with pre-baked stdin chunks and collect parsed JSON responses. */
async function drive(chunks: readonly string[]): Promise<any[]> {
  const outputs: string[] = [];
  async function* input(): AsyncGenerator<string> {
    for (const chunk of chunks) yield chunk;
  }
  await runMcpServer({ input: input(), write: (line) => outputs.push(line), log: () => {}, analyze });
  return outputs.map((line) => JSON.parse(line));
}

const line = (obj: unknown): string => `${JSON.stringify(obj)}\n`;

test('initialize: echoes a supported protocolVersion and advertises tools', async () => {
  const [res] = await drive([
    line({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }),
  ]);
  assert.equal(res.id, 1);
  assert.equal(res.result.protocolVersion, '2025-03-26');
  assert.ok(res.result.capabilities.tools);
  assert.equal(res.result.serverInfo.name, 'slopshield');
});

test('initialize: falls back to the latest version when the client asks for an unknown one', async () => {
  const [res] = await drive([
    line({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1.0.0' } }),
  ]);
  assert.equal(res.result.protocolVersion, '2025-06-18');
});

test('notifications/initialized: produces no response', async () => {
  const responses = await drive([line({ jsonrpc: '2.0', method: 'notifications/initialized' })]);
  assert.equal(responses.length, 0);
});

test('ping: replies with an empty result object', async () => {
  const [res] = await drive([line({ jsonrpc: '2.0', id: 9, method: 'ping' })]);
  assert.deepEqual(res, { jsonrpc: '2.0', id: 9, result: {} });
});

test('tools/list: returns the check_package tool', async () => {
  const [res] = await drive([line({ jsonrpc: '2.0', id: 2, method: 'tools/list' })]);
  assert.equal(res.result.tools.length, 1);
  assert.equal(res.result.tools[0].name, 'check_package');
});

test('tools/call: runs check_package and returns verdicts', async () => {
  const [res] = await drive([
    line({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'check_package', arguments: { names: ['express', 'reqeust'] } } }),
  ]);
  assert.equal(res.id, 3);
  assert.equal(res.result.isError, false);
  assert.equal(res.result.structuredContent.packages.length, 2);
  assert.equal(res.result.structuredContent.packages[1].verdict, 'high');
});

test('tools/call: an unknown tool name is a protocol error (-32602)', async () => {
  const [res] = await drive([
    line({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nope', arguments: {} } }),
  ]);
  assert.equal(res.error.code, -32602);
});

test('tools/call: missing names argument is a protocol error (-32602)', async () => {
  const [res] = await drive([
    line({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'check_package', arguments: {} } }),
  ]);
  assert.equal(res.error.code, -32602);
});

test('an unknown method returns method-not-found (-32601)', async () => {
  const [res] = await drive([line({ jsonrpc: '2.0', id: 6, method: 'resources/list' })]);
  assert.equal(res.error.code, -32601);
});

test('a malformed JSON line returns a parse error (-32700) with a null id', async () => {
  const [res] = await drive(['{ this is not json\n']);
  assert.equal(res.error.code, -32700);
  assert.equal(res.id, null);
});

test('tools/call: an engine failure is reported as a tool result with isError true', async () => {
  const outputs: string[] = [];
  async function* input(): AsyncGenerator<string> {
    yield line({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'check_package', arguments: { names: ['x'] } } });
  }
  await runMcpServer({
    input: input(),
    write: (l) => outputs.push(l),
    log: () => {},
    analyze: async () => {
      throw new Error('registry unreachable');
    },
  });
  const res = JSON.parse(outputs[0]!);
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /registry unreachable/);
});

test('a valid-JSON message that is not a request is an invalid-request error (-32600)', async () => {
  const [res] = await drive([line({ jsonrpc: '2.0', id: 8, result: { anything: true } })]);
  assert.equal(res.error.code, -32600);
  assert.equal(res.id, 8);
});

test('messages split across stdin chunks are reassembled by line', async () => {
  const [res] = await drive(['{"jsonrpc":"2.0","id":1,"me', 'thod":"ping"}\n']);
  assert.deepEqual(res, { jsonrpc: '2.0', id: 1, result: {} });
});

test('a trailing line without a newline is still processed', async () => {
  const [res] = await drive(['{"jsonrpc":"2.0","id":1,"method":"ping"}']);
  assert.equal(res.id, 1);
});
