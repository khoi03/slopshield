/**
 * Zero-dependency ANSI coloring for the human-readable CLI output.
 *
 * The whole module is a hand-rolled palette so slopshield keeps its headline
 * promise of zero runtime dependencies. Colorizers are injectable (mirroring
 * the `fetch`/`spawn` injection elsewhere): callers pass a `Palette` down to the
 * formatters, so tests and `--json` can force the plain (identity) palette.
 */

/** Wraps a string in a style, or returns it unchanged when color is disabled. */
export type Colorize = (text: string) => string;

/** The semantic styles the renderers use. Composable: `bold(red(x))` is valid. */
export interface Palette {
  readonly green: Colorize;
  readonly yellow: Colorize;
  readonly red: Colorize;
  readonly bold: Colorize;
  readonly dim: Colorize;
}

const identity: Colorize = (text) => text;

/** No-op palette: every style returns its input verbatim. The safe default. */
export const plainPalette: Palette = {
  green: identity,
  yellow: identity,
  red: identity,
  bold: identity,
  dim: identity,
};

/**
 * Build a colorizer with a specific SGR open code and its matching reset.
 * Colors reset with `39` (default foreground) and weights with `22` (normal
 * intensity) so nested styles close only their own effect and never leak.
 */
function style(open: number, close: number): Colorize {
  return (text) => `\x1b[${open}m${text}\x1b[${close}m`;
}

const ansiPalette: Palette = {
  green: style(32, 39),
  yellow: style(33, 39),
  red: style(31, 39),
  bold: style(1, 22),
  dim: style(2, 22),
};

/** Return the ANSI palette when `enabled`, otherwise the identity palette. */
export function createPalette(enabled: boolean): Palette {
  return enabled ? ansiPalette : plainPalette;
}

/** Inputs for the color-enablement decision. Pure — no `process` reads inside. */
export interface ColorContext {
  /** Whether the target stream is a terminal (`stdout` for scan, `stderr` for guard). */
  readonly isTTY: boolean;
  /** The `--no-color` CLI flag. */
  readonly noColorFlag: boolean;
  /** Environment variables (`process.env` in production). */
  readonly env: Readonly<Record<string, string | undefined>>;
}

/**
 * Decide whether to emit ANSI color. Precedence (highest first):
 *   1. `--no-color` flag        → off (explicit CLI intent always wins)
 *   2. `FORCE_COLOR`            → on unless "0"/"false" (overrides NO_COLOR + TTY)
 *   3. `NO_COLOR` (non-empty)   → off
 *   4. otherwise                → follow the stream's TTY state
 */
export function shouldColorize({ isTTY, noColorFlag, env }: ColorContext): boolean {
  if (noColorFlag) return false;

  const forceColor = env['FORCE_COLOR'];
  if (forceColor !== undefined) return forceColor !== '0' && forceColor !== 'false';

  const noColor = env['NO_COLOR'];
  if (noColor !== undefined && noColor !== '') return false;

  return isTTY;
}
