# Contributing to slopshield

Thanks for helping make AI-suggested `npm install`s safer. slopshield is a
solo, open-source project — issues, false-positive reports, and PRs are all
welcome.

## Ground rules

- **Zero runtime dependencies.** slopshield is a supply-chain tool; its own
  attack surface must stay tiny. PRs that add a runtime dependency will be
  declined unless there is no reasonable alternative. Dev-only dependencies
  (TypeScript, tsup) are fine.
- **Heuristics over public data only.** Detection uses the public npm registry
  — no ML, no telemetry, no network calls beyond the registry.
- **Warn, don't surprise.** The default posture is warn-by-default and
  fail-open. Changes that block more aggressively by default need a strong
  false-positive justification (see `src/config.ts`).

## Development setup

```bash
git clone https://github.com/khoi03/slopshield.git
cd slopshield
npm ci
npm test
```

> **Node version:** the published CLI runs on **Node 18+** (it only needs the
> built-in `fetch`). The **test suite** imports `.ts` sources directly via
> Node's type-stripping, which is unflagged from **Node 23.6+** (24
> recommended). On Node 22.x, run tests with the flag:
> `node --experimental-strip-types --test "src/**/*.test.ts"`. CI runs the
> suite on Node 24 and smoke-tests the built bundle on Node 18 & 20.

### Common commands

```bash
npm test              # run the suite (Node's built-in runner)
npm run test:coverage # enforce the ≥80% line/branch/function thresholds
npm run typecheck     # tsc --noEmit
npm run build         # bundle to dist/cli.js
npm run validate      # measure recall/false-positive rate over the corpus (needs network)
npm run build:data    # regenerate src/data/popular-packages.json (needs network)
```

## Project layout

| Path | Responsibility |
|------|----------------|
| `src/signals/*` | The five detection heuristics (one file each, pure) |
| `src/registry/client.ts` | The only place that touches the network (injectable `fetch`) |
| `src/scoring.ts`, `src/analyzer.ts` | Combine signals into a verdict |
| `src/guard/*` | Install-guard: arg parsing, policy, runner, shell integration |
| `src/config.ts` | **All tunable thresholds** — the false-positive dial |
| `src/data/*.json` | Bundled reference data (popular names + known-slop seed) |

## Updating the data

- **Popular packages** (`src/data/popular-packages.json`): regenerate with
  `npm run build:data` rather than editing by hand.
- **Known-slop seed** (`src/data/known-slop.json`): add documented hallucinated
  or typosquat names/patterns with a source in the PR description.

## Tests first

This project is test-driven. Co-locate `*.test.ts` next to the module, use
Node's `node:test` + `node:assert/strict`, inject I/O (network, spawn, clock)
so tests stay offline and deterministic, and keep coverage ≥80%. Add a failing
test before the fix, then make it pass.

## Commit & PR conventions

- Conventional commit messages: `feat:`, `fix:`, `docs:`, `test:`, `chore:`,
  `refactor:`, `perf:`, `ci:`.
- Group commits by concern; keep them focused and reviewable.
- Before opening a PR: `npm run typecheck && npm test && npm run build` all green.
- Describe the change, the motivation, and how you verified it.

## False-positive reports

If slopshield flags a legitimate package, please open a **False-positive
report** issue with the package name, why it's legitimate, and the verdict you
saw. Tuning the signal/noise balance is the most valuable feedback we can get.
