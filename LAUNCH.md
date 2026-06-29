# Launch playbook — slopshield

Internal launch notes. **Not published to npm** (not in `package.json#files`).
Everything here is a draft for the maintainer to run/post; nothing here ships.

## Pre-launch checklist (do these in order)

- [ ] **Rename the GitHub repo** `khoi03/slopcheck` → `khoi03/slopshield`
      (Settings → rename; GitHub auto-redirects old links).
- [ ] Update the local remote: `git remote set-url origin git@github.com:khoi03/slopshield.git`
- [ ] Set repo **About**: description + topics (`npm`, `security`, `supply-chain`,
      `slopsquatting`, `typosquatting`, `cli`, `developer-tools`) + homepage.
- [ ] Confirm name is still free: `npm view slopshield` → 404.
- [ ] `npm run typecheck && npm test && npm run build && npm run validate` all green.
- [ ] `npm pack --dry-run` ships only `dist/**`, `README.md`, `LICENSE`, `package.json`.
- [ ] `npm login`, then `npm publish` (runs `prepublishOnly`; `publishConfig` adds provenance).
- [ ] Tag the release: `git tag v0.1.0 && git push origin v0.1.0`.
- [ ] (Optional) Add the `NPM_TOKEN` repo secret to enable the release workflow for future tags.
- [ ] Record a demo GIF/asciinema (script below) and drop it near the top of the README.
- [ ] Post Show HN + Product Hunt (copy below). Be around for the first few hours to reply.

## Demo script (asciinema / GIF)

Keep it ~30s. Type at a human pace.

```bash
# 1. Safe packages pass silently
slopshield express react lodash

# 2. A typo is caught and the real target is named
slopshield expresss reqeust

# 3. A hallucinated name that doesn't exist → critical
slopshield react-async-hyperstore-provider-x9qz

# 4. Block a risky install before npm ever runs
slopshield install expresss --block

# 5. One line to guard every npm install in this shell
eval "$(slopshield init-shell zsh)"
npm install expresss     # ← intercepted
```

Record: `asciinema rec demo.cast` → convert to GIF with `agg demo.cast demo.gif`.

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
false positives across the 34 most-installed packages.

Unlike file scanners, it acts at install time:
  slopshield install some-ai-suggested-pkg   # warns or blocks before npm runs
  eval "$(slopshield init-shell zsh)"         # shadow npm so every install is checked

MIT, zero runtime dependencies (a supply-chain tool should have the smallest
possible attack surface), Node 18+.

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
five fast heuristics, warns by default, and can block risky installs in CI or
via a one-line shell hook. Complements Dependabot/Snyk — it catches the
nonexistent-but-soon-malicious names they can't.
```

**First comment (maker):**

```
Hey PH 👋 I built this after watching AI assistants confidently suggest npm
packages that don't exist. Tuned for low false positives (0 on the top-34 in my
corpus) and warn-by-default so it doesn't get in your way. Would love feedback
on the default thresholds. It's npm-first by design; pip is on the someday list.
```

**Gallery shot list:**

1. Terminal: a typo flagged with the real target named (hero shot).
2. Terminal: `slopshield install … --block` refusing before npm runs.
3. The "How it compares" table from the README.
4. One-liner shell integration (`init-shell`) auto-guarding `npm install`.
5. The 100% recall / 0 FP validation summary.
