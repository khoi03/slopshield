/**
 * Extract the npm package specifiers an agent's shell command would install.
 *
 * This reads an arbitrary Bash command string (not a clean argv), so it uses a
 * small quote-aware lexer and is deliberately fail-open: it reports specifiers
 * only when it confidently recognizes an `npm install|i|add` invocation, and
 * returns nothing for anything ambiguous.
 *
 * Known, intentional limitations (a hook is best-effort defense-in-depth, not a
 * sandbox — see README): shell indirection that resolves at runtime — command
 * substitution `$(…)` / `` `…` `` and variable expansion `$VAR` — is not
 * resolved and passes through unchecked; only npm is covered (yarn/pnpm/npx are
 * a follow-up). Backslash escapes and quoting ARE resolved so obfuscated but
 * literal names (e.g. `evil\-pkg`, `"evil""-pkg"`, `"pkg@>=1 <2"`) still check.
 */

import { parseInstallArgs } from '../guard/install-args.ts';
import { normalizeSpecifier } from '../guard/specifier.ts';
import type { Specifier } from '../types.ts';

/** npm subcommands that add new packages. */
const INSTALL_SUBCOMMANDS = new Set(['install', 'i', 'add']);

/** Wrapper programs that may precede the real command (e.g. `sudo npm i x`). */
const COMMAND_PREFIXES = new Set(['sudo', 'env', 'command', 'exec', 'nice', 'time', 'doas']);

/** An environment-assignment prefix such as `FOO=bar npm i x`. */
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * A plausible npm package name (optionally scoped). Registry "specifiers" that
 * fail this — redirect targets, shell variables, stray operators — are dropped
 * so the guard never false-blocks on shell noise.
 */
const PLAUSIBLE_NPM_NAME = /^(?:@[a-z0-9-._]+\/)?[a-z0-9-._]+$/i;

/**
 * Lex a command line into segments (split on shell control/redirection
 * operators) of whitespace-separated words, resolving quotes and backslash
 * escapes the way a shell would. Runtime indirection (`$(…)`, backticks, `$VAR`)
 * is preserved verbatim so it later fails the plausible-name filter rather than
 * being mistaken for a real package.
 */
function lexSegments(command: string): string[][] {
  const segments: string[][] = [];
  let words: string[] = [];
  let current = '';
  let hasWord = false;

  const endWord = (): void => {
    if (hasWord) words.push(current);
    current = '';
    hasWord = false;
  };
  const endSegment = (): void => {
    endWord();
    segments.push(words);
    words = [];
  };
  const consumeTo = (from: number, closer: string, keepDelims: boolean): number => {
    const close = command.indexOf(closer, from + 1);
    const end = close === -1 ? command.length : close;
    current += keepDelims ? command.slice(from, end + 1) : command.slice(from + 1, end);
    hasWord = true;
    return end;
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;
    const next = command[i + 1];

    if (ch === '"' || ch === "'") {
      i = consumeTo(i, ch, false); // quoted run: content only, adjacent runs merge
    } else if (ch === '`') {
      i = consumeTo(i, '`', true); // command substitution: keep as noise
    } else if (ch === '$' && next === '(') {
      i = consumeTo(i + 1, ')', true); // $(...) substitution: keep as noise
    } else if (ch === '\\' && next !== undefined) {
      current += next; // resolve the escape (e.g. evil\-pkg -> evil-pkg)
      hasWord = true;
      i++;
    } else if (ch === ' ' || ch === '\t' || ch === '\r') {
      endWord();
    } else if (ch === '\n' || ch === ';' || ch === '<') {
      endSegment();
    } else if (ch === '&' || ch === '|') {
      endSegment();
      if (next === ch) i++; // collapse && and ||
    } else if (ch === '>') {
      if (/^\d+$/.test(current)) { current = ''; hasWord = false; } // drop fd like 2>
      endSegment();
      if (next === '>') i++;
    } else {
      current += ch;
      hasWord = true;
    }
  }
  endSegment();
  return segments;
}

/** True when a program token invokes npm, by basename and case-insensitively. */
function isNpm(token: string): boolean {
  return token.split('/').pop()?.toLowerCase() === 'npm';
}

/** Resolve an `pkg@npm:target` alias to its real target so it is checked, not skipped. */
function resolveAlias(specifier: Specifier): Specifier {
  if (specifier.kind !== 'alias') return specifier;
  const marker = specifier.raw.indexOf('@npm:');
  if (marker === -1) return specifier;
  const target = specifier.raw.slice(marker + '@npm:'.length);
  return target.length > 0 ? normalizeSpecifier(target) : specifier;
}

/** Keep non-registry specifiers (git/url pass through unchecked); drop registry noise. */
function isRealSpecifier(specifier: Specifier): boolean {
  return specifier.kind !== 'registry' || PLAUSIBLE_NPM_NAME.test(specifier.name);
}

/** Install specifiers from one segment, or none when it is not an npm install. */
function specifiersFromSegment(words: readonly string[]): Specifier[] {
  let index = 0;
  while (
    index < words.length &&
    (COMMAND_PREFIXES.has(words[index]!) || ENV_ASSIGNMENT.test(words[index]!))
  ) {
    index++;
  }
  if (index >= words.length || !isNpm(words[index]!)) return [];

  // The first non-flag token after `npm` is the subcommand (skips e.g. `--prefix x`).
  const rest = words.slice(index + 1);
  const subIndex = rest.findIndex((token) => !token.startsWith('-'));
  if (subIndex === -1 || !INSTALL_SUBCOMMANDS.has(rest[subIndex]!)) return [];

  return parseInstallArgs(rest.slice(subIndex + 1)).specifiers.map(resolveAlias);
}

/** All install specifiers across every npm-install segment of the command. */
export function extractInstallSpecifiers(command: string): Specifier[] {
  return lexSegments(command).flatMap(specifiersFromSegment).filter(isRealSpecifier);
}
