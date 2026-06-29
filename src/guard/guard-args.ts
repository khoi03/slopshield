import { parseArgs } from 'node:util';

import { VALID_FAIL_ON } from '../config.ts';
import type { FailOn, Specifier } from '../types.ts';
import type { GuardFlags } from './config.ts';
import { parseInstallArgs } from './install-args.ts';

/** Result of parsing `guard` CLI arguments. */
export interface ParsedGuardArgs {
  readonly help: boolean;
  /** The offending value when `--fail-on` was given an invalid level, else undefined. */
  readonly invalidFailOn?: string;
  readonly flags: GuardFlags;
  /** Package specifiers to gate (npm install flags are stripped out). */
  readonly specifiers: readonly Specifier[];
  /** False only when no arguments were given at all (a usage error for direct use). */
  readonly hadArgs: boolean;
}

/**
 * Parse `guard` arguments.
 *
 * The guard is also the target of the `init-shell` npm shadow, so it must
 * tolerate raw `npm install` flags (e.g. `--save-dev`, `-g`). slopshield's own
 * options are read leniently (`strict: false`) so unknown npm flags never throw,
 * and the remaining tokens are run through the same `parseInstallArgs` used by
 * `install` — sharing the flag/specifier split so only real package specifiers
 * are checked.
 */
export function parseGuardArgs(args: readonly string[]): ParsedGuardArgs {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: false,
    options: {
      block: { type: 'boolean' },
      allow: { type: 'string', multiple: true },
      'fail-on': { type: 'string' },
      help: { type: 'boolean' },
    },
  });

  const rawFailOn = typeof values['fail-on'] === 'string' ? values['fail-on'] : undefined;
  const invalidFailOn =
    rawFailOn !== undefined && !VALID_FAIL_ON.includes(rawFailOn) ? rawFailOn : undefined;

  const allow = Array.isArray(values['allow'])
    ? values['allow'].filter((v): v is string => typeof v === 'string')
    : undefined;

  const { specifiers } = parseInstallArgs(positionals);

  return {
    help: values['help'] === true,
    invalidFailOn,
    flags: {
      block: values['block'] === true,
      allow,
      failOn: invalidFailOn === undefined ? (rawFailOn as FailOn | undefined) : undefined,
    },
    specifiers,
    hadArgs: args.length > 0,
  };
}
