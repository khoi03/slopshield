import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPalette } from '../color.ts';
import { runGuard } from './runner.ts';
import type { PackageAnalysis, Verdict } from '../types.ts';

function analysis(name: string, level: Verdict): PackageAnalysis {
  return { name, level, score: 0, reasons: [`reason-${level}`], signals: [] };
}

const noConfigFile = async (): Promise<string> => '{}';

test('runGuard: colorizes reported output when a color palette is injected', async () => {
  const analyze = async (): Promise<PackageAnalysis[]> => [analysis('expresss', 'high')];
  const logs: string[] = [];

  await runGuard(['expresss'], {}, {
    analyze,
    readFile: noConfigFile,
    log: (m) => logs.push(m),
    palette: createPalette(true),
  });

  assert.match(logs.join('\n'), /\x1b\[/);
});

test('runGuard: reported output stays plain when a plain palette is injected', async () => {
  const analyze = async (): Promise<PackageAnalysis[]> => [analysis('expresss', 'high')];
  const logs: string[] = [];

  await runGuard(['expresss'], {}, {
    analyze,
    readFile: noConfigFile,
    log: (m) => logs.push(m),
    palette: createPalette(false),
  });

  assert.doesNotMatch(logs.join('\n'), /\x1b\[/);
});
