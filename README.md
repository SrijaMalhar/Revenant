# Revenant
# Revenant

Revenant finds abandoned npm packages in a project's dependencies, rebuilds the worst ones as small TypeScript packages with no dependencies, and checks each rebuild against the original on 100,000 generated inputs.

It's differential testing: strong evidence over the inputs it tries, not a proof.

## How it works

1. **Graveyard.** Paste a public GitHub repo or a package.json. Every package with no release in 3 years becomes a tombstone.
2. **Zombie Index.** Each dead package gets a score from 0 to 100, based on how long it's been abandoned, how risky it is (install scripts, one maintainer, security advisories) and how many people download it.
3. **Replace, Revive or Watch.** If a maintained replacement exists (from e18e's module-replacements list), use it. If Revenant has rebuilt the package, revive it. Otherwise, watch it.
4. **Soul Match.** The original and the rebuild run side by side in your browser on generated inputs. Every answer must match, and if one throws, the other must throw too.
5. **Exorcism.** timespan's date parser has a known slowdown bug (CVE-2017-16115). The rebuild fixes it and keeps every other answer the same.

## The Ossuary

The packages Revenant has rebuilt:

| Package | Version | Last release |
| --- | --- | --- |
| type-check | 0.4.0 | 2020 |
| path-browserify | 1.0.1 | 2020 |
| timespan | 2.3.0 | 2013 |

## Built with Kiro

- **Steering:** rules that always apply, notes that load only for a given package, generator rules that load when needed, and an exorcism checklist I pull in by hand.
- **Skills:** autopsy, resurrection and exorcism.
- **Specs, hooks, agents and the Power:** in progress.

## Credits

The original packages in `ossuary/*/original/` are unmodified third-party code, MIT licensed, kept so the rebuilds can be tested against them:

- type-check and prelude-ls by George Zahariev
- path-browserify by James Halliday (a port of Node.js's path module)
- timespan by Michael Stum and Charlie Robbins

Each rebuild keeps the original license and credits its author. Replacement suggestions come from e18e's module-replacements. Package data comes from deps.dev and the npm registry.

## License

MIT