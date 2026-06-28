import { parseArgs } from 'node:util';

import { analyzeNames } from './analyzer.ts';
import { DEFAULT_FAIL_ON } from './config.ts';
import { loadKnownSlop, loadPopular } from './data/loader.ts';
import { deriveExitCode, formatHuman, formatJson } from './format.ts';
import { resolveInputs } from './inputs.ts';
import { createRegistryClient } from './registry/client.ts';
import type { FailOn } from './types.ts';

const VALID_FAIL_ON: readonly FailOn[] = ['safe', 'medium', 'high', 'critical', 'none'];

const USAGE = `slopcheck — flag AI-hallucinated and typosquatted npm packages before you install them.

Usage:
  slopcheck <package...>            Check one or more package names
  slopcheck --file <path>           Check names from a package.json or newline list
  slopcheck <package...> --json     Machine-readable JSON output

Options:
  --file <path>      Read names from a package.json (deps/devDeps/optional/peer) or a newline list
  --json             Output a JSON array of verdicts
  --fail-on <level>  Exit non-zero at this level or above: safe|medium|high|critical|none (default: ${DEFAULT_FAIL_ON})
  --help             Show this help

Exit codes: 0 = nothing at/above the fail-on level; 1 = a risky package was found.`;

function isFailOn(value: string): value is FailOn {
  return (VALID_FAIL_ON as readonly string[]).includes(value);
}

async function main(argv: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...argv],
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
    return 0;
  }

  const failOn = values['fail-on'] ?? DEFAULT_FAIL_ON;
  if (!isFailOn(failOn)) {
    console.error(`Invalid --fail-on value: "${failOn}". Use one of: ${VALID_FAIL_ON.join(', ')}.`);
    return 2;
  }

  const names = await resolveInputs({ positional: positionals, file: values.file });
  if (names.length === 0) {
    console.error('No packages to check. Pass package names or --file <path>.\n');
    console.error(USAGE);
    return 1;
  }

  const analyses = await analyzeNames(names, {
    client: createRegistryClient(),
    popular: loadPopular(),
    knownSlop: loadKnownSlop(),
  });

  console.log(values.json ? formatJson(analyses) : formatHuman(analyses));
  return deriveExitCode(analyses, failOn);
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`slopcheck: unexpected error: ${message}`);
    process.exit(2);
  });
