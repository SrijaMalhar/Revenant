# Kiro log

Notes on how I'm using Kiro to build Revenant.

## Day 1

### Setup
- Installed the Kiro IDE on my Mac and signed in with GitHub.
- Cloned the repo and opened it in Kiro.
- I'm on the free plan until the hackathon credits come in.

### Steering
- rites.md and scope.md are always on. They hold the rules for revived packages and what is in and out of scope.
- Each Ossuary package has its own file: ossuary-timespan.md, ossuary-type-check.md and ossuary-path-browserify.md. Each one loads only when I'm working in that package's folder.
- generators.md loads on its own when the task is about writing test inputs.
- exorcism-checklist.md is manual. I pull it in with #exorcism-checklist when I need it.

### Skills
- autopsy: read an old npm package and write the spec for reviving it.
- resurrection: build the revived package from its spec until Soul Match says same soul.
- exorcism: fix a known security bug in a revived package without changing any other answer.

### Demo data
- Made a small repo, revenant-demo, to scan for the demo.
- Recorded the real responses from that scan as fixtures. The replay test passes, so the demo works with no network.
- Demo mode at /?demo=1 shows the recorded graveyard.

### What the first real scans showed
I scanned eslint/eslint (1,117 packages, 323 dead) and checked type-check in Soul Match. These go into the specs:
- deps.dev has no dependency graph yet for some brand-new versions, for example prettier 3.10.1. The scanner should use the closest older version's graph and leave a note.
- Current maintainers should come from the package document, not the version document. The version document gave 40 for path-browserify.
- Constant cases like VERSION in type-check only need one run. They shouldn't take a share of the 100,000 inputs.
- Long action badges spilled out of the tombstone card. They need to wrap.

## Next
- Spec 1, the graveyard scanner, once the credits arrive.