import { spawn } from 'node:child_process';

import { analyzeNames } from '../analyzer.ts';
import { createPalette, shouldColorize, type Palette } from '../color.ts';
import { EXIT_BLOCKED, EXIT_OK, EXIT_USAGE } from '../config.ts';
import { loadKnownSlop, loadPopular } from '../data/loader.ts';
import { formatGuard } from '../format.ts';
import { createRegistryClient } from '../registry/client.ts';
import type { GuardConfig, GuardDecision, PackageAnalysis, Specifier } from '../types.ts';
import type { ReadFile } from '../inputs.ts';
import { resolveGuardConfig, type GuardFlags } from './config.ts';
import { parseInstallArgs } from './install-args.ts';
import { decide } from './policy.ts';
import { confirm } from './prompt.ts';
import { normalizeSpecifier } from './specifier.ts';

/** Runs an external command and resolves with its exit code. Injectable for tests. */
export type RunCommand = (command: string, args: readonly string[]) => Promise<number>;

/** Analyzes package names. Injectable for tests (defaults to the live engine). */
export type Analyze = (names: readonly string[]) => Promise<PackageAnalysis[]>;

export interface GuardDeps {
  readonly analyze?: Analyze;
  readonly runCommand?: RunCommand;
  readonly confirm?: () => Promise<boolean>;
  readonly interactive?: boolean;
  readonly readFile?: ReadFile;
  readonly cwd?: string;
  readonly now?: number;
  readonly log?: (message: string) => void;
  /** Colorizer for reported output. Defaults to the stderr TTY palette. */
  readonly palette?: Palette;
}

const defaultLog = (message: string): void => {
  // Guard output goes to stderr so it never pollutes piped stdout / JSON.
  console.error(message);
};

/**
 * Palette used when a caller does not inject one. Guard writes to stderr, so the
 * color decision follows the stderr TTY (the CLI injects a `--no-color`-aware
 * palette explicitly).
 */
function defaultPalette(): Palette {
  return createPalette(
    shouldColorize({ isTTY: Boolean(process.stderr.isTTY), noColorFlag: false, env: process.env }),
  );
}

function defaultAnalyze(now?: number): Analyze {
  return (names) =>
    analyzeNames(names, {
      client: createRegistryClient(),
      popular: loadPopular(),
      knownSlop: loadKnownSlop(),
      now,
    });
}

/** npm ships as `npm.cmd` on Windows. */
function npmBinary(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env['CI'];
}

const defaultRunCommand: RunCommand = (command, args) =>
  new Promise((resolve) => {
    const child = spawn(command, [...args], { stdio: 'inherit' });
    child.on('close', (code) => resolve(code ?? EXIT_OK));
    child.on('error', () => resolve(EXIT_USAGE));
  });

interface Evaluation {
  readonly decision: GuardDecision;
  readonly unchecked: readonly string[];
  readonly config: GuardConfig;
}

/** Resolve config, split checkable vs unchecked specifiers, analyze, and decide. */
async function evaluate(
  specifiers: readonly Specifier[],
  flags: GuardFlags,
  deps: GuardDeps,
): Promise<Evaluation> {
  const config = await resolveGuardConfig(flags, deps.readFile, deps.cwd);
  const unchecked = specifiers.filter((s) => !s.checkable).map((s) => s.name || s.raw);
  const toCheck = specifiers
    .filter((s) => s.checkable && !config.allow.has(s.name))
    .map((s) => s.name);

  const analyze = deps.analyze ?? defaultAnalyze(deps.now);
  const analyses = await analyze(toCheck);
  return { decision: decide(analyses, config), unchecked, config };
}

function report(
  decision: GuardDecision,
  unchecked: readonly string[],
  log: (message: string) => void,
  palette: Palette,
): void {
  const text = formatGuard(decision, palette);
  if (text) log(text);
  if (unchecked.length > 0) {
    log(palette.dim(`Skipped (not a registry package, unchecked): ${unchecked.join(', ')}`));
  }
}

/**
 * Pure gate: analyze the given names, apply policy, report, and return an exit
 * code (0 = allow, 1 = block). Never spawns a process — used by CI and shell
 * integration.
 */
export async function runGuard(
  rawSpecifiers: readonly string[],
  flags: GuardFlags,
  deps: GuardDeps = {},
): Promise<number> {
  const specifiers = rawSpecifiers.map(normalizeSpecifier);
  const { decision, unchecked } = await evaluate(specifiers, flags, deps);
  report(decision, unchecked, deps.log ?? defaultLog, deps.palette ?? defaultPalette());
  return decision.action === 'block' ? EXIT_BLOCKED : EXIT_OK;
}

/**
 * Preflight wrapper: gate an `npm install …` invocation, then exec npm with the
 * args verbatim only if allowed (or confirmed in interactive warn mode). Blocked
 * installs never spawn npm.
 */
export async function runInstall(
  argv: readonly string[],
  flags: GuardFlags,
  deps: GuardDeps = {},
): Promise<number> {
  const log = deps.log ?? defaultLog;
  const palette = deps.palette ?? defaultPalette();
  const { specifiers } = parseInstallArgs(argv);
  const { decision, unchecked, config } = await evaluate(specifiers, flags, deps);
  report(decision, unchecked, log, palette);

  if (decision.action === 'block') {
    log('Install blocked. Allowlist the package (package.json#slopshield) or adjust --fail-on to override.');
    return EXIT_BLOCKED;
  }

  if (decision.warned.length > 0 && config.mode === 'warn') {
    const interactive = deps.interactive ?? isInteractive();
    if (interactive) {
      const ask = deps.confirm ?? (() => confirm('Proceed with install?'));
      if (!(await ask())) {
        log('Install aborted.');
        return EXIT_BLOCKED;
      }
    }
  }

  const run = deps.runCommand ?? defaultRunCommand;
  return run(npmBinary(), ['install', ...argv]);
}
