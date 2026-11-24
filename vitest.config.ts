import { defineConfig } from 'vitest/config';

// Every Node run uses UTC: timespan reads local-time getters, so Soulprints and
// test results would otherwise differ between machines.
process.env.TZ = 'UTC';

export default defineConfig({
  test: {
    include: [
      'packages/*/test/**/*.test.ts',
      'ossuary/*/*.test.ts',
      'scripts/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
    ],
    env: { TZ: 'UTC' },
    testTimeout: 120_000,
    hookTimeout: 120_000,
    reporters: process.env.CI ? ['default', 'json'] : ['default'],
    outputFile: { json: 'reports/vitest.json' },
  },
});
