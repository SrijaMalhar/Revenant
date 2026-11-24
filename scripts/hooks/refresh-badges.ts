/**
 * Hook command for Agent Stop: rewrites the Soulprint lines in README.md
 * between <!-- soulprints:start --> and <!-- soulprints:end --> from each
 * package's soulprint.json, so the README never drifts from the hashes.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { listOssuary, pkgDir, repoRoot } from '../../packages/core/src/node/ossuary.ts';
import type { Soulprint } from '../../packages/core/src/types.ts';

const START = '<!-- soulprints:start -->';
const END = '<!-- soulprints:end -->';

export async function soulprintLines(): Promise<string> {
  const rows: string[] = [];
  for (const pkg of await listOssuary()) {
    const f = join(pkgDir(pkg), 'soulprint.json');
    if (!existsSync(f)) continue;
    const p = JSON.parse(await readFile(f, 'utf8')) as Soulprint;
    rows.push(`| ${pkg} ${p.version} | \`${p.sha256.slice(0, 4)}…${p.sha256.slice(-2)}\` | ${p.n.toLocaleString('en-US')} inputs per case, seed ${p.seed}, fast-check ${p.fastCheck} | matches original |`);
  }
  return ['| Package | Soulprint | Inputs | |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

async function main() {
  const readme = join(repoRoot, 'README.md');
  const text = await readFile(readme, 'utf8');
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a === -1 || b === -1) {
    console.log('README has no Soulprint markers; nothing to refresh.');
    return;
  }
  const next = `${text.slice(0, a + START.length)}\n${await soulprintLines()}\n${text.slice(b)}`;
  if (next !== text) {
    await writeFile(readme, next);
    console.log('Refreshed the Soulprints in README.md.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
