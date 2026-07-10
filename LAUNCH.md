# Launch playbook — slopshield

Internal launch notes. **Not published to npm** (not in `package.json#files`).
Everything here is a draft for the maintainer to run/post; nothing here ships.

## Status (as of 0.3.0, 2026-07-10)

- [x] Repo public at `github.com/khoi03/slopshield` (About + topics set).
- [x] Published `slopshield@0.3.0` to npm via **OIDC Trusted Publishing** (with provenance).
      (npm 12 broke the provenance publish path; release workflow is pinned to `npm@11.18.0`.)
- [x] **Security hardened:** token publishing disabled (OIDC-only), `NPM_TOKEN` secret
      deleted, old granular npm token revoked.
- [x] **GitHub Action** shipped and verified end-to-end (bump usage to `khoi03/slopshield@v0.3.0`).
- [x] **AI-agent guard** shipped: MCP server (`slopshield mcp`) + Claude Code PreToolUse hook
      (`slopshield hook`) — reviewed, security-hardened, verified live.
- [x] Demo GIF re-recorded to show the agent guard blocking a hallucinated install.
- [ ] Confirm the Action shows on the GitHub **Marketplace** (tick "Publish to Marketplace"
      on the `v0.3.0` release if not already).
- [ ] **Post Show HN + Product Hunt** (copy below). Be around the first few hours to reply.

## What's new in 0.3.0 (lead with these — this is the "wow")

- **AI-agent guard.** AI assistants are the biggest source of slopsquatting — they
  confidently suggest packages that don't exist. slopshield now sits between the agent and
  your registry, two ways:
  - **`slopshield mcp`** — an MCP server (stdio) exposing a `check_package` tool, so any
    MCP-capable agent verifies a name *before* it suggests or installs it.
  - **`slopshield hook`** — a Claude Code `PreToolUse` hook that intercepts the agent's
    `npm install`, **denies** hallucinated/typosquatted packages in real time (with a reason
    the model reads and self-corrects on), asks on medium risk, and allows safe installs.
- Still **zero runtime dependencies** — the MCP server is hand-rolled, no SDK.

## What's new in 0.2.0

- **Colored, themed output** — verdicts are color-coded (green `safe` → yellow `medium`
  → red `high` → bold-red `critical` → dim `unknown`), reasons dimmed. Honors
  `NO_COLOR`/`FORCE_COLOR`/`--no-color`; `--json` stays plain.
- **Scan summary + `--quiet`** — every multi-package scan ends with a tally
  (`6 checked — 1 critical, 2 high, 1 medium, 2 safe`); `--quiet` prints only the flagged
  packages plus that line — ideal for CI logs.
- **GitHub Action** — add slopshield to CI in a few lines; fails the job on risky packages.
- **Bigger corpus, still honest** — validation holds at **100% recall / 0 false positives
  across the 230 most-installed packages**.

## Demo script (asciinema / GIF)

Keep it ~30s, run in a real terminal so the colors show. Type at a human pace.

```bash
# 1. A batch scan: safe packages in green, the typo/typosquat flagged, plus a summary line
slopshield express lodash expresss crossenv

# 2. --quiet: only the problems (great for CI)
slopshield express lodash expresss crossenv --quiet

# 3. A hallucinated name that doesn't exist → bold-red critical
slopshield react-async-hyperstore-provider-x9qz

# 4. Block a risky install before npm ever runs
slopshield install expresss --block

# 5. One line to guard every npm install in this shell
eval "$(slopshield init-shell zsh)"
npm install expresss     # ← intercepted

# 6. NEW: the AI-agent guard — an agent's hallucinated install, blocked live
echo '{"tool_name":"Bash","tool_input":{"command":"npm install react-async-hyperstore-provider-x9qz"}}' | slopshield hook
# → {"hookSpecificOutput":{... "permissionDecision":"deny", "permissionDecisionReason":"slopshield blocked ..."}}
```

Record with vhs: `vhs demo.tape` → produces `demo.gif` (scenes above are in `demo.tape`).

## Show HN

**Title** (≤ 80 chars):

```
Show HN: slopshield – block AI-hallucinated and typosquatted npm packages
```

**Body:**

```
AI coding assistants suggest npm packages that don't exist about 1 in 5 times
(USENIX Security 2025 measured ~19.7% across 576k samples). The hallucinated
names recur, so attackers pre-register them — "slopsquatting" — and the install
pulls malware. Dependabot and Snyk only flag KNOWN-vulnerable, known packages;
they're blind to a name that doesn't exist yet but will be malicious tomorrow.

slopshield checks a package name against the public npm registry before you
install it, using five heuristics: nonexistent, brand-new, near-zero downloads,
lookalike (edit-distance to a popular package), and a curated known-slop list.

It's warn-by-default and fail-open (a registry outage is "unknown", never a
false "safe"). A lookalike of a real package only warns; it blocks when signals
combine or the name simply doesn't exist — so it stays quiet on legit installs.
On a curated corpus that's 100% recall on nonexistent/typosquat names and 0
false positives across the 230 most-installed packages.

Unlike file scanners, it acts at install time — or in CI:
  slopshield install some-ai-suggested-pkg   # warns or blocks before npm runs
  eval "$(slopshield init-shell zsh)"         # shadow npm so every install is checked
  # ...or drop it into GitHub Actions:
  - uses: khoi03/slopshield@v0.3.0
    with: { fail-on: high }

New in 0.3.0 — guard the source of the problem, the AI agent itself:
  slopshield mcp    # MCP server: a check_package tool an agent calls before installing
  slopshield hook   # Claude Code PreToolUse hook: denies a hallucinated npm install in
                    # real time and hands the model a reason so it self-corrects
So when an assistant invents a package, it's blocked as it's suggested — not after.

Output is color-coded by risk with a one-line summary (and --quiet for CI).
MIT, zero runtime dependencies (a supply-chain tool should have the smallest
possible attack surface — the MCP server is hand-rolled, no SDK), Node 18+.

  npm install -g slopshield
  Repo: https://github.com/khoi03/slopshield

Honest open questions I'd love HN's take on: how aggressive should the default
thresholds be, and what's the right edit-distance for "lookalike" without
drowning people in noise on legitimately similar names?
```

## Product Hunt

**Tagline** (≤ 60 chars):

```
Stop AI-hallucinated npm installs before they land
```

**Description:**

```
slopshield is an MIT, dependency-free CLI that flags AI-hallucinated and
typosquatted npm packages before you install them. AI assistants invent
package names ~1 in 5 times; attackers pre-register the recurring ones
("slopsquatting"). slopshield checks names against the live npm registry with
five fast heuristics, warns by default, and can block risky installs — locally,
via a one-line shell hook, or in CI with the GitHub Action. New in 0.3.0: an MCP
server and a Claude Code hook stop hallucinated installs at the AI-agent layer,
the moment the assistant suggests them. Color-coded output with a --quiet mode
for clean CI logs. Complements Dependabot/Snyk — it catches the
nonexistent-but-soon-malicious names they can't.
```

**First comment (maker):**

```
Hey PH 👋 I built this after watching AI assistants confidently suggest npm
packages that don't exist. Tuned for low false positives (0 across the top-230
in my corpus) and warn-by-default so it doesn't get in your way. 0.3.0 closes
the loop on where the problem starts — the AI agent: an MCP server and a Claude
Code PreToolUse hook block a hallucinated install as it's suggested (still zero
runtime deps, the MCP server is hand-rolled). Would love feedback on the default
thresholds. It's npm-first by design; pip and yarn/pnpm are on the someday list.
```

**Gallery shot list:**

1. Terminal: an AI agent's hallucinated `npm install` denied live by the PreToolUse hook (hero shot).
2. Terminal: a batch scan with the color-coded verdicts + summary line.
3. Terminal: `slopshield install … --block` refusing before npm runs.
4. GitHub Actions: the Action failing a PR on a risky package.
5. One-liner shell integration (`init-shell`) auto-guarding `npm install`.
6. The 100% recall / 0 FP (across 230) validation summary.
```
