import { describe, expect, it } from 'vitest';
import { soul } from '../../scripts/soul.ts';

// Same soul on 2,000 inputs per test run; CI runs the full 100,000 with
// `npm run soul` on seed 42 plus one random seed.
describe('path-browserify soul match', () => {
  it('matches the original', async () => {
    const run = await soul({ pkg: 'path-browserify', runs: 2000, seed: 42, target: 'revived', json: false, stable: true });
    expect(run.divergence).toBeUndefined();
    expect(run.status).toBe('same-soul');
  });
});
