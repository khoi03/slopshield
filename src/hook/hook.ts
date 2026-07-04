/**
 * The `slopshield hook` handler: a Claude Code `PreToolUse` guard for agents.
 *
 * It reads the PreToolUse payload on stdin, and when the agent is about to run
 * an `npm install`, checks the target packages with the real engine. On a
 * blocking verdict it emits a `permissionDecision: "deny"`; on a lesser risk it
 * escalates to the user with `"ask"`; otherwise it stays silent and lets the
 * normal flow proceed. It always exits 0 — the decision travels in the JSON,
 * not the exit code — and fails open on anything it cannot confidently parse.
 */

import { isAbsolute } from 'node:path';

import { EXIT_OK } from '../config.ts';
import { createDefaultAnalyze, type AnalyzeNames } from '../engine.ts';
import { resolveGuardConfig } from '../guard/config.ts';
import { decide } from '../guard/policy.ts';
import { defaultReadFile, type ReadFile } from '../inputs.ts';
import type { GuardDecision, PackageAnalysis } from '../types.ts';
import { extractInstallSpecifiers } from './command-parse.ts';
import { parsePreToolUsePayload } from './payload.ts';

/** PreToolUse permission decisions this hook can return. */
type PermissionDecision = 'deny' | 'ask';

export interface HookDeps {
  readonly readStdin?: () => Promise<string>;
  readonly analyze?: AnalyzeNames;
  readonly readFile?: ReadFile;
  /** Sink for the decision JSON (stdout by default). */
  readonly write?: (line: string) => void;
  /** Diagnostic logger — MUST NOT write to stdout. Defaults to stderr. */
  readonly log?: (message: string) => void;
  readonly cwd?: string;
  readonly now?: number;
}

async function defaultReadStdin(): Promise<string> {
  const chunks: string[] = [];
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) chunks.push(chunk as string);
  return chunks.join('');
}

/** One concise line per risky package, phrased so the model can self-correct. */
function summarize(analyses: readonly PackageAnalysis[]): string {
  return analyses
    .map((a) => {
      const reason = a.reasons[0]?.replace(/\.\s*$/, '');
      return `${a.name} (${a.level})${reason ? ` — ${reason}` : ''}`;
    })
    .join('; ');
}

function decisionOutput(decision: GuardDecision, permission: PermissionDecision): string {
  const flagged = permission === 'deny' ? decision.blocked : decision.warned;
  const verb = permission === 'deny' ? 'blocked' : 'flagged';
  const reason =
    `slopshield ${verb} risky npm package(s): ${summarize(flagged)}. ` +
    'These names may be hallucinated or typosquatted — verify the exact package on npmjs.com before installing.';
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: permission,
      permissionDecisionReason: reason,
    },
  });
}

/** Prefer an absolute cwd from the payload; otherwise fall back safely. */
function safeCwd(fromPayload: string | null, fromDeps: string | undefined): string {
  if (fromPayload !== null && isAbsolute(fromPayload)) return fromPayload;
  return fromDeps ?? process.cwd();
}

export async function runHook(deps: HookDeps = {}): Promise<number> {
  const write = deps.write ?? ((line) => void process.stdout.write(line));
  const log = deps.log ?? ((message) => void process.stderr.write(`${message}\n`));
  const analyze = deps.analyze ?? createDefaultAnalyze(deps.now);
  const readFile = deps.readFile ?? defaultReadFile;

  // The entire body is guarded: this hook must ALWAYS exit 0 (it denies via JSON,
  // never via exit code), so no error may escape to the CLI's exit-2 fallback.
  try {
    const stdin = deps.readStdin ? await deps.readStdin() : await defaultReadStdin();
    const payload = parsePreToolUsePayload(stdin);

    // Only Bash tool calls carrying a command are in scope; anything else defers.
    if (payload === null || payload.toolName !== 'Bash' || payload.command === null) return EXIT_OK;

    const toCheck = extractInstallSpecifiers(payload.command)
      .filter((s) => s.checkable)
      .map((s) => s.name);
    if (toCheck.length === 0) return EXIT_OK;

    // Guard posture: force block so high/critical are hard-denied; the allowlist
    // and fail-on threshold still come from package.json#slopshield.
    const config = await resolveGuardConfig({ block: true }, readFile, safeCwd(payload.cwd, deps.cwd));
    const names = toCheck.filter((name) => !config.allow.has(name));
    if (names.length === 0) return EXIT_OK;

    const decision = decide(await analyze(names), config);
    if (decision.blocked.length > 0) write(decisionOutput(decision, 'deny'));
    else if (decision.warned.length > 0) write(decisionOutput(decision, 'ask'));
  } catch (error) {
    // Fail open: any failure (stdin read, engine, config) must never block work.
    log(`slopshield hook check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return EXIT_OK;
}
