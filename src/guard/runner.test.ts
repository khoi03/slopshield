import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runGuard, runInstall } from './runner.ts';
import type { PackageAnalysis, Verdict } from '../types.ts';

function analysis(name: string, level: Verdict): PackageAnalysis {
  return { name, level, score: 0, reasons: [`reason-${level}`], signals: [] };
}

const noConfigFile = async (): Promise<string> => '{}'; // no slopcheck field ⇒ defaults
const silent = (): void => {};

test('runGuard: block mode returns non-zero for a critical package', async () => {
  const analyze = async (): Promise<PackageAnalysis[]> => [analysis('ghost', 'critical')];
  const code = await runGuard(['ghost'], { block: true }, { analyze, readFile: noConfigFile, log: silent });
  assert.equal(code, 1);
});

test('runGuard: returns 0 when everything is safe', async () => {
  const analyze = async (): Promise<PackageAnalysis[]> => [analysis('lodash', 'safe')];
  const code = await runGuard(['lodash'], {}, { analyze, readFile: noConfigFile, log: silent });
  assert.equal(code, 0);
});

test('runGuard: warn mode reports the risk but still allows (exit 0)', async () => {
  const analyze = async (): Promise<PackageAnalysis[]> => [analysis('expresss', 'high')];
  const logs: string[] = [];
  const code = await runGuard(['expresss'], {}, {
    analyze,
    readFile: noConfigFile,
    log: (m) => logs.push(m),
  });
  assert.equal(code, 0);
  assert.match(logs.join('\n'), /expresss/);
});

test('runInstall: block mode does NOT spawn npm and returns non-zero', async () => {
  let spawned = 0;
  const analyze = async (): Promise<PackageAnalysis[]> => [analysis('ghost-x', 'critical')];
  const runCommand = async (): Promise<number> => {
    spawned++;
    return 0;
  };
  const code = await runInstall(['ghost-x'], { block: true }, {
    analyze,
    runCommand,
    readFile: noConfigFile,
    log: silent,
  });
  assert.equal(code, 1);
  assert.equal(spawned, 0);
});

test('runInstall: execs npm with verbatim args for a safe install', async () => {
  const calls: { cmd: string; args: string[] }[] = [];
  const analyze = async (): Promise<PackageAnalysis[]> => [analysis('lodash', 'safe')];
  const runCommand = async (cmd: string, args: readonly string[]): Promise<number> => {
    calls.push({ cmd, args: [...args] });
    return 0;
  };
  const code = await runInstall(['lodash', '--save-dev'], {}, {
    analyze,
    runCommand,
    readFile: noConfigFile,
    log: silent,
  });
  assert.equal(code, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.args, ['install', 'lodash', '--save-dev']);
});

test('runInstall: warn mode + interactive — confirm yes proceeds, no aborts', async () => {
  const analyze = async (): Promise<PackageAnalysis[]> => [analysis('expresss', 'high')];
  let spawned = 0;
  const runCommand = async (): Promise<number> => {
    spawned++;
    return 0;
  };

  const yes = await runInstall(['expresss'], {}, {
    analyze,
    runCommand,
    confirm: async () => true,
    interactive: true,
    readFile: noConfigFile,
    log: silent,
  });
  assert.equal(yes, 0);
  assert.equal(spawned, 1);

  spawned = 0;
  const no = await runInstall(['expresss'], {}, {
    analyze,
    runCommand,
    confirm: async () => false,
    interactive: true,
    readFile: noConfigFile,
    log: silent,
  });
  assert.equal(no, 1);
  assert.equal(spawned, 0);
});

test('runInstall: warn mode + non-interactive (CI) proceeds without prompting', async () => {
  let spawned = 0;
  let confirmCalled = 0;
  const analyze = async (): Promise<PackageAnalysis[]> => [analysis('expresss', 'high')];
  const code = await runInstall(['expresss'], {}, {
    analyze,
    runCommand: async () => {
      spawned++;
      return 0;
    },
    confirm: async () => {
      confirmCalled++;
      return false;
    },
    interactive: false,
    readFile: noConfigFile,
    log: silent,
  });
  assert.equal(code, 0);
  assert.equal(spawned, 1);
  assert.equal(confirmCalled, 0);
});

test('runInstall: non-registry specifiers pass through unchecked and still install verbatim', async () => {
  const calls: string[][] = [];
  const analyze = async (names: readonly string[]): Promise<PackageAnalysis[]> =>
    names.map((n) => analysis(n, 'safe'));
  const code = await runInstall(['express', 'git+https://github.com/u/r.git'], {}, {
    analyze,
    runCommand: async (_cmd, args) => {
      calls.push([...args]);
      return 0;
    },
    readFile: noConfigFile,
    log: silent,
  });
  assert.equal(code, 0);
  assert.deepEqual(calls[0], ['install', 'express', 'git+https://github.com/u/r.git']);
});
