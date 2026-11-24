// The four revenant-mcp tools, as plain functions so they can be tested
// without a transport. All of them wrap @revenant/core, so when an agent
// says a package passes, it ran the same harness the browser runs.
process.env.TZ = 'UTC';

import { parseScanInput, scan, rankDead } from '@revenant/core';
import type { GraveyardReport, SoulMatchRun } from '@revenant/core/types';
import { listOssuary, readManifest } from '@revenant/core/node';
import { soul } from '../../../scripts/soul.ts';
import { computeSoulprint } from '../../../scripts/soulprint.ts';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pkgDir } from '@revenant/core/node';

export async function scanRepo(repo: string, fetchFn: typeof fetch = fetch): Promise<GraveyardReport> {
  return scan(parseScanInput(repo), { fetch: fetchFn, now: () => new Date() });
}

export async function zombieIndexes(report: GraveyardReport) {
  const ossuary = await Promise.all((await listOssuary()).map(async (p) => readManifest(p)));
  return rankDead(report.nodes, { scannedAt: report.scannedAt, ossuary }).map(({ node, score }) => ({
    name: node.name,
    version: node.version,
    dev: node.dev,
    ...score,
  }));
}

export async function runSoulMatch(args: { pkg: string; target?: string; numRuns?: number; seed?: number }): Promise<SoulMatchRun> {
  const pkgs = await listOssuary();
  if (!pkgs.includes(args.pkg)) throw new Error(`${args.pkg} isn't in the Ossuary (${pkgs.join(', ')})`);
  return soul({
    pkg: args.pkg,
    runs: args.numRuns ?? 2000,
    seed: args.seed ?? Math.floor(Math.random() * 2 ** 31),
    target: (args.target ?? 'revived') as 'revived',
    json: true,
    stable: false,
  });
}

export async function soulprintOf(pkg: string) {
  const { original, revived } = await computeSoulprint(pkg);
  const file = join(pkgDir(pkg), 'soulprint.json');
  const saved = existsSync(file) ? (JSON.parse(await readFile(file, 'utf8')) as { sha256: string }) : null;
  return { pkg, original, revived, matchesOriginal: original === revived, matchesCommitted: saved ? saved.sha256 === revived : null };
}
