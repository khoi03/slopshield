# slopshield

> Block **AI-hallucinated and typosquatted npm packages** before you install them.

[![npm version](https://img.shields.io/npm/v/slopshield.svg)](https://www.npmjs.com/package/slopshield)
[![CI](https://github.com/khoi03/slopshield/actions/workflows/ci.yml/badge.svg)](https://github.com/khoi03/slopshield/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/slopshield.svg)](https://nodejs.org)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

AI coding assistants routinely suggest packages that don't exist (~1 in 5 recommendations) or are lookalikes of real ones. Because the hallucinated names recur, attackers pre-register them ("slopsquatting") so the install pulls malware. Dependabot and Snyk only catch *known-vulnerable, known* packages — they're blind to *nonexistent-but-soon-malicious* names. slopshield fills that gap with fast heuristics over public npm registry data, and — unlike static scanners that read your files after the fact — it can intercept the install **before the package lands**.

```bash
npm install -g slopshield
slopshield express react lodash     # → all safe, exit 0
slopshield expresss reqeust         # → flags lookalikes of express / request
```

Or run it once without installing: `npx slopshield <pkg>`.

## How it works

Each package gets a risk verdict (`safe` / `medium` / `high` / `critical`, or `unknown` when the registry can't be reached) with plain-language reasons, from five heuristics:

1. **Nonexistent** — not registered in npm (`critical`).
2. **New** — first published within the last 30 days.
3. **Low downloads** — near-zero weekly downloads.
4. **Lookalike** — a near-miss (edit distance) of a much more popular package; the reason names the suspected target.
5. **Known-slop** — matches a curated list of documented hallucination/typosquat names.

It is **warn-by-default** (a single heuristic never blocks) and **fail-open** (a registry outage yields `unknown`, never a false "safe"). A lookalike of an *existing* package warns at `medium`; it only escalates to a blocking `high`/`critical` when signals combine (e.g. lookalike **and** brand-new **and** near-zero downloads) or the name simply doesn't exist. Thresholds live in one file (`src/config.ts`) — the false-positive dial.

**Measured on a curated corpus** (`npm run validate`): **100% recall** on nonexistent + known-typosquat names at the default gate, and **0 false positives** across 34 of the most-installed npm packages.

## How it compares

| | slopshield | Dependabot / Snyk | Static "slop" file scanners |
|---|---|---|---|
| Catches **nonexistent / hallucinated** names | ✅ | ❌ (only known packages) | partial |
| Catches **typosquat / lookalike** names | ✅ | ❌ | partial |
| Known-CVE / SCA / SBOM | ❌ (not the goal) | ✅ | ❌ |
| **Blocks at install time**, before code lands | ✅ | ❌ (reports after) | ❌ (scans files) |
| Runtime dependencies | **zero** | many | varies |

slopshield is complementary to Dependabot/Snyk — keep using them for known-CVE coverage — and it acts at the moment of `npm install`, not as an after-the-fact file scan.

## Requirements

- Node.js **18+** (uses the built-in `fetch`).
- **Zero runtime dependencies** — a supply-chain tool should have the smallest possible attack surface.

## Usage

```bash
# Check one or more package names
slopshield express react lodash            # → all safe, exit 0
slopshield expresss reqeust                # → flags lookalikes of express / request

# Scan a project's package.json (deps, devDeps, optional, peer) or a newline list
slopshield --file package.json

# Machine-readable output for CI
slopshield --file package.json --json

# Choose how strict the exit code is (default: high)
slopshield expresss --fail-on medium       # exit 1 on medium or above
```

### Options

| Option | Description |
|---|---|
| `--file <path>` | Read names from a `package.json` or a newline-delimited list |
| `--json` | Output a JSON array of verdicts |
| `--fail-on <level>` | Exit non-zero at this level or above: `safe`\|`medium`\|`high`\|`critical`\|`none` (default `high`) |
| `--version` | Print the installed version |
| `--help` | Show help |

**Exit codes:** `0` = nothing at/above the fail-on level; `1` = a risky package was found; `2` = usage error. `unknown` verdicts never fail the run.

## Install guard

Catch risky packages *before* they install:

```bash
# Gate by exit code (no install) — ideal for CI and shell hooks
slopshield guard express lodash            # silent, exit 0
slopshield guard expresss --block          # exit 1, names the typo'd target

# Wrap an install: pre-check, then run "npm install …" verbatim if it passes
slopshield install express --save-dev
slopshield install some-ai-suggested-pkg   # warns (or blocks) before npm runs

# Transparent adoption: shadow npm so every "npm install" is auto-checked
eval "$(slopshield init-shell zsh)"        # add to ~/.zshrc  (supports bash|zsh|fish)
```

**Policy** (warn by default; block is opt-in) lives in `package.json`:

```json
{
  "slopshield": {
    "mode": "block",
    "failOn": "high",
    "allow": ["my-internal-pkg"]
  }
}
```

- **warn** (default): prints reasons; in an interactive terminal it asks before installing; in CI it proceeds.
- **block**: refuses to install anything at or above `failOn` — npm is never spawned; risky packages below `failOn` are warnings.
- Non-registry specifiers (git/url/file) and unparseable args pass through **unchecked** (fail-open).
- **Not a sandbox:** the guard blocks risky *names* before install; it does not sandbox a safe package's lifecycle scripts. npm-only for now (`guard` works for any package manager via shell integration).

## Development

```bash
npm test              # run the test suite (Node's built-in runner; needs Node 23.6+)
npm run test:coverage # run with ≥80% coverage thresholds
npm run typecheck     # tsc --noEmit
npm run build         # bundle to dist/cli.js
npm run validate      # measure recall / false-positive rate over the corpus (needs network)
npm run build:data    # regenerate src/data/popular-packages.json (needs network)
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide and [SECURITY.md](./SECURITY.md) to report a vulnerability.

## License

[MIT](./LICENSE)
