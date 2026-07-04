import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkPackageTool, parseNamesArgument, runCheckPackage } from './tool.ts';
import type { PackageAnalysis, Verdict } from '../types.ts';

function analysis(name: string, level: Verdict, reasons: string[] = []): PackageAnalysis {
  return { name, level, score: 0, reasons, signals: [] };
}

test('checkPackageTool: descriptor is a well-formed MCP tool', () => {
  assert.equal(checkPackageTool.name, 'check_package');
  assert.equal(typeof checkPackageTool.description, 'string');
  assert.equal(checkPackageTool.inputSchema.type, 'object');
  assert.deepEqual(checkPackageTool.inputSchema.required, ['names']);
  assert.equal(checkPackageTool.inputSchema.properties.names.type, 'array');
});

test('parseNamesArgument: accepts a non-empty string array', () => {
  assert.deepEqual(parseNamesArgument({ names: ['express', 'lodash'] }), ['express', 'lodash']);
});

test('parseNamesArgument: trims entries and drops blanks/non-strings', () => {
  assert.deepEqual(parseNamesArgument({ names: ['  express  ', '', 7, 'lodash'] }), ['express', 'lodash']);
});

test('parseNamesArgument: returns null for a non-array names field', () => {
  assert.equal(parseNamesArgument({ names: 'express' }), null);
});

test('parseNamesArgument: returns null for an empty (or all-blank) array', () => {
  assert.equal(parseNamesArgument({ names: [] }), null);
  assert.equal(parseNamesArgument({ names: ['  ', ''] }), null);
});

test('parseNamesArgument: returns null for a non-object argument', () => {
  assert.equal(parseNamesArgument(undefined), null);
  assert.equal(parseNamesArgument('express'), null);
});

test('runCheckPackage: maps verdicts into content text and structuredContent', async () => {
  const analyze = async (names: readonly string[]): Promise<PackageAnalysis[]> =>
    names.map((n) =>
      n === 'reqeust' ? analysis(n, 'high', ['Looks like a typo of "request".']) : analysis(n, 'safe'),
    );

  const result = await runCheckPackage(['express', 'reqeust'], analyze);

  assert.equal(result.isError, false);
  assert.equal(result.content[0]?.type, 'text');
  assert.match(result.content[0]!.text, /reqeust/);

  const packages = result.structuredContent.packages;
  assert.equal(packages.length, 2);
  assert.deepEqual(
    packages.map((p) => ({ name: p.name, verdict: p.verdict, risky: p.risky })),
    [
      { name: 'express', verdict: 'safe', risky: false },
      { name: 'reqeust', verdict: 'high', risky: true },
    ],
  );
});

test('runCheckPackage: an unknown verdict is surfaced but not marked risky (fail-open)', async () => {
  const analyze = async (names: readonly string[]): Promise<PackageAnalysis[]> =>
    names.map((n) => analysis(n, 'unknown'));
  const result = await runCheckPackage(['offline-pkg'], analyze);
  assert.equal(result.structuredContent.packages[0]?.risky, false);
  assert.equal(result.structuredContent.packages[0]?.verdict, 'unknown');
});
