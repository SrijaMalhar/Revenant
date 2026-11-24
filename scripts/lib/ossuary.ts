import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OssuaryManifest } from '../../packages/core/src/types.ts';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ossuaryRoot = join(repoRoot, 'ossuary');
export const publicOssuary = join(repoRoot, 'apps', 'web', 'public', 'ossuary');

export function ossuaryDir(pkg: string): string {
  return join(ossuaryRoot, pkg.replace('/', '__'));
}

export async function listPackages(): Promise<string[]> {
  const entries = await readdir(ossuaryRoot, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && existsSync(join(ossuaryRoot, e.name, 'manifest.json')))
    .map((e) => e.name)
    .sort();
}

export async function readManifest(pkg: string): Promise<OssuaryManifest> {
  return JSON.parse(await readFile(join(ossuaryDir(pkg), 'manifest.json'), 'utf8')) as OssuaryManifest;
}

/** Stable key order so diffs stay small and CI's stale-bundle check is meaningful. */
const ORDER: (keyof OssuaryManifest)[] = [
  'name',
  'version',
  'integrity',
  'license',
  'author',
  'main',
  'cases',
  'divergences',
  'replay',
  'build',
  'soulprint',
  'possessions',
  'coverage',
  'redos',
  'mutation',
  'inputStats',
  'traceability',
  'delta',
  'referee',
];

export async function writeManifest(pkg: string, m: OssuaryManifest): Promise<void> {
  const ordered: Record<string, unknown> = {};
  for (const k of ORDER) if (m[k] !== undefined) ordered[k] = m[k];
  for (const [k, v] of Object.entries(m)) if (!(k in ordered) && v !== undefined) ordered[k] = v;
  const dir = ossuaryDir(pkg);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(ordered, null, 2) + '\n');
}

export async function updateManifest(pkg: string, patch: (m: OssuaryManifest) => void): Promise<OssuaryManifest> {
  const m = await readManifest(pkg);
  patch(m);
  await writeManifest(pkg, m);
  return m;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
