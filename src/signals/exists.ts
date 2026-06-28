import type { PackageData, Signal } from '../types.ts';

/**
 * Signal (a): the package does not exist in the registry.
 *
 * This is the strongest slopsquatting indicator — an AI-hallucinated name that
 * has not (yet) been registered. The scorer treats it as `critical` and
 * short-circuits. When metadata is `unknown` (null), we cannot claim the
 * package is missing, so the signal stays quiet (fail-open).
 */
export function exists(data: PackageData): Signal {
  if (data.metadata !== null && data.metadata.exists === false) {
    return {
      id: 'nonexistent',
      triggered: true,
      reason: 'Package does not exist in the npm registry.',
    };
  }
  return { id: 'nonexistent', triggered: false };
}
