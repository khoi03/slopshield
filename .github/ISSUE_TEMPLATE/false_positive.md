---
name: False-positive report
about: slopshield flagged a package that is actually legitimate
title: "[false-positive] <package-name>"
labels: false-positive
---

> Tuning signal vs. noise is the most valuable feedback for slopshield. Thanks
> for taking the time.

## Package

- **Name:** `<package-name>`
- **npm link:** https://www.npmjs.com/package/<package-name>

## Verdict you saw

Paste the output (the `--json` form is ideal):

```
slopshield <package-name>
```

## Why it's legitimate

What makes this a real, safe package? (e.g. widely used, your own internal
package, a brand-new but trusted release, a scoped package, a `-js` variant.)

## Which signal misfired (if you can tell)

- [ ] new (recently published)
- [ ] low-downloads
- [ ] lookalike (named the wrong "similar" package)
- [ ] known-slop
- [ ] not sure

## Environment

- slopshield version (`slopshield --version`):
- Node version:
