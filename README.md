# Revenant

[![ci](https://github.com/SrijaMalhar/revenant/actions/workflows/ci.yml/badge.svg?branch=reference)](https://github.com/SrijaMalhar/revenant/actions/workflows/ci.yml)

Revenant finds abandoned npm packages in a project's dependency tree and rebuilds the worst ones as zero-dependency TypeScript. Then it runs the original and the rebuild side by side on 100,000 generated inputs and shows every disagreement.

It's differential testing: strong evidence over the inputs tried, not a proof. Every number below is measured by Revenant's own scripts, with the date it was measured.

## What it does

**Graveyard.** Paste a public GitHub repo or a `package.json`. Revenant resolves the whole dependency tree, dev dependencies included, and every package with no release in three years becomes a tombstone with a Zombie Index from 0 to 100:

| Part | Max | From |
| --- | --- | --- |
| Abandonment | 40 | 40 if deprecated, else 40 × min(years since last release, 10) / 10 |
| Attack surface | 40 | 15 for install scripts, 10 for one maintainer account or fewer, 15 × min(open advisories, 3) / 3 |
| Reach | 20 | 20 × min(log10(weekly downloads) / 9, 1) |

The action is **Replace** when e18e's [module-replacements](https://github.com/e18e/module-replacements) lists a maintained alternative, **Revive** when the package is in the Ossuary, and **Watch** otherwise. Each tombstone's height, crack, chain, glow and fog encode data, and its heartbeat line is drawn from real publish dates.

**Soul Match.** For a revived package, the browser runs the original and the rebuild on 100,000 generated inputs in a Web Worker. Same soul means every return value is deep-equal after projection, and if one side throws, the other does too. A disagreement is shrunk to a minimal input and shown in the séance view, step by step.

**The exorcism.** timespan's `parseDate` takes quadratic time on a long run of digits ([CVE-2017-16115](https://github.com/advisories/GHSA-f523-2f5j-gfcg), never patched). The revived parser reads the same input in one pass and returns the same Date for every input the original parses.

The web app makes no LLM calls.

## The Ossuary

Three packages, each vendored exactly as npm serves it (checked against the registry's `dist.integrity`), next to its rebuild:

| Package | Version | Last release | Rebuild |
| --- | --- | --- | --- |
| [type-check](ossuary/type-check) | 0.4.0 | 2020-04-03 | prelude-ls inlined, so one revival removes two abandoned packages |
| [path-browserify](ossuary/path-browserify) | 1.0.1 | 2020-03-03 | Node's POSIX path algebra, quirks kept |
| [timespan](ossuary/timespan) | 2.3.0 | 2013-10-08 | ReDoS removed, every other answer kept |

<!-- soulprints:start -->
| Package | Soulprint | Inputs | |
| --- | --- | --- | --- |
| path-browserify 1.0.1 | `6ff6…0f` | 10,000 inputs per case, seed 42, fast-check 4.11.0 | matches original |
| timespan 2.3.0 | `1364…28` | 10,000 inputs per case, seed 42, fast-check 4.11.0 | matches original |
| type-check 0.4.0 | `5bdb…26` | 10,000 inputs per case, seed 42, fast-check 4.11.0 | matches original |
<!-- soulprints:end -->

### Evidence, measured 2026-11-24 (UTC) on Node 22.23.5

- **Same soul** on 100,000 inputs for all three packages, on seeds 42, 1, 7, 1234, 99999 and 31337. CI adds a fresh random seed on every push.
- **Soul coverage** (c8): the generated inputs reached 99.11% of path-browserify's branches, 99.39% of timespan's and 97.54% of type-check's. Uncovered lines are listed in each `manifest.json`.
- **Planted bugs:** 14 deliberately broken copies (`possessions.json`); Soul Match catches all 14 at 100,000 inputs. Three survived at first, which exposed three generator gaps; each is noted in its package's `possessions.json` with the fix.
- **ReDoS gate** (recheck 4.6.2): 7 vulnerable regexes in timespan's original, all 2nd-degree polynomial; 0 in any revived package. CI fails if a revived package gains one.
- **Exorcism timings** for `parseDate('NOW+' + n digits + 'a')`:

  | Digits | Original | Revived |
  | --- | --- | --- |
  | 5,000 | 75 ms | 0.02 ms |
  | 10,000 | 304 ms | 0.04 ms |
  | 20,000 | 1,235 ms | 0.12 ms |
  | 40,000 | 4,963 ms | 0.11 ms |

  The timing test builds the input in code; there's no ready-made attack string in this repo.
- **Second referee:** path-browserify agrees with Node's own `path.posix` on 109,434 of 110,000 generated inputs. Every difference is in `format()`, where Node rejects arrays.
- **Receipts:** the revived packages pull nothing from the registry and run no install scripts. They are not always smaller: type-check goes from 6,516 to 1,716 bytes gzipped (prelude-ls is gone), but path-browserify grows from 1,746 to 1,812 and timespan from 1,762 to 2,004.

## What this shows, and what it doesn't

- Agreement over the inputs the generators produce, with the coverage above. A bug outside that domain can hide.
- Error messages and argument mutation aren't compared; whether a call throws is.
- deps.dev resolves each dependency's graph on its own, so the merged graph is close to, but not exactly, what `npm install` produces. Reading `package-lock.json` is on the roadmap.
- Maintainer counts come from the npm package document's current maintainers. Revenant shows counts only, never names.

## Running it

Node 22 or newer.

```sh
npm install
npm run dev            # the web app, with the proxy, at http://localhost:5173
npm test               # unit, property, exorcism, MCP and hook tests (TZ is set to UTC)
```

| Script | Does |
| --- | --- |
| `npm run soul -- <pkg> [--runs N] [--seed S] [--target revived\|replay\|possessed:<id>]` | Soul Match in Node; prints same soul or the shrunk counterexample and the command to replay it |
| `npm run soulprint` / `soulprint:check` | Writes or re-checks each package's Soulprint |
| `npm run vendor -- <pkg>@<version>` | Downloads a tarball, checks its integrity, unpacks it into `ossuary/<pkg>/original/` |
| `npm run build:ossuary` | Bundles originals, rebuilds, planted bugs and the revived libraries |
| `npm run possessions` | Runs every planted bug and records what was caught |
| `npm run coverage`, `redos`, `receipt`, `referee`, `input-stats`, `exorcism` | Measures the evidence above and writes it into the manifests |
| `npm run rules:check` | No dependencies or install scripts in a rebuild, license kept, originals byte-for-byte untouched |
| `npm run determinism` | Same seed, same bytes, in two separate processes |
| `npm run fixtures -- <owner/repo> [--demo]` | Records live upstream responses for tests; `--demo` also writes the demo-mode report |
| `npm run cli -- scan <owner/repo>` | The graveyard in a terminal; exits 1 above `--threshold` |
| `npm run self-scan` | Scans Revenant's own tree |
| `npm run build` | `build:ossuary`, then the web app |

### revenant-mcp

`packages/mcp` is a stdio MCP server with four tools: `scan_repo`, `zombie_index`, `run_soul_match` and `soulprint`. They call the same `@revenant/core` the browser does. To register it:

```json
{
  "mcpServers": {
    "revenant": { "command": "node", "args": ["packages/mcp/bin/revenant-mcp.js"] }
  }
}
```

### Hook commands

`scripts/hooks/` holds the commands the editor hooks run: `soul-on-save.ts` (quick Soul Match on save, keeping any failing draft as séance material), `oracle-guard.ts` (blocks writes under `ossuary/<pkg>/original/`), `bouncer.ts` (blocks installing a flagged package) and `refresh-badges.ts` (keeps the Soulprints above current).

## Layout

```
apps/web/             the two-screen web app (Vite, React); public/ossuary holds the committed bundles
packages/core/        scanner, Zombie Index, Soul Match harness, Soulprint: shared by everything
packages/mcp/         revenant-mcp
ossuary/<pkg>/        original/ (never edited), revived/, cases.ts, manifest.json, possessions.json
scripts/              build, measurement and hook scripts
api/proxy.ts          the one serverless function: an allowlisted, caching proxy
```

## Deploying

`vercel.json` builds with `npm run build`, serves `apps/web/dist`, and deploys `api/proxy.ts` as a function. Before relying on demo mode, record a real report with `npm run fixtures -- <owner/repo> --demo` and commit `apps/web/public/demo/report.json`.

## Status of this branch

`reference` holds the working code. Still to be made in Kiro: the specs under `.kiro/specs/`, the remaining steering files, the hook files that call `scripts/hooks/`, the Necromancer and Coroner agents, the three skills and the Power. The epitaph templates in `apps/web/src/lib/graveyard.ts` are intentionally empty, and no séance replay exists yet because no draft has failed Soul Match.

## Credits and third-party code

The originals under `ossuary/*/original/` are unmodified third-party packages, included so the rebuilds can be tested against them:

- type-check 0.4.0 and prelude-ls 1.2.1 by George Zahariev, MIT
- path-browserify 1.0.1 by James Halliday, MIT, which ports Node.js's `path` (Joyent, Inc. and other Node contributors, MIT)
- timespan 2.3.0 by Michael Stum and Charlie Robbins, MIT

Each rebuild keeps the original's license notice and credits its author. Replacement suggestions come from [e18e's module-replacements](https://github.com/e18e/module-replacements) (MIT). Dependency data comes from [deps.dev](https://deps.dev) and the npm registry.

Revenant is MIT licensed.
