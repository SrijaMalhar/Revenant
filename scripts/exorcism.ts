/**
 * npm run exorcism
 *
 * Measures the original and revived timespan parseDate on the slow-path input
 * at growing sizes and writes ossuary/timespan/exorcism.json, which the
 * exorcism chart reads. The input is built here in code and never printed.
 */
process.env.TZ = 'UTC';

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import { FROZEN_NOW } from '../packages/core/src/soul/index.ts';
import { loadOriginal, loadRevived, pkgDir } from '../packages/core/src/node/ossuary.ts';

const SIZES = [1000, 2000, 5000, 10000, 20000, 40000];
type Mod = { parseDate: (s: string) => unknown };

function median(fn: () => unknown, reps: number): number {
  const t: number[] = [];
  for (let i = 0; i < reps; i++) {
    const s = performance.now();
    fn();
    t.push(performance.now() - s);
  }
  t.sort((a, b) => a - b);
  return t[Math.floor(t.length / 2)]!;
}

async function main() {
  Date.now = () => FROZEN_NOW;
  const original = (await loadOriginal('timespan')) as Mod;
  const revived = (await loadRevived('timespan')) as Mod;
  const points = [];
  for (const n of SIZES) {
    const input = 'NOW+' + '1'.repeat(n) + 'a';
    original.parseDate(input);
    revived.parseDate(input);
    const reps = n >= 20000 ? 3 : 5;
    const originalMs = median(() => original.parseDate(input), reps);
    const revivedMs = median(() => revived.parseDate(input), 9);
    points.push({ n, originalMs: Math.round(originalMs * 100) / 100, revivedMs: Math.round(revivedMs * 1000) / 1000 });
    console.log(`n=${n}  original ${originalMs.toFixed(1)} ms  revived ${revivedMs.toFixed(3)} ms`);
  }
  const out = {
    advisory: { id: 'GHSA-f523-2f5j-gfcg', cve: 'CVE-2017-16115', url: 'https://github.com/advisories/GHSA-f523-2f5j-gfcg' },
    input: "parseDate('NOW+' + n digits + 'a')",
    measuredAt: new Date(new Date().getTime()).toISOString().slice(0, 10),
    runtime: `Node ${process.versions.node}`,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    method: 'median of 3 to 9 runs after one warm-up run',
    points,
  };
  await writeFile(join(pkgDir('timespan'), 'exorcism.json'), JSON.stringify(out, null, 2) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
