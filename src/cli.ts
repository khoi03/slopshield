import { parseArgs } from 'node:util';

import pkg from '../package.json' with { type: 'json' };
import { analyzeNames } from './analyzer.ts';
import {
  DEFAULT_FAIL_ON,
  EXIT_BLOCKED,
  EXIT_OK,
  EXIT_USAGE,
  INSTALL_SUBCOMMANDS,
  VALID_FAIL_ON,
} from './config.ts';
import { loadKnownSlop, loadPopular } from './data/loader.ts';
import { deriveExitCode, formatHuman, formatJson } from './format.ts';
import { parseGuardArgs } from './guard/guard-args.ts';
import { runGuard, runInstall } from './guard/runner.ts';
import { shellInitSnippet, type SupportedShell } from './guard/shell-init.ts';
import { resolveInputs } from './inputs.ts';
import { createRegistryClient } from './registry/client.ts';
import type { FailOn } from './types.ts';

const VALID_SHELLS: readonly string[] = ['bash', 'zsh', 'fish'];

const USAGE = `slopshield — flag AI-hallucinated and typosquatted npm packages before you install them.

Usage:
  slopshield <pkg...>                    Scan package names (default; alias: "scan")
  slopshield scan --file package.json    Scan a manifest or newline-delimited list
  slopshield guard <pkg...>              Gate by exit code (for CI / shell integration)
  slopshield install <npm-args...>       Pre-check, then run "npm install <npm-args>"
  slopshield init-shell [bash|zsh|fish]  Print a shell function that auto-guards npm install

Options (scan/guard):
  --file <path>      (scan) read names from a package.json or newline list
  --json             (scan) machine-readable JSON output
  --fail-on <level>  exit non-zero at this level or above: safe|medium|high|critical|none (default ${DEFAULT_FAIL_ON})
  --block            (guard) block risky packages instead of warning
  --allow <name>     (guard) exempt a package by name (repeatable)
  --version          show the installed version
  --help             show this help

Install-guard policy (mode / allow / failOn) is read from "package.json#slopshield".
Exit codes: 0 = ok, 1 = risky/blocked, 2 = usage error. An "unknown" verdict never fails.`;

function isFailOn(value: string): value is FailOn {
  return VALID_FAIL_ON.includes(value);
}

/** `scan` (and bare) — the Milestone 1 read-only check. */
async function runScan(args: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      file: { type: 'string' },
      json: { type: 'boolean', default: false },
      'fail-on': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return EXIT_OK;
  }

  const failOn = values['fail-on'] ?? DEFAULT_FAIL_ON;
  if (!isFailOn(failOn)) {
    console.error(`Invalid --fail-on value: "${failOn}". Use one of: ${VALID_FAIL_ON.join(', ')}.`);
    return EXIT_USAGE;
  }

  const names = await resolveInputs({ positional: positionals, file: values.file });
  if (names.length === 0) {
    console.error('No packages to check. Pass package names or --file <path>.\n');
    console.error(USAGE);
    return EXIT_BLOCKED;
  }

  const analyses = await analyzeNames(names, {
    client: createRegistryClient(),
    popular: loadPopular(),
    knownSlop: loadKnownSlop(),
  });
  console.log(values.json ? formatJson(analyses) : formatHuman(analyses));
  return deriveExitCode(analyses, failOn);
}

/**
 * `guard` — pure gate by exit code (no install). Also the target of the
 * `init-shell` npm shadow, so it tolerates raw `npm install` flags via
 * `parseGuardArgs` (shared specifier parsing with `install`).
 */
async function runGuardCommand(args: readonly string[]): Promise<number> {
  const parsed = parseGuardArgs(args);

  if (parsed.help) {
    console.log(USAGE);
    return EXIT_OK;
  }
  if (parsed.invalidFailOn !== undefined) {
    console.error(
      `Invalid --fail-on value: "${parsed.invalidFailOn}". Use one of: ${VALID_FAIL_ON.join(', ')}.`,
    );
    return EXIT_USAGE;
  }
  if (!parsed.hadArgs) {
    console.error('No packages to guard. Pass one or more package names.');
    return EXIT_USAGE;
  }
  // Only npm flags were passed (e.g. the shell shadow on `npm install --save-dev`):
  // there is nothing to check, so allow the install to proceed.
  if (parsed.specifiers.length === 0) return EXIT_OK;

  return runGuard(
    parsed.specifiers.map((s) => s.raw),
    parsed.flags,
  );
}

function runInitShell(args: readonly string[]): number {
  const shell = args[0] ?? 'bash';
  if (!VALID_SHELLS.includes(shell)) {
    console.error(`Unsupported shell: "${shell}". Use one of: ${VALID_SHELLS.join(', ')}.`);
    return EXIT_USAGE;
  }
  console.log(shellInitSnippet(shell as SupportedShell));
  return EXIT_OK;
}

async function main(argv: readonly string[]): Promise<number> {
  const command = argv[0];
  const rest = argv.slice(1);

  // `--version`/`-v` short-circuits from any position (top-level or after a
  // subcommand) so it never falls through to a parser that rejects it.
  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(pkg.version);
    return EXIT_OK;
  }
  if (command === 'guard') return runGuardCommand(rest);
  if (command !== undefined && (INSTALL_SUBCOMMANDS as readonly string[]).includes(command)) {
    // Install policy comes from package.json#slopshield; npm args pass through verbatim.
    return runInstall(rest, {});
  }
  if (command === 'init-shell') return runInitShell(rest);
  if (command === 'scan') return runScan(rest);

  // Bare invocation (back-compat): treat all args as scan targets / --help.
  return runScan(argv);
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`slopshield: ${message}`);
    process.exit(EXIT_USAGE);
  });
