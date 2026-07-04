/**
 * The `check_package` MCP tool: the one capability slopshield exposes to agents.
 *
 * An agent calls it with the npm package names it is about to suggest or install
 * and gets back a risk verdict per name. Risk is not a tool error — a risky
 * verdict is a *successful* check — so `isError` stays false; genuine failures
 * are handled by the server as protocol errors or `isError: true` results.
 */

import { MCP_MAX_NAMES, MCP_TOOL_NAME } from '../config.ts';
import { formatHuman } from '../format.ts';
import type { AnalyzeNames } from '../engine.ts';
import type { PackageAnalysis, Verdict } from '../types.ts';

/** A text content item, the only MCP content type this tool returns. */
export interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

/** Machine-readable per-package result carried in `structuredContent`. */
export interface PackageCheck {
  readonly name: string;
  readonly verdict: Verdict;
  /** True when the verdict is worth acting on (medium/high/critical). */
  readonly risky: boolean;
  readonly reasons: readonly string[];
}

/** The `tools/call` result shape for `check_package`. */
export interface CheckPackageResult {
  readonly content: readonly TextContent[];
  readonly isError: boolean;
  readonly structuredContent: { readonly packages: readonly PackageCheck[] };
}

/** Verdicts an agent should treat as a reason to reconsider. `unknown` is fail-open. */
const RISKY_LEVELS: ReadonlySet<Verdict> = new Set<Verdict>(['medium', 'high', 'critical']);

/** The MCP tool descriptor returned by `tools/list`. */
export const checkPackageTool = {
  name: MCP_TOOL_NAME,
  description:
    'Check one or more npm package names for slopsquatting, typosquatting, or hallucination risk BEFORE suggesting or installing them. Returns a verdict (safe, medium, high, critical, or unknown) with reasons for each name. Call this whenever you are about to recommend or run "npm install".',
  inputSchema: {
    type: 'object',
    properties: {
      names: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: MCP_MAX_NAMES,
        description: 'npm package names to check, e.g. ["express", "reqeust"].',
      },
    },
    required: ['names'],
  },
} as const;

/**
 * Validate and normalize the `arguments.names` field from a `tools/call`.
 * Returns null when it is absent, not an array, or has no usable names, so the
 * server can reply with an invalid-params error.
 */
export function parseNamesArgument(args: unknown): string[] | null {
  if (typeof args !== 'object' || args === null) return null;
  const names = (args as Record<string, unknown>)['names'];
  if (!Array.isArray(names)) return null;

  const cleaned = names
    .filter((n): n is string => typeof n === 'string')
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .slice(0, MCP_MAX_NAMES); // bound registry fan-out from a single call

  return cleaned.length > 0 ? cleaned : null;
}

/** Analyze the given names and shape the verdicts into an MCP tool result. */
export async function runCheckPackage(
  names: readonly string[],
  analyze: AnalyzeNames,
): Promise<CheckPackageResult> {
  const analyses = await analyze(names);
  return {
    content: [{ type: 'text', text: formatHuman(analyses) }],
    isError: false,
    structuredContent: { packages: analyses.map(toPackageCheck) },
  };
}

function toPackageCheck(analysis: PackageAnalysis): PackageCheck {
  return {
    name: analysis.name,
    verdict: analysis.level,
    risky: RISKY_LEVELS.has(analysis.level),
    reasons: analysis.reasons,
  };
}
