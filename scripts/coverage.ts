/**
 * npm run coverage -- [<pkg>...] [--runs N] [--seed S] [--min-branches P]
 *
 * Soul coverage: how much of the original's code the generated inputs reach.
 * Runs Soul Match under V8 coverage (c8), counting only files under
 * ossuary/<pkg>/original/, and records line and branch percentages, the seed
 * and the uncovered lines in manifest.coverage.
 * --min-branches fails the run below a threshold. Set it from a real
 * measurement, never before one.
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { listOssuary, repoRoot } from '../packages/core/src/node/ossuary.ts';
import { updateManifest } from './lib/ossuary.ts';

interface Summary {
  [file: string]: { lines: { pct: number }; branches: { pct: number }; lines_total?: number };
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const runs = Number(opt('--runs') ?? 100_000);
  const seed = Number(opt('--seed') ?? 42);
  const minBranches = opt('--min-branches') !== undefined ? Number(opt('--min-branches')) : null;
  const named = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
  const pkgs = named.length ? named : await listOssuary();
  let failed = false;

  for (const pkg of pkgs) {
    const dir = await mkdtemp(join(tmpdir(), `revenant-cov-${pkg}-`));
    const include = `ossuary/${pkg}/original/**`;
    const c8 = join(repoRoot, 'node_modules', '.bin', 'c8');
    const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx');
    const res = spawnSync(
      c8,
      ['--include', include, '--exclude-after-remap=false', '--reporter', 'json-summary', '--reporter', 'json', '--report-dir', dir, '--temp-directory', join(dir, 'tmp'), tsx, 'scripts/soul.ts', pkg, '--runs', String(runs), '--seed', String(seed)],
      { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } },
    );
    if (res.status !== 0) {
      console.error(res.stdout, res.stderr);
      throw new Error(`${pkg}: soul match under c8 failed`);
    }
    const summary = JSON.parse(await readFile(join(dir, 'coverage-summary.json'), 'utf8')) as Summary & { total: Summary[string] };
    const detail = JSON.parse(await readFile(join(dir, 'coverage-final.json'), 'utf8')) as Record<
      string,
      { statementMap: Record<string, { start: { line: number } }>; s: Record<string, number> }
    >;
    const uncovered: string[] = [];
    for (const [file, d] of Object.entries(detail)) {
      const lines = new Set<number>();
      for (const [id, count] of Object.entries(d.s)) if (count === 0) lines.add(d.statementMap[id]!.start.line);
      const sorted = [...lines].sort((a, b) => a - b);
      // Collapse into ranges: file:12-14
      for (let i = 0; i < sorted.length; ) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
        uncovered.push(`${relative(join(repoRoot, 'ossuary', pkg), file)}:${sorted[i]}${j > i ? `-${sorted[j]}` : ''}`);
        i = j + 1;
      }
    }
    const lines = summary.total.lines.pct;
    const branches = summary.total.branches.pct;
    console.log(`${pkg}: ${runs.toLocaleString('en-US')} inputs reached ${lines}% of the original's lines and ${branches}% of its branches (seed ${seed})`);
    if (uncovered.length) console.log(`  uncovered: ${uncovered.join(', ')}`);
    await updateManifest(pkg, (m) => {
      m.coverage = { lines, branches, seed, measuredAt: new Date().toISOString().slice(0, 10), uncovered };
    });
    if (minBranches !== null && branches < minBranches) {
      console.error(`${pkg}: branch coverage ${branches}% is below ${minBranches}%`);
      failed = true;
    }
    await rm(dir, { recursive: true, force: true });
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
