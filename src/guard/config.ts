import { join } from 'node:path';

import {
  CONFIG_FIELD,
  DEFAULT_FAIL_ON,
  DEFAULT_GUARD_MODE,
  PACKAGE_JSON_FILE,
} from '../config.ts';
import type { FailOn, GuardConfig, GuardMode } from '../types.ts';
import { defaultReadFile, type ReadFile } from '../inputs.ts';

const VALID_MODES: readonly string[] = ['warn', 'block'];
const VALID_FAIL_ON: readonly string[] = ['safe', 'medium', 'high', 'critical', 'none'];

/** CLI overrides for guard policy. */
export interface GuardFlags {
  readonly block?: boolean;
  readonly failOn?: FailOn;
  readonly allow?: readonly string[];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Merge a raw `slopshield` config field with CLI flags into a validated
 * `GuardConfig`. Pure. Invalid field values fall back to defaults (fail-open),
 * and CLI flags always win over the file.
 */
export function mergeGuardConfig(field: unknown, flags: GuardFlags): GuardConfig {
  const f = (typeof field === 'object' && field !== null ? field : {}) as Record<string, unknown>;

  const rawMode = f['mode'];
  const fieldMode =
    typeof rawMode === 'string' && VALID_MODES.includes(rawMode) ? (rawMode as GuardMode) : undefined;
  const mode: GuardMode = flags.block ? 'block' : (fieldMode ?? DEFAULT_GUARD_MODE);

  const rawFailOn = f['failOn'];
  const fieldFailOn =
    typeof rawFailOn === 'string' && VALID_FAIL_ON.includes(rawFailOn)
      ? (rawFailOn as FailOn)
      : undefined;
  const failOn: FailOn = flags.failOn ?? fieldFailOn ?? DEFAULT_FAIL_ON;

  const allow = new Set<string>([...asStringArray(f['allow']), ...(flags.allow ?? [])]);

  return { mode, failOn, allow };
}

/**
 * Read `package.json#slopshield` from `cwd` and merge it with CLI flags. A
 * missing or malformed manifest falls back to defaults (never throws).
 */
export async function resolveGuardConfig(
  flags: GuardFlags,
  readFile: ReadFile = defaultReadFile,
  cwd: string = process.cwd(),
): Promise<GuardConfig> {
  const field = await readConfigField(join(cwd, PACKAGE_JSON_FILE), readFile);
  return mergeGuardConfig(field, flags);
}

async function readConfigField(path: string, readFile: ReadFile): Promise<unknown> {
  try {
    const json: unknown = JSON.parse(await readFile(path));
    if (typeof json === 'object' && json !== null) {
      return (json as Record<string, unknown>)[CONFIG_FIELD];
    }
  } catch {
    // missing or malformed package.json ⇒ defaults (fail-open)
  }
  return undefined;
}
