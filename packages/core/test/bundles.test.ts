import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSoulMatch, FROZEN_NOW } from '../src/soul/index.ts';
import { listOssuary, loadCases, readPossessions, repoRoot, withBuildEnv } from '../src/node/ossuary.ts';

// The browser runs the esbuild bundles, not the sources. Check the bundles
// themselves: revived agrees with original, and every possessed bundle is caught.
const pub = join(repoRoot, 'apps', 'web', 'public', 'ossuary');
const load = async (pkg: string, file: string) => ((await import(pathToFileURL(join(pub, pkg, file)).href)) as { default: unknown }).default;

describe('browser bundles', async () => {
  const pkgs = await listOssuary();
  for (const pkg of pkgs) {
    it.skipIf(!existsSync(join(pub, pkg, 'original.js')))(`${pkg}: bundled revived matches bundled original, planted bugs are caught`, async () => {
      const real = Date.now;
      Date.now = () => FROZEN_NOW;
      // withBuildEnv gives Node the same process.cwd the browser bundles see.
      try {
        await withBuildEnv(pkg, async () => {
        const [original, revived, cases] = await Promise.all([load(pkg, 'original.js'), load(pkg, 'revived.js'), loadCases(pkg)]);
        const same = runSoulMatch({ pkg, original, candidate: revived, cases, numRuns: 3000, seed: 42 });
        expect(same.status).toBe('same-soul');
        for (const p of await readPossessions(pkg)) {
          const possessed = await load(pkg, `possessed/${p.id}.js`);
          const run = runSoulMatch({ pkg, original, candidate: possessed, cases, numRuns: 100_000, seed: 42 });
          expect(run.status, p.id).toBe('diverged');
        }
        });
      } finally {
        Date.now = real;
      }
    });
  }
});
