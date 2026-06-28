# slopcheck

> Flag **AI-hallucinated and typosquatted npm packages** before you install them.

AI coding assistants routinely suggest packages that don't exist (~1 in 5 recommendations) or are lookalikes of real ones. Because the hallucinated names recur, attackers pre-register them ("slopsquatting") so the install pulls malware. Dependabot and Snyk only catch *known-vulnerable, known* packages — they're blind to *nonexistent-but-soon-malicious* names. `slopcheck` fills that gap with fast heuristics over public npm registry data.

**Milestone 1 (this release): the detection core.** The `npm install` guard is next.

## How it works

Each package gets a risk verdict (`safe` / `medium` / `high` / `critical`, or `unknown` when the registry can't be reached) with plain-language reasons, from five heuristics:

1. **Nonexistent** — not registered in npm (`critical`).
2. **New** — first published within the last 30 days.
3. **Low downloads** — near-zero weekly downloads.
4. **Lookalike** — a near-miss (edit distance) of a much more popular package; the reason names the suspected target.
5. **Known-slop** — matches a curated list of documented hallucination/typosquat names.

It is **warn-by-default** (a single heuristic never blocks) and **fail-open** (a registry outage yields `unknown`, never a false "safe"). Thresholds live in one file (`src/config.ts`) — the false-positive dial.

## Requirements

- Node.js **18+** (uses the built-in `fetch`).
- **Zero runtime dependencies** — a supply-chain tool should have the smallest possible attack surface.

## Usage

```bash
# Check one or more package names
slopcheck express react lodash            # → all safe, exit 0
slopcheck expresss reqeust                # → flags lookalikes of express / request

# Scan a project's package.json (deps, devDeps, optional, peer) or a newline list
slopcheck --file package.json

# Machine-readable output for CI
slopcheck --file package.json --json

# Choose how strict the exit code is (default: high)
slopcheck expresss --fail-on medium       # exit 1 on medium or above
```

### Options

| Option | Description |
|---|---|
| `--file <path>` | Read names from a `package.json` or a newline-delimited list |
| `--json` | Output a JSON array of verdicts |
| `--fail-on <level>` | Exit non-zero at this level or above: `safe`\|`medium`\|`high`\|`critical`\|`none` (default `high`) |
| `--help` | Show help |

**Exit codes:** `0` = nothing at/above the fail-on level; `1` = a risky package was found; `2` = usage error. `unknown` verdicts never fail the run.

## Development

```bash
npm test              # run the test suite (Node's built-in runner)
npm run test:coverage # run with ≥80% coverage thresholds
npm run typecheck     # tsc --noEmit (requires dev deps installed)
npm run build         # bundle to dist/cli.js (requires dev deps installed)
npm run build:data    # regenerate src/data/popular-packages.json (needs network)
```

## License

MIT
