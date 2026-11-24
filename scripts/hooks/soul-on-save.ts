/**
 * Hook command for File Save on ossuary/<pkg>/revived/:
 *   tsx scripts/hooks/soul-on-save.ts <saved file path>
 *
 * Runs a quick Soul Match (2,000 inputs, random seed, logged). On a failure
 * it keeps the draft as ossuary/<pkg>/drafts/<n>.ts with the shrunk
 * counterexample in drafts/<n>.json, both timestamped, prints the
 * counterexample for the agent, and exits 1. The first saved draft becomes
 * the séance replay. Nothing here writes a bug on purpose.
 */
process.env.TZ = 'UTC';

import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { canonical } from '../../packages/core/src/soul/index.ts';
import { pkgDir, repoRoot } from '../../packages/core/src/node/ossuary.ts';
import { updateManifest } from '../lib/ossuary.ts';
import { formatRun } from '../lib/format.ts';
import { soul } from '../soul.ts';

export function packageOf(file: string): string | null {
  const rel = relative(repoRoot, file).split(sep).join('/');
  const m = /^ossuary\/([^/]+)\/revived\//.exec(rel);
  return m ? m[1]! : null;
}

async function main() {
  const file = process.argv[2];
  const pkg = file ? packageOf(file) : null;
  if (!pkg) {
    console.log('Not a revived package file; nothing to check.');
    return;
  }
  const seed = Math.floor(Math.random() * 2 ** 31);
  const run = await soul({ pkg, runs: 2000, seed, target: 'revived', json: false, stable: false });
  console.log(formatRun(run));
  if (run.status !== 'diverged') {
    process.exit(run.status === 'same-soul' ? 0 : 1);
  }

  const drafts = join(pkgDir(pkg), 'drafts');
  await mkdir(drafts, { recursive: true });
  const taken = (await readdir(drafts)).map((f) => Number(/^(\d+)\.ts$/.exec(f)?.[1])).filter(Number.isFinite);
  const n = (taken.length ? Math.max(...taken) : 0) + 1;
  const recordedAt = new Date().toISOString();
  await copyFile(join(pkgDir(pkg), 'revived', 'src', 'index.ts'), join(drafts, `${n}.ts`));
  const d = run.divergence!;
  await writeFile(
    join(drafts, `${n}.json`),
    JSON.stringify({ caseName: d.caseName, input: canonical(d.input), original: d.original, candidate: d.candidate, shrinks: d.shrinks, seed: d.runSeed, path: d.counterexamplePath, recordedAt }, null, 2) + '\n',
  );
  if (n === 1 || !existsSync(join(drafts, '1.ts'))) {
    await updateManifest(pkg, (m) => {
      m.replay ??= { draft: `drafts/${n}.ts`, recordedAt, note: `First draft of the revived ${pkg} that failed Soul Match, saved by the save hook.` };
    });
  }
  console.log(`Saved this draft as drafts/${n}.ts with its counterexample. Fix the revived code, not the test.`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
