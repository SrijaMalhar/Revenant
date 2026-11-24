/**
 * npm run possessions -- [<pkg>...] [--runs N]
 *
 * Runs Soul Match against every planted bug in ossuary/<pkg>/possessions.json
 * and records whether it was caught, in which case, after how many inputs of
 * that case, and how far it shrank. Writes manifest.possessions.
 * Planted bugs are test fixtures, labeled "planted"; they are never used as
 * séance replay material.
 */
process.env.TZ = 'UTC';

import { listOssuary, readPossessions } from '../packages/core/src/node/ossuary.ts';
import { updateManifest } from './lib/ossuary.ts';
import { soul } from './soul.ts';

async function main() {
  const argv = process.argv.slice(2);
  const runsAt = argv.indexOf('--runs');
  const runs = runsAt >= 0 ? Number(argv[runsAt + 1]) : 100_000;
  const named = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--runs');
  const pkgs = named.length ? named : await listOssuary();
  let survivors = 0;
  for (const pkg of pkgs) {
    const results: Record<string, unknown>[] = [];
    for (const p of await readPossessions(pkg)) {
      const run = await soul({ pkg, runs, seed: 42, target: `possessed:${p.id}`, json: false, stable: true });
      const d = run.divergence;
      const caught = run.status === 'diverged';
      const inputsToCatch = caught ? (run.perCase?.find((c) => c.name === d!.caseName)?.runs ?? null) : null;
      if (!caught) survivors++;
      results.push({
        id: p.id,
        title: p.title,
        caught,
        caseName: d?.caseName ?? null,
        inputsToCatch,
        shrinks: d?.shrinks ?? null,
        ...(p.note ? { note: p.note } : {}),
        measuredAt: new Date().toISOString().slice(0, 10),
      });
      console.log(`${pkg} ${p.id}: ${caught ? `caught in ${d!.caseName} after ${inputsToCatch} inputs, ${d!.shrinks} shrinks` : 'SURVIVED'}`);
    }
    await updateManifest(pkg, (m) => {
      m.possessions = results as typeof m.possessions;
    });
  }
  process.exit(survivors > 0 && argv.includes('--strict') ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
