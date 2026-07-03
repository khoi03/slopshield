# Changelog

All notable changes to this project are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Scan summary + `--quiet`** — multi-package scans (and any `--quiet` run) now
  end with a one-line tally, e.g. `5 checked — 1 critical, 2 high, 1 medium`
  (`all safe` when clean), colored by level. `--quiet` prints only flagged
  packages (hides `safe`, keeps `unknown`) plus the summary — ideal for CI logs.
  `--json` is unaffected (full set, no footer) and the exit code is always
  computed over every package.
- **Colored output** — human-readable scan and guard output is now color-coded by
  verdict (green `safe`, yellow `medium`, red `high`, bold-red `critical`, dim
  `unknown`), with reasons dimmed. Color is emitted only to a terminal and honors
  `--no-color`, `NO_COLOR`, and `FORCE_COLOR` (precedence: `--no-color` >
  `FORCE_COLOR` > `NO_COLOR` > TTY). `--json` output stays 100% plain. Still zero
  runtime dependencies (hand-rolled ANSI).

## [0.1.0] - 2026-06-30

Initial public release.

### Added

- **Detection core** — `slopshield <pkg…>` scans package names (or a
  `package.json` / newline list via `--file`) and returns a risk verdict
  (`safe` / `medium` / `high` / `critical`, or `unknown` when the registry is
  unreachable) with plain-language reasons, from five heuristics over public
  npm registry data: nonexistent, newly published, near-zero downloads,
  lookalike (edit-distance to a popular package), and known-slop.
- **Install guard** — `slopshield guard <pkg…>` (pure exit-code gate for CI and
  shell hooks), `slopshield install <npm-args…>` (pre-check then run `npm
  install` verbatim only if allowed), and `slopshield init-shell [bash|zsh|fish]`
  (shadow-npm snippet for transparent adoption).
- **Policy** from `package.json#slopshield` (`mode` / `failOn` / `allow`),
  overridable with `--block` / `--allow` / `--fail-on`. Warn-by-default;
  blocking is opt-in.
- `--json` machine-readable output, meaningful exit codes, and `--version`.
- Zero runtime dependencies; fail-open on registry errors (never a false
  "safe").

[Unreleased]: https://github.com/khoi03/slopshield/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/khoi03/slopshield/releases/tag/v0.1.0
