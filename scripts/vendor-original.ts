/**
 * npm run vendor -- <name>@<version> [--dep <name>@<version> ...]
 *
 * Downloads a package tarball from the npm registry, checks it against the
 * registry's dist.integrity, and unpacks it into ossuary/<pkg>/original/.
 * Runtime dependencies are vendored the same way into original/node_modules/.
 * Nothing from the tarball is ever executed.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';
import semver from 'semver';
import { ossuaryDir, readManifest, writeManifest } from './lib/ossuary.ts';

const REGISTRY = 'https://registry.npmjs.org';

interface VersionDoc {
  name: string;
  version: string;
  license?: string;
  author?: string | { name?: string };
  dependencies?: Record<string, string>;
  dist: { tarball: string; integrity: string };
}

function splitSpec(spec: string): { name: string; version: string } {
  const at = spec.lastIndexOf('@');
  if (at <= 0) throw new Error(`Expected <name>@<version>, got "${spec}"`);
  return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

async function resolveVersion(name: string, range: string): Promise<string> {
  const doc = await getJson<{ versions: Record<string, unknown>; 'dist-tags': Record<string, string> }>(
    `${REGISTRY}/${encodeURIComponent(name)}`,
  );
  const latest = doc['dist-tags'].latest;
  if (latest && semver.satisfies(latest, range)) return latest;
  const best = semver.maxSatisfying(Object.keys(doc.versions), range);
  if (!best) throw new Error(`No version of ${name} satisfies ${range}`);
  return best;
}

/** Minimal ustar reader: regular files only, which is all npm tarballs contain. */
function untar(buf: Buffer): { path: string; data: Buffer }[] {
  const out: { path: string; data: Buffer }[] = [];
  let off = 0;
  let longName: string | null = null;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const str = (a: number, b: number) => header.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    let name = str(0, 100);
    const prefix = str(345, 500);
    if (prefix) name = `${prefix}/${name}`;
    const size = parseInt(str(124, 136).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = off + 512;
    const data = buf.subarray(dataStart, dataStart + size);
    if (type === 'L') {
      longName = data.toString('utf8').replace(/\0.*$/s, '');
    } else {
      if (longName) {
        name = longName;
        longName = null;
      }
      if (type === '0' || type === '\0') out.push({ path: name, data: Buffer.from(data) });
    }
    off = dataStart + Math.ceil(size / 512) * 512;
  }
  return out;
}

function authorString(a: VersionDoc['author']): string {
  if (!a) return 'unknown';
  if (typeof a === 'string') return a.replace(/\s*<[^>]*>/, '').trim();
  return a.name ?? 'unknown';
}

async function vendorInto(name: string, version: string, dest: string): Promise<VersionDoc> {
  const doc = await getJson<VersionDoc>(`${REGISTRY}/${encodeURIComponent(name)}/${version}`);
  const res = await fetch(doc.dist.tarball);
  if (!res.ok) throw new Error(`${res.status} downloading ${doc.dist.tarball}`);
  const tgz = Buffer.from(await res.arrayBuffer());

  const [algo, expected] = doc.dist.integrity.split('-', 2) as [string, string];
  const actual = createHash(algo).update(tgz).digest('base64');
  if (actual !== expected) {
    throw new Error(`Integrity mismatch for ${name}@${version}: expected ${expected}, got ${actual}`);
  }

  if (existsSync(dest)) await rm(dest, { recursive: true });
  for (const entry of untar(gunzipSync(tgz))) {
    // npm tarballs put everything under one top folder, usually "package/".
    const rel = entry.path.split('/').slice(1).join('/');
    if (!rel) continue;
    const target = normalize(join(dest, rel));
    if (!target.startsWith(normalize(dest) + sep)) throw new Error(`Refusing path outside dest: ${entry.path}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, entry.data);
  }
  console.log(`vendored ${name}@${version} (${doc.dist.integrity.slice(0, 22)}…) -> ${dest}`);
  return doc;
}

async function main() {
  const args = process.argv.slice(2);
  const spec = args.find((a) => !a.startsWith('--'));
  if (!spec) throw new Error('Usage: npm run vendor -- <name>@<version> [--dep <name>@<version>]');
  const pins = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dep' && args[i + 1]) {
      const d = splitSpec(args[++i]!);
      pins.set(d.name, d.version);
    }
  }

  const { name, version } = splitSpec(spec);
  const root = ossuaryDir(name);
  const originalDir = join(root, 'original');
  const doc = await vendorInto(name, version, originalDir);

  for (const [dep, range] of Object.entries(doc.dependencies ?? {})) {
    const v = pins.get(dep) ?? (await resolveVersion(dep, range));
    await vendorInto(dep, v, join(originalDir, 'node_modules', dep));
  }

  const manifest = (await readManifest(name).catch(() => null)) ?? {
    name,
    version,
    integrity: '',
    license: '',
    author: '',
    cases: [],
    divergences: [],
  };
  manifest.name = name;
  manifest.version = version;
  manifest.integrity = doc.dist.integrity;
  manifest.license = doc.license ?? 'UNKNOWN';
  manifest.author = authorString(doc.author);
  await writeManifest(name, manifest);
  const pkgJson = JSON.parse(await readFile(join(originalDir, 'package.json'), 'utf8'));
  console.log(`main: ${pkgJson.main ?? 'index.js'}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
