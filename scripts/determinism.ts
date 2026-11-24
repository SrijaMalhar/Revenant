/**
 * npm run determinism
 *
 * The same seed must give byte-identical results twice in a row, in two
 * separate processes. Catches anything that sneaks in Math.random or an
 * unfrozen clock.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { listOssuary, repoRoot } from '../packages/core/src/node/ossuary.ts';

const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx');
const run = (args: string[]) => {
  const r = spawnSync(tsx, args, { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } });
  return r.stdout + r.stderr;
};

let failed = false;
for (const pkg of await listOssuary()) {
  const soul = ['scripts/soul.ts', pkg, '--seed', '42', '--runs', '20000', '--json', '--stable'];
  const a = run(soul);
  const b = run(soul);
  const printArgs = ['scripts/soulprint.ts', '--check', pkg];
  const c = run(printArgs);
  const d = run(printArgs);
  const ok = a === b && c === d;
  if (!ok) failed = true;
  console.log(`${pkg}: soul match ${a === b ? 'identical' : 'DIFFERS'}, soulprint ${c === d ? 'identical' : 'DIFFERS'}`);
}
process.exit(failed ? 1 : 0);
