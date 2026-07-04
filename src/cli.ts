import { parseArgs } from 'node:util';

import pkg from '../package.json' with { type: 'json' };
import { analyzeNames } from './analyzer.ts';
import { createPalette, shouldColorize, type Palette } from './color.ts';
import {
  DEFAULT_FAIL_ON,
  EXIT_BLOCKED,
  EXIT_OK,
  EXIT_USAGE,
  INSTALL_SUBCOMMANDS,
  VALID_FAIL_ON,
} from './config.ts';
import { loadKnownSlop, loadPopular } from './data/loader.ts';
import { deriveExitCode, flaggedAnalyses, formatHuman, formatJson, formatSummary } from './format.ts';
import { parseGuardArgs } from './guard/guard-args.ts';
import { runGuard, runInstall } from './guard/runner.ts';
import { shellInitSnippet, type SupportedShell } from './guard/shell-init.ts';
import { runHook } from './hook/hook.ts';
import { resolveInputs } from './inputs.ts';
import { runMcpServer } from './mcp/server.ts';
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
  slopshield mcp                         Run as an MCP server (stdio) exposing a check_package tool
  slopshield hook                        Claude Code PreToolUse hook: block risky agent npm installs

Options (scan/guard):
  --file <path>      (scan) read names from a package.json or newline list
  --json             (scan) machine-readable JSON output
  --quiet            (scan) print only flagged packages, plus a summary line
  --fail-on <level>  exit non-zero at this level or above: safe|medium|high|critical|none (default ${DEFAULT_FAIL_ON})
  --block            (guard) block risky packages instead of warning
  --allow <name>     (guard) exempt a package by name (repeatable)
  --no-color         disable ANSI color (also honors NO_COLOR / FORCE_COLOR)
  --version          show the installed version
  --help             show this help

Install-guard policy (mode / allow / failOn) is read from "package.json#slopshield".
Exit codes: 0 = ok, 1 = risky/blocked, 2 = usage error. An "unknown" verdict never fails.`;

function isFailOn(value: string): value is FailOn {
  return VALID_FAIL_ON.includes(value);
}

/** Build a palette for the given output stream, honoring the color precedence rules. */
function paletteFor(stream: NodeJS.WriteStream, noColorFlag: boolean): Palette {
  return createPalette(shouldColorize({ isTTY: Boolean(stream.isTTY), noColorFlag, env: process.env }));
}

/** `scan` (and bare) — the Milestone 1 read-only check. */
async function runScan(args: readonly string[], noColorFlag: boolean): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      file: { type: 'string' },
      json: { type: 'boolean', default: false },
      quiet: { type: 'boolean', default: false },
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
  // JSON output stays 100% plain and complete (no footer / filtering).
  if (values.json) {
    console.log(formatJson(analyses));
    return deriveExitCode(analyses, failOn);
  }

  // Human output colors against stdout's TTY. `--quiet` prints only flagged
  // packages; a summary footer is added for multi-package scans or in --quiet.
  const palette = paletteFor(process.stdout, noColorFlag);
  const visible = values.quiet ? flaggedAnalyses(analyses) : analyses;
  const showFooter = values.quiet || analyses.length > 1;
  const body = formatHuman(visible, palette);
  const footer = showFooter ? formatSummary(analyses, palette) : '';
  console.log([body, footer].filter(Boolean).join('\n\n'));

  // Exit code is always derived from the full result set, never the filtered view.
  return deriveExitCode(analyses, failOn);
}

/**
 * `guard` — pure gate by exit code (no install). Also the target of the
 * `init-shell` npm shadow, so it tolerates raw `npm install` flags via
 * `parseGuardArgs` (shared specifier parsing with `install`).
 */
async function runGuardCommand(args: readonly string[], noColorFlag: boolean): Promise<number> {
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

  // Guard writes to stderr, so its palette follows the stderr TTY.
  return runGuard(
    parsed.specifiers.map((s) => s.raw),
    parsed.flags,
    { palette: paletteFor(process.stderr, noColorFlag) },
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
  // `--version`/`-v` short-circuits from any position (top-level or after a
  // subcommand) so it never falls through to a parser that rejects it.
  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(pkg.version);
    return EXIT_OK;
  }

  // `--no-color` is a global concern shared by every output path, so strip it
  // once here (package names can never start with `--`) and thread the decision
  // down instead of teaching each subcommand parser about it.
  const noColorFlag = argv.includes('--no-color');
  const cleanArgv = noColorFlag ? argv.filter((arg) => arg !== '--no-color') : argv;
  const command = cleanArgv[0];
  const rest = cleanArgv.slice(1);

  if (command === 'guard') return runGuardCommand(rest, noColorFlag);
  if (command !== undefined && (INSTALL_SUBCOMMANDS as readonly string[]).includes(command)) {
    // Install policy comes from package.json#slopshield; npm args pass through verbatim.
    return runInstall(rest, {}, { palette: paletteFor(process.stderr, noColorFlag) });
  }
  if (command === 'init-shell') return runInitShell(rest);
  // The AI-agent guard surfaces speak their own protocols on stdin/stdout and
  // take no CLI flags of their own.
  if (command === 'mcp') return runMcpServer();
  if (command === 'hook') return runHook();
  if (command === 'scan') return runScan(rest, noColorFlag);

  // Bare invocation (back-compat): treat all args as scan targets / --help.
  return runScan(cleanArgv, noColorFlag);
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`slopshield: ${message}`);
    process.exit(EXIT_USAGE);
  });
