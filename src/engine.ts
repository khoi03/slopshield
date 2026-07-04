/**
 * Shared wiring for the real detection engine.
 *
 * `analyzeNames` takes injected dependencies (registry client + reference data)
 * so the pure engine stays testable. This is the single place that assembles
 * those dependencies for production use — reused by the install guard
 * (`guard/runner.ts`), the MCP server (`mcp/server.ts`), and the Claude Code
 * hook (`hook/hook.ts`) so none of them duplicate the wiring.
 */

import { analyzeNames } from './analyzer.ts';
import { loadKnownSlop, loadPopular } from './data/loader.ts';
import { createRegistryClient } from './registry/client.ts';
import type { PackageAnalysis } from './types.ts';

/** Analyze package names. Injectable so callers can stub the engine in tests. */
export type AnalyzeNames = (names: readonly string[]) => Promise<PackageAnalysis[]>;

/**
 * Build an analyzer bound to the live npm registry and the bundled reference
 * data. `now` is an injectable clock (ms) forwarded to the age signal.
 */
export function createDefaultAnalyze(now?: number): AnalyzeNames {
  return (names) =>
    analyzeNames(names, {
      client: createRegistryClient(),
      popular: loadPopular(),
      knownSlop: loadKnownSlop(),
      now,
    });
}
