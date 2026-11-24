// Node-only helpers for loading Ossuary packages. The browser never imports
// this file; it loads the esbuild bundles from public/ossuary instead.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Case, OssuaryManifest } from '../types.ts';
import { decanonical, type Canonical } from '../soul/canonical.ts';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const ossuaryRoot = join(repoRoot, 'ossuary');

export function pkgDir(pkg: string): string {
  return join(ossuaryRoot, pkg);
}

export async function listOssuary(): Promise<string[]> {
  const entries = await readdir(ossuaryRoot, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && existsSync(join(ossuaryRoot, e.name, 'cases.ts')))
    .map((e) => e.name)
    .sort();
}

export async function readManifest(pkg: string): Promise<OssuaryManifest> {
  return JSON.parse(await readFile(join(pkgDir(pkg), 'manifest.json'), 'utf8')) as OssuaryManifest;
}

/** Entry file of the original, relative to original/. */
export async function originalMain(pkg: string): Promise<string> {
  const m = await readManifest(pkg);
  if (m.main) return m.main;
  const pj = JSON.parse(await readFile(join(pkgDir(pkg), 'original', 'package.json'), 'utf8'));
  return pj.main ?? 'index.js';
}

export async function loadOriginal(pkg: string): Promise<unknown> {
  const dir = join(pkgDir(pkg), 'original');
  const req = createRequire(join(dir, 'package.json'));
  return req(join(dir, await originalMain(pkg)));
}

async function importDefault(file: string): Promise<unknown> {
  const mod = (await import(pathToFileURL(file).href)) as { default?: unknown };
  return mod.default ?? mod;
}

export async function loadRevived(pkg: string): Promise<unknown> {
  return importDefault(join(pkgDir(pkg), 'revived', 'src', 'index.ts'));
}

/** The recorded failing draft the séance replay runs against. */
export async function loadReplay(pkg: string): Promise<unknown> {
  const m = await readManifest(pkg);
  if (!m.replay) throw new Error(`${pkg} has no recorded draft to replay`);
  return importDefault(join(pkgDir(pkg), m.replay.draft));
}

export interface Possession {
  id: string;
  title: string;
  find: string;
  replace: string;
  /** why it might survive: an equivalent change, or a known generator gap */
  note?: string;
}

export async function readPossessions(pkg: string): Promise<Possession[]> {
  const file = join(pkgDir(pkg), 'possessions.json');
  if (!existsSync(file)) return [];
  return JSON.parse(await readFile(file, 'utf8')) as Possession[];
}

/** Applies one planted bug to the revived source. Fails unless `find` matches exactly once. */
export function possess(source: string, p: Possession): string {
  const first = source.indexOf(p.find);
  if (first === -1) throw new Error(`possession ${p.id}: "find" text not found`);
  if (source.indexOf(p.find, first + 1) !== -1) throw new Error(`possession ${p.id}: "find" text matches more than once`);
  return source.slice(0, first) + p.replace + source.slice(first + p.find.length);
}

/** Writes the possessed source next to the revived one (so relative imports still work) and loads it. */
export async function loadPossessed(pkg: string, id: string): Promise<unknown> {
  const p = (await readPossessions(pkg)).find((x) => x.id === id);
  if (!p) throw new Error(`${pkg} has no possession "${id}"`);
  const srcDir = join(pkgDir(pkg), 'revived', 'src');
  const source = await readFile(join(srcDir, 'index.ts'), 'utf8');
  const outDir = join(repoRoot, 'node_modules', '.revenant', 'possessed', pkg);
  await mkdir(outDir, { recursive: true });
  const file = join(outDir, `${id}.ts`);
  await writeFile(file, possess(source, p));
  return importDefault(file);
}

export async function loadCases(pkg: string): Promise<Case<any>[]> {
  return (await importDefault(join(pkgDir(pkg), 'cases.ts'))) as Case<any>[];
}

export type Target = 'original' | 'revived' | 'replay' | `possessed:${string}`;

export async function loadTarget(pkg: string, target: Target): Promise<unknown> {
  if (target === 'original') return loadOriginal(pkg);
  if (target === 'revived') return loadRevived(pkg);
  if (target === 'replay') return loadReplay(pkg);
  return loadPossessed(pkg, target.slice('possessed:'.length));
}

/**
 * Applies the manifest's build defines to the Node runtime for the length of
 * a run, so Node and the browser bundles see the same environment.
 * Today that's only process.cwd for path-browserify.
 */
export async function withBuildEnv<T>(pkg: string, fn: () => Promise<T> | T): Promise<T> {
  const m = await readManifest(pkg);
  const define = m.build?.define ?? {};
  const realCwd = process.cwd;
  if ('process.cwd' in define) {
    const value = JSON.parse(define['process.cwd']!.replace(/^\(\)\s*=>\s*/, ''));
    process.cwd = () => value;
  }
  try {
    return await fn();
  } finally {
    process.cwd = realCwd;
  }
}

/** Counterexamples caught earlier, from drafts/*.json, as a regression corpus per case. */
export async function loadRegressionCorpus(pkg: string): Promise<Record<string, unknown[]>> {
  const dir = join(pkgDir(pkg), 'drafts');
  const out: Record<string, unknown[]> = {};
  if (!existsSync(dir)) return out;
  for (const f of (await readdir(dir)).filter((x) => x.endsWith('.json')).sort()) {
    const d = JSON.parse(await readFile(join(dir, f), 'utf8')) as { caseName: string; input: Canonical };
    (out[d.caseName] ??= []).push(decanonical(d.input));
  }
  return out;
}
