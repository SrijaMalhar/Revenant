import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'node:path';

// End to end over stdio, the way Kiro talks to it.
const bin = join(import.meta.dirname, '..', 'bin', 'revenant-mcp.js');
let client: Client;

beforeAll(async () => {
  client = new Client({ name: 'test', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [bin] }));
});
afterAll(async () => client?.close());

const text = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content[0]!.text);

describe('revenant-mcp', () => {
  it('lists the four tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['run_soul_match', 'scan_repo', 'soulprint', 'zombie_index']);
  });

  it('runs Soul Match with the same harness as the browser', async () => {
    const run = text(await client.callTool({ name: 'run_soul_match', arguments: { pkg: 'path-browserify', numRuns: 2000, seed: 42 } }));
    expect(run.status).toBe('same-soul');
    expect(run.done).toBe(2000);
  });

  it('reports a planted bug as a divergence', async () => {
    const run = text(await client.callTool({ name: 'run_soul_match', arguments: { pkg: 'timespan', target: 'possessed:sign-ignored', numRuns: 2000, seed: 42 } }));
    expect(run.status).toBe('diverged');
  });

  it('computes matching Soulprints', async () => {
    const p = text(await client.callTool({ name: 'soulprint', arguments: { pkg: 'type-check' } }));
    expect(p.matchesOriginal).toBe(true);
    expect(p.matchesCommitted).toBe(true);
  });

  it('scores a report', async () => {
    const report = {
      input: { kind: 'manifest', packageJson: '{}' },
      scannedAt: '2026-11-25T00:00:00.000Z',
      root: { name: 'x', deps: 1, devDeps: 0 },
      nodes: [
        {
          name: 'type-check',
          version: '0.4.0',
          depth: 0,
          path: ['x', 'type-check@0.4.0'],
          dev: false,
          dead: true,
          replacement: null,
          vitals: { latestVersion: '0.4.0', lastRelease: '2020-04-03T00:00:00Z', maintainers: 1, deprecated: null, installScripts: false, weeklyDownloads: 199418512, advisories: [] },
        },
      ],
      errors: [],
      truncated: false,
      source: 'live',
    };
    const scores = text(await client.callTool({ name: 'zombie_index', arguments: { report } }));
    expect(scores[0]).toMatchObject({ name: 'type-check', total: 55, action: 'revive' });
  });

  it('says plainly when a package is not in the Ossuary', async () => {
    const r = (await client.callTool({ name: 'run_soul_match', arguments: { pkg: 'left-pad' } })) as { isError?: boolean; content: { text: string }[] };
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toContain("isn't in the Ossuary");
  });
});
