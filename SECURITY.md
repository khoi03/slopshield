# Security Policy

slopshield is a supply-chain *defense* tool, so we hold its own security to a
high bar: zero runtime dependencies, a single bundled binary, and a small,
auditable surface.

## Supported versions

slopshield is pre-1.0 and ships fixes only on the latest released version.
Always run the newest release.

| Version | Supported |
|---------|-----------|
| latest `0.x` | ✅ |
| older `0.x` | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via GitHub's **"Report a vulnerability"** button on the
repository's [Security advisories](https://github.com/khoi03/slopshield/security/advisories)
tab. This opens a private channel visible only to the maintainers.

If you cannot use GitHub advisories, you may contact the maintainer through
their GitHub profile (https://github.com/khoi03) instead.

When reporting, please include:

- affected version (`slopshield --version`) and platform/Node version,
- a description of the issue and its impact,
- reproduction steps or a proof of concept.

## What to expect

- **Acknowledgement** within 72 hours.
- An initial assessment and severity rating shortly after.
- A fix and coordinated disclosure once a patch is available; we credit
  reporters who wish to be named.

## Scope notes

slopshield blocks risky package *names* before install — it is **not a
sandbox** and does not analyze or contain a package's install-time lifecycle
scripts. Reports about that boundary are documentation/feature requests, not
vulnerabilities. See the "Install guard" section of the README.
