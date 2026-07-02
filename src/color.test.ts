import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPalette, plainPalette, shouldColorize } from './color.ts';

const ESC = '\x1b[';

test('createPalette(false) returns every colorizer as identity', () => {
  const p = createPalette(false);

  assert.equal(p.green('x'), 'x');
  assert.equal(p.yellow('x'), 'x');
  assert.equal(p.red('x'), 'x');
  assert.equal(p.bold('x'), 'x');
  assert.equal(p.dim('x'), 'x');
});

test('plainPalette leaves text untouched', () => {
  assert.equal(plainPalette.green('safe'), 'safe');
  assert.equal(plainPalette.dim('  • reason'), '  • reason');
});

test('createPalette(true) wraps each color with its ANSI open/close codes', () => {
  const p = createPalette(true);

  assert.equal(p.green('ok'), `${ESC}32mok${ESC}39m`);
  assert.equal(p.yellow('warn'), `${ESC}33mwarn${ESC}39m`);
  assert.equal(p.red('bad'), `${ESC}31mbad${ESC}39m`);
  assert.equal(p.bold('b'), `${ESC}1mb${ESC}22m`);
  assert.equal(p.dim('d'), `${ESC}2md${ESC}22m`);
});

test('createPalette(true) nests styles without leaking (critical = bold red)', () => {
  const p = createPalette(true);

  const out = p.bold(p.red('✖'));

  // outer bold wraps the red-wrapped marker; both codes and the glyph survive.
  assert.equal(out, `${ESC}1m${ESC}31m✖${ESC}39m${ESC}22m`);
});

test('shouldColorize: --no-color flag disables color even with FORCE_COLOR + TTY', () => {
  assert.equal(
    shouldColorize({ isTTY: true, noColorFlag: true, env: { FORCE_COLOR: '1' } }),
    false,
  );
});

test('shouldColorize: FORCE_COLOR enables color even when not a TTY', () => {
  assert.equal(shouldColorize({ isTTY: false, noColorFlag: false, env: { FORCE_COLOR: '1' } }), true);
});

test('shouldColorize: FORCE_COLOR="0" disables color even on a TTY', () => {
  assert.equal(shouldColorize({ isTTY: true, noColorFlag: false, env: { FORCE_COLOR: '0' } }), false);
});

test('shouldColorize: FORCE_COLOR="" (present, empty) enables color', () => {
  assert.equal(shouldColorize({ isTTY: false, noColorFlag: false, env: { FORCE_COLOR: '' } }), true);
});

test('shouldColorize: FORCE_COLOR wins over NO_COLOR', () => {
  assert.equal(
    shouldColorize({ isTTY: false, noColorFlag: false, env: { FORCE_COLOR: '1', NO_COLOR: '1' } }),
    true,
  );
});

test('shouldColorize: NO_COLOR disables color even on a TTY', () => {
  assert.equal(shouldColorize({ isTTY: true, noColorFlag: false, env: { NO_COLOR: '1' } }), false);
});

test('shouldColorize: empty NO_COLOR is ignored, falls back to TTY', () => {
  assert.equal(shouldColorize({ isTTY: true, noColorFlag: false, env: { NO_COLOR: '' } }), true);
  assert.equal(shouldColorize({ isTTY: false, noColorFlag: false, env: { NO_COLOR: '' } }), false);
});

test('shouldColorize: with no signals, follows the TTY state', () => {
  assert.equal(shouldColorize({ isTTY: true, noColorFlag: false, env: {} }), true);
  assert.equal(shouldColorize({ isTTY: false, noColorFlag: false, env: {} }), false);
});
