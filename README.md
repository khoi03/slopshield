# slopcheck

> Flag **AI-hallucinated and typosquatted npm packages** before you install them.

AI coding assistants routinely suggest packages that don't exist (~1 in 5 recommendations) or are lookalikes of real ones. Because the hallucinated names recur, attackers pre-register them ("slopsquatting") so the install pulls malware. Dependabot and Snyk only catch *known-vulnerable, known* packages — they're blind to *nonexistent-but-soon-malicious* names. `slopcheck` fills that gap with fast heuristics over public npm registry data.

**Shipped:** detection core (M1) + install guard (M2). Public launch is next.

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

## Install guard

Catch risky packages *before* they install:

```bash
# Gate by exit code (no install) — ideal for CI and shell hooks
slopcheck guard express lodash            # silent, exit 0
slopcheck guard expresss --block          # exit 1, names the typo'd target

# Wrap an install: pre-check, then run "npm install …" verbatim if it passes
slopcheck install express --save-dev
slopcheck install some-ai-suggested-pkg   # warns (or blocks) before npm runs

# Transparent adoption: shadow npm so every "npm install" is auto-checked
eval "$(slopcheck init-shell zsh)"        # add to ~/.zshrc  (supports bash|zsh|fish)
```

**Policy** (warn by default; block is opt-in) lives in `package.json`:

```json
{
  "slopcheck": {
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
npm test              # run the test suite (Node's built-in runner)
npm run test:coverage # run with ≥80% coverage thresholds
npm run typecheck     # tsc --noEmit (requires dev deps installed)
npm run build         # bundle to dist/cli.js (requires dev deps installed)
npm run build:data    # regenerate src/data/popular-packages.json (needs network)
```

## License

MIT
