# Kiro prompts for Days 1 and 2

Paste these into Kiro as written, then let Kiro do the work. Review every requirements, design and tasks file before approving it, and edit anything that's wrong. Your edits are part of the Kiro story.

---

## Prompt 1 · Foundation steering (Day 1)

First try the button: **Kiro panel → Steering → Generate Steering Docs**. If the files come out thin, use this in chat instead:

```
Using #[[file:docs/BRIEF.md]], write .kiro/steering/product.md, tech.md and structure.md.
Keep each under 60 lines. Do not repeat rules that are already in rites.md or scope.md.
```

---

## Prompt 2 · Spec 1: Graveyard scanner (Day 1)

Open **Specs → +** and paste this as the feature description:

```
Feature: Graveyard scanner. Core library and edge API only, no UI yet.
Context: #[[file:docs/BRIEF.md]]

Input: a public GitHub repo (owner/repo or URL) or the text of a package.json.

Behaviour:
- Fetch package.json from the repo's default branch.
- Include dependencies and devDependencies. Resolve each semver range to the newest
  matching version using the npm registry.
- For each resolved direct dependency, get its resolved graph from deps.dev
  GetDependencies and merge the graphs. Keep one path from the root to each package.
- For each unique package collect: latest version, last release date, maintainer count,
  deprecation message, install scripts on the installed version, weekly downloads,
  open advisories (OSV batch query) and the e18e replacement, if any, from the
  bundled module-replacements manifests.
- A package is dead when its last release is 3 or more years before the scan date (UTC).
- Return a typed GraveyardReport.

Architecture:
- All logic lives in packages/core. api/ is a thin edge function that proxies and caches
  upstream calls. The browser never calls upstream APIs directly.
- Tests use recorded fixtures, never the live network.

Correctness properties to test:
- The same input and the same upstream data always produce an identical report.
- Every package in the report is reachable from the root.
- No package name and version appears twice.
- dead is true exactly when the last release is at least 3 years before the scan date.

Non-goals: UI, scoring, LLM calls.
```

When Kiro writes the tasks, keep the property-based test tasks it proposes.

---

## Prompt 3 · Spike, in vibe mode on purpose (Day 2)

Create a throwaway branch `spike/worker` and use a plain chat (not a spec). This doubles as your "spec vs vibe" experiment for the write-up, so time it.

```
Throwaway spike, no polish and no integration:
1. Bundle type-check@0.4.0 and path-browserify@1.0.1 with esbuild into ESM files.
   Define process.cwd() as "/".
2. Load both in a Vite page inside a Web Worker.
3. Run a fast-check property 100,000 times that calls each function twice on the same
   generated input and compares the results.
4. Print the total time and anything that broke.
```

If either package won't bundle or run, swap it today for an alternate from `docs/OSSUARY-CANDIDATES.md`.

---

## Prompt 4 · Spec 2: Zombie Index (Day 2)

```
Feature: Zombie Index for packages in a GraveyardReport.
Context: #[[file:docs/BRIEF.md]]

Score each package from 0 to 100 with a formula the UI can show:
- Abandonment, 40 points: years since last release, capped at 10 years.
- Attack surface, 40 points: install scripts present, a single maintainer,
  open advisories.
- Reach, 20 points: log10 of weekly downloads, capped.
Action for each package: "replace" if e18e lists a replacement, otherwise "revive" if it is
in the Ossuary, otherwise "watch".
Return the score, its parts and the action, so the UI can explain every number.

Correctness properties to test:
- The score is always between 0 and 100.
- Adding an advisory or an install script never lowers the score.
- A more recent last release never raises the abandonment part.
- The action is "replace" whenever e18e lists a replacement.
```

---

## Prompt 5 · Spec 3: Graveyard screen (Day 2)

```
Feature: Graveyard screen, the first of exactly three screens.
Context: #[[file:docs/BRIEF.md]]

- One input: a GitHub repo URL or a pasted package.json, plus one Scan button.
- Show dead packages as tombstones that rise in on load. The worst Zombie Index glows.
- Each epitaph: name, last release date, weekly downloads, maintainers, install
  scripts, advisories, and the action (Revive, Replace with X, or Watch).
- Clicking a tombstone opens a drawer that explains the score, part by part.
- Loading, empty and error states. Keyboard accessible. Respect prefers-reduced-motion.
- Every number comes from the GraveyardReport. Nothing is hard-coded.
```
