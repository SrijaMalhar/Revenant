/**
 * npm run soulprint -- [<pkg>...]     writes ossuary/<pkg>/soulprint.json
 * npm run soulprint:check             recomputes every Soulprint and fails on drift
 *
 * A Soulprint hashes [caseName, input, outcome] for 10,000 inputs per case
 * (seed 42). The original and the revived package must hash the same.
 */
process.env.TZ = 'UTC';

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { FROZEN_NOW, soulprintHash, SOULPRINT_N, SOULPRINT_SEED, shortHash } from '../packages/core/src/soul/index.ts';
import type { Soulprint } from '../packages/core/src/types.ts';
import {
  listOssuary,
  loadCases,
  loadOriginal,
  loadRevived,
  pkgDir,
  readManifest,
  withBuildEnv,
} from '../packages/core/src/node/ossuary.ts';

const require = createRequire(import.meta.url);
export const fastCheckVersion: string = require('fast-check/package.json').version;

export async function computeSoulprint(pkg: string): Promise<{ original: string; revived: string }> {
  const realNow = Date.now;
  Date.now = () => FROZEN_NOW;
  try {
    return await withBuildEnv(pkg, async () => {
      const [original, revived, cases] = await Promise.all([loadOriginal(pkg), loadRevived(pkg), loadCases(pkg)]);
      return {
        original: soulprintHash(original, cases, SOULPRINT_SEED, SOULPRINT_N),
        revived: soulprintHash(revived, cases, SOULPRINT_SEED, SOULPRINT_N),
      };
    });
  } finally {
    Date.now = realNow;
  }
}

async function main() {
  const check = process.argv.includes('--check');
  const named = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const pkgs = named.length ? named : await listOssuary();
  let failed = false;
  for (const pkg of pkgs) {
    const m = await readManifest(pkg);
    const { original, revived } = await computeSoulprint(pkg);
    const file = join(pkgDir(pkg), 'soulprint.json');
    if (original !== revived) {
      console.error(`${pkg}: revived Soulprint ${shortHash(revived)} does not match the original's ${shortHash(original)}`);
      failed = true;
      continue;
    }
    const print: Soulprint = {
      pkg,
      version: m.version,
      fastCheck: fastCheckVersion,
      seed: SOULPRINT_SEED,
      n: SOULPRINT_N,
      sha256: revived,
      tz: 'UTC',
    };
    if (check) {
      if (!existsSync(file)) {
        console.error(`${pkg}: no soulprint.json; run npm run soulprint`);
        failed = true;
        continue;
      }
      const saved = JSON.parse(await readFile(file, 'utf8')) as Soulprint;
      if (saved.sha256 !== print.sha256 || saved.fastCheck !== print.fastCheck) {
        console.error(`${pkg}: Soulprint drifted: saved ${shortHash(saved.sha256)}, now ${shortHash(print.sha256)}`);
        failed = true;
        continue;
      }
      console.log(`${pkg}: Soulprint ${shortHash(print.sha256)} · ${SOULPRINT_N.toLocaleString('en-US')} inputs per case · matches original`);
    } else {
      await writeFile(file, JSON.stringify(print, null, 2) + '\n');
      console.log(`${pkg}: wrote Soulprint ${shortHash(print.sha256)}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
