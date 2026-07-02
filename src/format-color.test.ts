import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPalette } from './color.ts';
import { formatGuard, formatHuman, formatJson } from './format.ts';
import type { PackageAnalysis, Verdict } from './types.ts';

const color = createPalette(true);

// ANSI opens used by the palette (see color.ts).
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ESC = '\x1b[';

function analysis(name: string, level: Verdict, reasons: string[] = []): PackageAnalysis {
  return { name, level, score: 0, reasons, signals: [] };
}

test('formatHuman defaults to plain output (no ANSI) when no palette is passed', () => {
  const out = formatHuman([analysis('expresss', 'high', ['looks like express'])]);

  assert.doesNotMatch(out, /\x1b\[/);
});

test('formatHuman colors a safe verdict green', () => {
  const out = formatHuman([analysis('lodash', 'safe')], color);

  assert.ok(out.includes(GREEN), 'expected green ANSI code');
});

test('formatHuman colors a medium verdict yellow', () => {
  const out = formatHuman([analysis('expresss', 'medium', ['looks like express'])], color);

  assert.ok(out.includes(YELLOW), 'expected yellow ANSI code');
});

test('formatHuman colors a high verdict red', () => {
  const out = formatHuman([analysis('reqeust', 'high', ['typo of request'])], color);

  assert.ok(out.includes(RED), 'expected red ANSI code');
});

test('formatHuman renders critical as bold red', () => {
  const out = formatHuman([analysis('ghost', 'critical', ['does not exist'])], color);

  assert.ok(out.includes(BOLD), 'expected bold ANSI code');
  assert.ok(out.includes(RED), 'expected red ANSI code');
});

test('formatHuman dims an unknown verdict', () => {
  const out = formatHuman([analysis('offline-pkg', 'unknown', ['registry lookup failed'])], color);

  assert.ok(out.includes(DIM), 'expected dim ANSI code');
});

test('formatHuman dims reason lines', () => {
  const out = formatHuman([analysis('reqeust', 'high', ['typo of request'])], color);

  // The reason text is wrapped by the dim style.
  assert.match(out, new RegExp(`\\x1b\\[2m[^\\x1b]*typo of request`));
});

test('formatJson never contains ANSI codes', () => {
  const out = formatJson([analysis('ghost', 'critical', ['does not exist'])]);

  assert.doesNotMatch(out, /\x1b\[/);
});

test('formatGuard defaults to plain output (no ANSI) when no palette is passed', () => {
  const out = formatGuard({
    action: 'block',
    blocked: [analysis('ghost', 'critical', ['does not exist'])],
    warned: [analysis('expresss', 'medium', ['looks like express'])],
  });

  assert.doesNotMatch(out, /\x1b\[/);
});

test('formatGuard colors blocked packages red and warnings yellow', () => {
  const out = formatGuard(
    {
      action: 'block',
      blocked: [analysis('ghost', 'critical', ['does not exist'])],
      warned: [analysis('expresss', 'medium', ['looks like express'])],
    },
    color,
  );

  assert.ok(out.includes(RED), 'expected red for the blocked package');
  assert.ok(out.includes(YELLOW), 'expected yellow for the warning');
});

test('formatGuard colored output still carries the plain text content', () => {
  const out = formatGuard(
    { action: 'allow', blocked: [], warned: [analysis('expresss', 'medium', ['looks like express'])] },
    color,
  );

  assert.match(out, /expresss/);
  assert.match(out, /looks like express/);
  assert.ok(out.startsWith(ESC) || out.includes(ESC), 'expected ANSI styling present');
});
