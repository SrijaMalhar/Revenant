/**
 * npm run self-scan [-- --write-baseline]
 *
 * Revenant on its own dependencies: scans this repo's package.json and lists
 * every dead package in the tree with its action. Fails when a dead package
 * appears that isn't in revenant.allow.json with a plan (replace or revive).
 * --write-baseline records today's dead packages with plan "watch" so later
 * runs only fail on new ones.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { rankDead, scan } from '../packages/core/src/index.ts';
import { listOssuary, readManifest, repoRoot } from '../packages/core/src/node/ossuary.ts';

type Allow = Record<string, { plan: 'replace' | 'revive' | 'watch'; note: string }>;
const allowFile = join(repoRoot, 'revenant.allow.json');

const report = await scan({ kind: 'manifest', packageJson: await readFile(join(repoRoot, 'package.json'), 'utf8') }, { fetch, now: () => new Date() });
const ossuary = await Promise.all((await listOssuary()).map((p) => readManifest(p)));
const ranked = rankDead(report.nodes, { scannedAt: report.scannedAt, ossuary });
const allow: Allow = existsSync(allowFile) ? JSON.parse(await readFile(allowFile, 'utf8')) : {};

console.log(`Revenant's own tree: ${report.nodes.length} packages, ${ranked.length} dead`);
const unplanned: string[] = [];
for (const { node, score } of ranked) {
  const plan = allow[node.name];
  console.log(`  ${String(score.total).padStart(3)}  ${node.name}@${node.version}  ${score.action}  ${plan ? `plan: ${plan.plan}` : 'NO PLAN'}`);
  if (!plan) unplanned.push(node.name);
}
if (process.argv.includes('--write-baseline')) {
  for (const name of unplanned) allow[name] = { plan: 'watch', note: `dead when the baseline was recorded on ${report.scannedAt.slice(0, 10)}` };
  await writeFile(allowFile, JSON.stringify(Object.fromEntries(Object.entries(allow).sort()), null, 2) + '\n');
  console.log(`Recorded ${unplanned.length} packages in revenant.allow.json.`);
} else if (unplanned.length) {
  console.error(`New dead dependencies without a plan: ${unplanned.join(', ')}. Add each to revenant.allow.json with plan replace or revive.`);
  process.exit(1);
}
