import type { Specifier, SpecifierKind } from '../types.ts';

const GIT_PREFIX = /^(git\+|git:|git@|github:|gitlab:|bitbucket:)/i;
const URL_PREFIX = /^https?:\/\//i;
const FILE_PREFIX = /^(\.\.?\/|\/|~\/|file:)/;

/** Classify a specifier; only `registry` names are checkable against npm. */
function classify(raw: string): SpecifierKind {
  if (raw.includes('@npm:')) return 'alias';
  if (GIT_PREFIX.test(raw)) return 'git';
  if (URL_PREFIX.test(raw)) return 'url';
  if (FILE_PREFIX.test(raw)) return 'file';
  // bare "user/repo" GitHub shorthand: contains a slash but is not a scoped name
  if (!raw.startsWith('@') && raw.includes('/')) return 'git';
  return 'registry';
}

/** Strip the `@version` / `@tag` from a registry specifier, keeping any scope. */
function stripVersion(raw: string): string {
  // Scoped names start with '@', so the version delimiter is the *second* '@'.
  const searchFrom = raw.startsWith('@') ? 1 : 0;
  const at = raw.indexOf('@', searchFrom);
  return at === -1 ? raw : raw.slice(0, at);
}

/**
 * Parse one install specifier into a normalized form. Non-registry specifiers
 * (git/url/file/alias) are returned as `checkable: false` so the guard passes
 * them through unchecked rather than guessing.
 */
export function normalizeSpecifier(raw: string): Specifier {
  const trimmed = raw.trim();
  const kind = classify(trimmed);
  const name = kind === 'registry' ? stripVersion(trimmed) : trimmed;
  return { raw, name, kind, checkable: kind === 'registry' };
}
