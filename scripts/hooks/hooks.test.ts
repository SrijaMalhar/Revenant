import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { repoRoot } from '../../packages/core/src/node/ossuary.ts';
import { packagesFrom } from './bouncer.ts';
import { touchesOriginal } from './oracle-guard.ts';
import { packageOf } from './soul-on-save.ts';

const tsx = join(repoRoot, 'node_modules', '.bin', 'tsx');
const guard = (payload: unknown) =>
  spawnSync(tsx, ['scripts/hooks/oracle-guard.ts'], { cwd: repoRoot, input: JSON.stringify(payload), encoding: 'utf8' });

describe('oracle guard', () => {
  it('blocks writes into an original, wherever the path appears', () => {
    expect(guard({ tool_name: 'fsWrite', tool_input: { path: 'ossuary/timespan/original/lib/time-span.js' } }).status).toBe(2);
    expect(guard({ tool_name: 'fsWrite', tool_input: { files: [{ file_path: join(repoRoot, 'ossuary/type-check/original/lib/check.js') }] } }).status).toBe(2);
  });
  it('lets everything else through', () => {
    expect(guard({ tool_name: 'fsWrite', tool_input: { path: 'ossuary/timespan/revived/src/index.ts' } }).status).toBe(0);
    expect(touchesOriginal('docs/original/notes.md')).toBe(false);
  });
});

describe('save hook', () => {
  it('maps a saved file to its package', () => {
    expect(packageOf(join(repoRoot, 'ossuary/type-check/revived/src/index.ts'))).toBe('type-check');
    expect(packageOf(join(repoRoot, 'ossuary/type-check/original/lib/index.js'))).toBeNull();
  });
});

describe('bouncer', () => {
  it('reads package names from install commands', () => {
    expect(packagesFrom('npm install timespan@2.3.0 --save && yarn add @s/x left-pad')).toEqual(['timespan', '@s/x', 'left-pad']);
    expect(packagesFrom('npm test')).toEqual([]);
    expect(packagesFrom('pnpm add -D vitest')).toEqual(['vitest']);
  });
});
