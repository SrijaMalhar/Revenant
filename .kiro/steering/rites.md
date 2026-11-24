---
inclusion: always
---

# Rites of resurrection

These rules are not negotiable. If a task conflicts with one, stop and say which rule it breaks.

1. **The original is the oracle.** Never edit anything under `ossuary/*/original/`. Never weaken, skip or delete a Soul Match test to make it pass. Fix the revived code instead.
2. **Revived packages** have zero runtime dependencies, no `preinstall`, `install` or `postinstall` scripts, and the same public API as the original: same export names, same arguments, same return shapes. TypeScript strict, with ESM and CJS builds.
3. **Same soul.** On every generated input, return values are deep-equal, and if one version throws, the other throws too. Ignore error messages and input mutation.
4. **Declared divergences only.** Every intended difference from the original is an EXORCISED requirement in that package's spec, with its own test (for example, a linear-time bound). Any undeclared difference is a bug.
5. **Determinism.** Tests freeze `Date.now`. No `Math.random` outside fast-check seeds. Record the seed of every failing run.
6. **Honest words.** Call Soul Match differential testing. Never write "proof", "proven" or "guaranteed" in code comments, UI text or docs.
7. **Respect.** Keep the original license and credit the original author in every revived package. Say "abandoned", never blame a maintainer. Never open pull requests on repositories the user does not own.
8. **Numbers.** Every number shown in the UI or README is either measured by this project or cited with its source and date.
