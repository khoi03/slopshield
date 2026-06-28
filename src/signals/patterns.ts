import type { KnownSlop, Signal } from '../types.ts';

/** Compile a regex source, returning null (and skipping it) if it is invalid. */
function compile(source: string): RegExp | null {
  try {
    return new RegExp(source, 'i');
  } catch {
    return null;
  }
}

/**
 * Signal (e): the name matches a curated known-hallucination / typosquat entry.
 *
 * Matches either an exact name on the seed list (case-insensitive) or any of
 * the seed regex patterns. Invalid patterns are skipped rather than thrown, so
 * a bad data entry can never crash a scan.
 */
export function patterns(name: string, knownSlop: KnownSlop): Signal {
  const lower = name.toLowerCase();

  const onNameList = knownSlop.names.some((n) => n.toLowerCase() === lower);
  if (onNameList) {
    return {
      id: 'known-slop',
      triggered: true,
      reason: `"${name}" is on the known hallucinated/typosquat list.`,
    };
  }

  for (const source of knownSlop.patterns) {
    const regex = compile(source);
    if (regex !== null && regex.test(name)) {
      return {
        id: 'known-slop',
        triggered: true,
        reason: `Name matches a known typosquat pattern (/${source}/).`,
      };
    }
  }

  return { id: 'known-slop', triggered: false };
}
