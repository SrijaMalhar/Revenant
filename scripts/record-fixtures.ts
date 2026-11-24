/**
 * npm run fixtures -- <owner/repo | path/to/package.json> [--name <case>] [--demo]
 *
 * Runs a real scan against the live upstream services and records every
 * response, keyed by URL, into packages/core/test/fixtures/<case>/, with the
 * report it produced. Tests replay these and fail loudly on any unrecorded URL.
 * --demo also writes apps/web/public/demo/report.json for demo mode.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseScanInput, scan } from '../packages/core/src/graveyard/index.ts';
import type { ScanInput } from '../packages/core/src/types.ts';
import { repoRoot } from '../packages/core/src/node/ossuary.ts';

async function main() {
  const argv = process.argv.slice(2);
  const target = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--name');
  if (!target) throw new Error('Usage: npm run fixtures -- <owner/repo | package.json path> [--name <case>] [--demo]');
  const nameAt = argv.indexOf('--name');
  const input: ScanInput = target.endsWith('.json')
    ? { kind: 'manifest', packageJson: await readFile(target, 'utf8') }
    : parseScanInput(target);
  const caseName = nameAt >= 0 ? argv[nameAt + 1]! : target.replace(/[^A-Za-z0-9_.-]+/g, '__');

  const responses: Record<string, { status: number; body: string }> = {};
  const recording = async (url: string, init?: { signal?: AbortSignal }) => {
    const res = await fetch(url, { signal: init?.signal, headers: { 'user-agent': 'revenant-fixtures' } });
    const body = await res.text();
    responses[url] = { status: res.status, body };
    return { ok: res.ok, status: res.status, text: async () => body };
  };
  const scannedAt = new Date();
  const report = await scan(input, { fetch: recording, now: () => scannedAt });

  const dir = join(repoRoot, 'packages', 'core', 'test', 'fixtures', caseName);
  await mkdir(dir, { recursive: true });
  const sorted = Object.fromEntries(Object.entries(responses).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(join(dir, 'responses.json'), JSON.stringify(sorted, null, 1) + '\n');
  await writeFile(join(dir, 'meta.json'), JSON.stringify({ input, scannedAt: report.scannedAt }, null, 2) + '\n');
  await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${caseName}: ${Object.keys(responses).length} responses, ${report.nodes.length} packages, ${report.nodes.filter((n) => n.dead).length} dead -> ${dir}`);

  if (argv.includes('--demo')) {
    const demoDir = join(repoRoot, 'apps', 'web', 'public', 'demo');
    await mkdir(demoDir, { recursive: true });
    await writeFile(join(demoDir, 'report.json'), JSON.stringify({ ...report, source: 'demo' }) + '\n');
    console.log(`demo report written to ${demoDir}/report.json`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
