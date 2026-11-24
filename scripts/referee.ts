/**
 * npm run referee
 *
 * Second referee for path-browserify: how often the original agrees with
 * Node's own path.posix on the same generated inputs. Informational only;
 * path-browserify ports an older Node path, so differences can be expected,
 * and the revived package follows the original, not Node.
 * Writes manifest.referee with up to three of the smallest differing inputs.
 */
process.env.TZ = 'UTC';

import { posix } from 'node:path';
import fc from 'fast-check';
import { outcome, sameOutcome, canonicalString } from '../packages/core/src/soul/index.ts';
import { loadCases, loadOriginal, withBuildEnv } from '../packages/core/src/node/ossuary.ts';
import { updateManifest } from './lib/ossuary.ts';
import type { Outcome } from '../packages/core/src/types.ts';

const PKG = 'path-browserify';
const SKIP = new Set(['sep', 'delimiter', 'win32', 'posix', '_makeLong']); // properties and private helpers, not path behaviour

async function main() {
  const perCase = Number(process.argv[process.argv.indexOf('--n') + 1]) || 10_000;
  await withBuildEnv(PKG, async () => {
    const original = await loadOriginal(PKG);
    const cases = (await loadCases(PKG)).filter((c) => !SKIP.has(c.name));
    let agree = 0;
    let total = 0;
    const diffs: { caseName: string; input: unknown; original: Outcome; node: Outcome; size: number }[] = [];
    const byCase: Record<string, number> = {};
    for (const c of cases) {
      for (const input of fc.sample(c.arbitrary, { seed: 42, numRuns: perCase })) {
        total++;
        const a = outcome(c, original, input);
        const b = outcome(c, posix, input);
        if (sameOutcome(a, b)) agree++;
        else {
          byCase[c.name] = (byCase[c.name] ?? 0) + 1;
          diffs.push({ caseName: c.name, input, original: a, node: b, size: canonicalString(input).length });
        }
      }
    }
    // The three smallest differing inputs from different cases, for the panel.
    diffs.sort((x, y) => x.size - y.size);
    const examples: typeof diffs = [];
    for (const d of diffs) {
      if (examples.length === 3) break;
      if (!examples.some((e) => e.caseName === d.caseName)) examples.push(d);
    }
    console.log(`path-browserify vs node:path.posix (Node ${process.versions.node}): agree on ${agree.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} inputs`);
    for (const [k, v] of Object.entries(byCase)) console.log(`  ${k}: ${v} differ`);
    for (const e of examples) console.log(`  e.g. ${e.caseName}(${JSON.stringify(e.input)}): original ${JSON.stringify(e.original)}, node ${JSON.stringify(e.node)}`);
    await updateManifest(PKG, (m) => {
      m.referee = {
        against: 'node:path.posix',
        agree,
        total,
        examples: examples.map(({ caseName, input, original: o, node }) => ({ caseName, input, original: o, node })),
        measuredAt: `${new Date().toISOString().slice(0, 10)} (Node ${process.versions.node})`,
      };
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
