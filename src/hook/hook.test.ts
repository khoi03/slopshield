import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runHook, type HookDeps } from './hook.ts';
import type { PackageAnalysis, Verdict } from '../types.ts';

function analysis(name: string, level: Verdict, reasons: string[] = [`reason-${level}`]): PackageAnalysis {
  return { name, level, score: 0, reasons, signals: [] };
}

const noConfig = async (): Promise<string> => '{}';

/** Run the hook against a Bash command with a stubbed engine; return decision JSON or null. */
async function run(
  command: string,
  verdicts: Record<string, Verdict>,
  extra: Partial<HookDeps> = {},
): Promise<any | null> {
  const outputs: string[] = [];
  const payload = JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
  await runHook({
    readStdin: async () => payload,
    analyze: async (names) => names.map((n) => analysis(n, verdicts[n] ?? 'safe')),
    readFile: noConfig,
    write: (line) => outputs.push(line),
    log: () => {},
    ...extra,
  });
  return outputs.length > 0 ? JSON.parse(outputs[0]!) : null;
}

test('runHook: a critical package install is denied with a self-correcting reason', async () => {
  const decision = await run('npm install ghostpkg', { ghostpkg: 'critical' });
  assert.equal(decision.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(decision.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(decision.hookSpecificOutput.permissionDecisionReason, /ghostpkg/);
});

test('runHook: a high-risk typosquat is denied', async () => {
  const decision = await run('npm i reqeust', { reqeust: 'high' });
  assert.equal(decision.hookSpecificOutput.permissionDecision, 'deny');
});

test('runHook: a medium-risk package escalates to the user (ask), not a hard deny', async () => {
  const decision = await run('npm i borderline', { borderline: 'medium' });
  assert.equal(decision.hookSpecificOutput.permissionDecision, 'ask');
});

test('runHook: a safe install is allowed silently (no output)', async () => {
  assert.equal(await run('npm install express', { express: 'safe' }), null);
});

test('runHook: an unknown verdict never blocks (fail-open)', async () => {
  assert.equal(await run('npm install offline', { offline: 'unknown' }), null);
});

test('runHook: a non-install Bash command is ignored', async () => {
  assert.equal(await run('rm -rf node_modules', {}), null);
});

test('runHook: a non-Bash tool call is ignored', async () => {
  const outputs: string[] = [];
  await runHook({
    readStdin: async () => JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'a.ts' } }),
    analyze: async () => [analysis('x', 'critical')],
    readFile: noConfig,
    write: (line) => outputs.push(line),
    log: () => {},
  });
  assert.equal(outputs.length, 0);
});

test('runHook: unparseable stdin is ignored (fail-open)', async () => {
  const outputs: string[] = [];
  await runHook({
    readStdin: async () => '{not json',
    analyze: async () => [analysis('x', 'critical')],
    readFile: noConfig,
    write: (line) => outputs.push(line),
    log: () => {},
  });
  assert.equal(outputs.length, 0);
});

test('runHook: an allowlisted package (package.json#slopshield) is not blocked', async () => {
  const withAllow = async (): Promise<string> => JSON.stringify({ slopshield: { allow: ['ghostpkg'] } });
  const decision = await run('npm install ghostpkg', { ghostpkg: 'critical' }, { readFile: withAllow });
  assert.equal(decision, null);
});

test('runHook: a failing engine fails open (no output, still exits 0)', async () => {
  const outputs: string[] = [];
  const code = await runHook({
    readStdin: async () => JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm i ghostpkg' } }),
    analyze: async () => {
      throw new Error('network down');
    },
    readFile: noConfig,
    write: (line) => outputs.push(line),
    log: () => {},
  });
  assert.equal(code, 0);
  assert.equal(outputs.length, 0);
});

test('runHook: always exits 0 (it denies via JSON, not via exit code)', async () => {
  const code = await runHook({
    readStdin: async () => JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm i ghostpkg' } }),
    analyze: async () => [analysis('ghostpkg', 'critical')],
    readFile: noConfig,
    write: () => {},
    log: () => {},
  });
  assert.equal(code, 0);
});
