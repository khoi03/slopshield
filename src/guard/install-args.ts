import { normalizeSpecifier } from './specifier.ts';
import type { ParsedInstall, Specifier } from '../types.ts';

/** Flags that consume the following token as their value (so it isn't a package). */
const VALUE_FLAGS = new Set([
  '--registry',
  '--prefix',
  '--workspace',
  '-w',
  '--omit',
  '--include',
  '--save-prefix',
  '--userconfig',
  '--cache',
  '--tag',
  '--before',
]);

const GLOBAL_FLAGS = new Set(['-g', '--global']);

/**
 * Parse the argument list of an `npm install …` invocation into the package
 * specifiers to check plus whether the install is global. Conservative: any
 * token that is not a flag (or a flag's value) is treated as a specifier, and
 * nothing here ever throws — unparseable shapes simply surface for checking.
 */
export function parseInstallArgs(argv: readonly string[]): ParsedInstall {
  const specifiers: Specifier[] = [];
  let global = false;
  let skipNext = false;

  for (const token of argv) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (token.startsWith('-')) {
      if (GLOBAL_FLAGS.has(token)) global = true;
      // "--flag value" (not "--flag=value") consumes the next token as its value
      if (VALUE_FLAGS.has(token) && !token.includes('=')) skipNext = true;
      continue;
    }
    specifiers.push(normalizeSpecifier(token));
  }

  return { specifiers, global };
}
