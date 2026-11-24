# Revenant: product brief

Kiro reads this file to generate the foundation steering docs (`product.md`, `tech.md`, `structure.md`). Keep it current; when a decision changes, change it here first.

## One sentence

Revenant rebuilds abandoned npm packages with Kiro and tests each rebuild against the original on 100,000 generated inputs.

## Problem

- Every dependency adds code, install scripts and maintainer accounts a project trusts without knowing it.
- In 2026, npm worms spread through maintainer accounts and `preinstall` scripts. On Aug 4, 2026, ChainDrop started from the GitHub account of the maintainer of keyv, an actively maintained library.
- Many packages inside everyday toolchains have had no release in years, and nobody is watching them. A fresh project with one popular linter installed already pulls in `type-check`, last released Apr 3, 2020 and downloaded about 199 million times a week.

## Users

JavaScript developers and maintainers who want fewer, safer dependencies, and Kiro users who want to revive a dependency inside their own project.

## What Revenant does

### Web app: three screens, no LLM calls

1. **Graveyard.** Paste a public GitHub repo URL or a `package.json`. Revenant resolves the full dependency graph, including devDependencies, because those run on developer machines and in CI. Every package with no release in 3 or more years becomes a tombstone. Its epitaph shows the last release date, weekly downloads, maintainer count, install scripts and open advisories.
2. **Zombie Index.** A transparent risk score with the formula visible on click. If the e18e `module-replacements` list names a maintained replacement, the tombstone says "Replace with X" instead of "Revive".
3. **Soul Match.** For packages in the Ossuary, the original and the revived version run side by side on generated inputs in a Web Worker, with a live counter. A disagreement is shrunk to a minimal input and shown in the séance view. The séance replay runs Soul Match against the agent's real buggy first draft from git history, clearly labeled as a replay.
4. **Exorcism chart** (part of the Soul Match screen for `timespan`): runtime against input size, original vs revived.

### Inside Kiro: the Revenant Power

- **Necromancer agent** writes code. It loads three skills: autopsy (source, README, tests and issues into an EARS spec), resurrection (implement the spec tasks) and exorcism (remove a known vulnerability as a declared divergence).
- **Coroner agent** is read-only. It runs Soul Match and reports results. It has no write tools, so it cannot weaken tests.
- **revenant-mcp** server tools: `scan_repo`, `zombie_index`, `run_soul_match`, `soulprint`.
- Anyone can install the Power from the GitHub URL and say "resurrect this dependency".

## The Ossuary: locked to 3 packages

| Package | Version | Last release | Why |
| --- | --- | --- | --- |
| `type-check` | 0.4.0 | 2020-04-03 | Type-string parser and checker inside the linter's dependency tree |
| `path-browserify` | 1.0.1 | 2020-03-03 | POSIX path algebra; Node's `path.posix` is a second referee |
| `timespan` | 2.3.0 | 2013-10-08 | The exorcism: unpatched ReDoS, CVE-2017-16115 |

Alternates if one fails the Day 2 bundling spike: `pluralize` 8.0.0, `querystring-es3` 0.2.1. Details in `docs/OSSUARY-CANDIDATES.md`.

## The "same soul" rule

On every generated input, the return values are deep-equal, and if one version throws, the other throws too. Error messages and input mutation are ignored. Intended differences are declared in the package's spec as EXORCISED requirements, each with its own test. This is differential testing: strong evidence over the inputs tried, not a proof.

## Out of scope

- Live AI rewriting from the web app (needs paid LLM calls during judging).
- Packages that use the network, files, timers or randomness.
- Ecosystems other than npm (roadmap: PyPI and Cargo through deps.dev).
- Pull requests on repos the user does not own.

## Tech

- TypeScript everywhere, strict mode. Node 20 or newer.
- npm workspaces monorepo.
- Web: Vite, React, TypeScript, Tailwind. Framer Motion only if time allows.
- Tests: Vitest and fast-check.
- Bundling: esbuild at build time only (`scripts/build-ossuary`). Outputs are committed under `apps/web/public/ossuary/`. The browser never bundles anything.
- Edge API: one serverless function (Vercel or Cloudflare) that proxies and caches deps.dev, the npm registry, the npm downloads API and OSV.dev. deps.dev explicitly allows caching.
- e18e data: the `module-replacements` npm package, bundled at build time.
- MCP server: TypeScript MCP SDK over stdio.
- Hosting: a free tier that stays up until judging ends on Jan 29, 2027.

## Data sources

| Data | Source |
| --- | --- |
| Resolved dependency graph | deps.dev `GetDependencies` |
| Advisories, deprecation | deps.dev `GetVersion`, OSV.dev |
| OpenSSF Scorecard | deps.dev `GetProject` |
| Last publish, maintainers, install scripts | npm registry package document |
| Weekly downloads | npm downloads API |
| Maintained replacements | e18e `module-replacements` |

## Structure

```
revenant/
  .kiro/            specs, steering, hooks, settings (never gitignored)
  apps/web/         the three-screen web app
  packages/core/    graph resolver, Zombie Index, Soul Match harness, Soulprint (shared by web and MCP)
  packages/mcp/     revenant-mcp server
  power/            the Revenant Power: plugin.json, skills/, mcp.json, agent configs
  ossuary/<name>/   original/ (pinned, never edited), revived/ (TypeScript), spec link, Soulprint
  scripts/          build-ossuary and other build scripts
  api/              the edge function
  docs/             brief, candidates, write-up drafts
```

## Prior work to credit

The e18e community's `module-replacements` manifests and its ecosystem cleanup project. Revenant's new part is the AI rewrite for packages with no maintained replacement, tested against the original.
