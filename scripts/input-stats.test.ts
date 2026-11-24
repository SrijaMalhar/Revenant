import { describe, expect, it } from 'vitest';
import { listOssuary, loadCases } from '../packages/core/src/node/ossuary.ts';
import { inputStats, MINIMUMS } from './lib/input-stats.ts';

// Guards against generators that quietly drift towards trivial inputs.
describe('generator quality', async () => {
  for (const pkg of await listOssuary()) {
    it(`${pkg} keeps its minimum input shares`, async () => {
      const stats = inputStats(pkg, await loadCases(pkg), 3000);
      for (const [label, min] of Object.entries(MINIMUMS[pkg] ?? {})) {
        expect(stats[label], `${pkg}: ${label}`).toBeGreaterThanOrEqual(min);
      }
    });
  }
});
