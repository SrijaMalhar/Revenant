---
inclusion: always
---

# Revived packages

- Never edit anything in `ossuary/*/original`. That's the reference implementation.
- Don't skip or weaken a soul match test to get it passing. Fix the revived code.
- Revived packages: no runtime deps, no install scripts, same exports and signatures as the original. TS strict, ESM + CJS.
- Same soul = deep-equal return value for every generated input. If one version throws, the other has to throw too. Error messages and input mutation don't count.
- Any intentional difference goes in that package's spec as an exorcised requirement, with its own test.
- Freeze `Date.now` in tests. No `Math.random` outside fast-check.
- It's differential testing. Don't call it a proof anywhere (code, UI, docs).
- Keep the original license and author credit in every revived package.
- Never open PRs on repos I don't own.
- Numbers in the UI or README are either measured here or have a source.
