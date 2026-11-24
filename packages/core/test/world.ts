// A synthetic upstream world for scanner tests: hand-built package data,
// served the way deps.dev, the npm registry, the downloads API and GitHub
// serve it. These are test inputs, not measurements; recorded responses from
// the real services go in test/fixtures/<case>/ (npm run fixtures).
import fc from 'fast-check';
import semver from 'semver';
import { upstreamUrl } from '../src/graveyard/upstream.ts';
import type { FetchLike } from '../src/graveyard/upstream.ts';

export interface WorldVersion {
  publishedAt: string;
  deps?: Record<string, string>; // name -> range
  deprecated?: string;
  advisories?: string[];
  scripts?: Record<string, string>;
  gypfile?: boolean;
}
export interface WorldPackage {
  versions: Record<string, WorldVersion>;
  defaultVersion?: string;
  maintainers?: number;
  weeklyDownloads?: number;
}
export interface World {
  packages: Record<string, WorldPackage>;
  repos?: Record<string, unknown>; // "owner/repo" -> package.json
  /** URLs that answer with an error status */
  failures?: Record<string, number>;
}

export type Responses = Record<string, { status: number; body: string }>;

function defaultOf(p: WorldPackage): string {
  return p.defaultVersion ?? semver.rsort(Object.keys(p.versions))[0]!;
}

function resolveIn(world: World, name: string, range: string): string | null {
  const p = world.packages[name];
  if (!p) return null;
  const d = defaultOf(p);
  if (semver.satisfies(d, range)) return d;
  return semver.maxSatisfying(Object.keys(p.versions), range);
}

/** deps.dev-style resolved graph: breadth-first closure, one version per name. */
function graphOf(world: World, name: string, version: string) {
  const nodes: { versionKey: { system: string; name: string; version: string }; relation: string; bundled: boolean; errors: string[] }[] = [];
  const edges: { fromNode: number; toNode: number; requirement: string }[] = [];
  const index = new Map<string, number>();
  const add = (n: string, v: string, relation: string) => {
    const k = `${n}@${v}`;
    if (index.has(k)) return index.get(k)!;
    index.set(k, nodes.length);
    nodes.push({ versionKey: { system: 'NPM', name: n, version: v }, relation, bundled: false, errors: [] });
    return nodes.length - 1;
  };
  const queue: [string, string][] = [[name, version]];
  add(name, version, 'SELF');
  const seen = new Set<string>();
  while (queue.length) {
    const [n, v] = queue.shift()!;
    if (seen.has(`${n}@${v}`)) continue;
    seen.add(`${n}@${v}`);
    const from = index.get(`${n}@${v}`)!;
    for (const [dep, range] of Object.entries(world.packages[n]?.versions[v]?.deps ?? {}).sort()) {
      const dv = resolveIn(world, dep, range);
      if (!dv) {
        nodes[from]!.errors.push(`could not resolve ${dep}@${range}`);
        continue;
      }
      const to = add(dep, dv, from === 0 ? 'DIRECT' : 'INDIRECT');
      edges.push({ fromNode: from, toNode: to, requirement: range });
      queue.push([dep, dv]);
    }
  }
  return { nodes, edges, error: '' };
}

export function responsesFor(world: World): Responses {
  const r: Responses = {};
  const ok = (url: string, body: unknown) => (r[url] = { status: 200, body: JSON.stringify(body) });
  for (const [repo, pkg] of Object.entries(world.repos ?? {})) {
    const [owner, name] = repo.split('/');
    ok(upstreamUrl('ghraw', `/${owner}/${name}/HEAD/package.json`), pkg);
  }
  for (const [name, p] of Object.entries(world.packages)) {
    const dn = encodeURIComponent(name);
    const nn = name.startsWith('@') ? '@' + encodeURIComponent(name.slice(1)) : encodeURIComponent(name);
    const def = defaultOf(p);
    ok(upstreamUrl('depsdev', `/v3/systems/npm/packages/${dn}`), {
      packageKey: { system: 'NPM', name },
      versions: Object.entries(p.versions).map(([v, info]) => ({
        versionKey: { system: 'NPM', name, version: v },
        publishedAt: info.publishedAt,
        isDefault: v === def,
      })),
    });
    for (const [v, info] of Object.entries(p.versions)) {
      ok(upstreamUrl('depsdev', `/v3/systems/npm/packages/${dn}/versions/${encodeURIComponent(v)}:dependencies`), graphOf(world, name, v));
      ok(upstreamUrl('depsdev', `/v3/systems/npm/packages/${dn}/versions/${encodeURIComponent(v)}`), {
        versionKey: { system: 'NPM', name, version: v },
        isDeprecated: Boolean(info.deprecated),
        ...(info.deprecated ? { deprecatedReason: info.deprecated } : {}),
        advisoryKeys: (info.advisories ?? []).map((id) => ({ id })),
      });
    }
    ok(upstreamUrl('npm', `/${nn}`), {
      name,
      maintainers: Array.from({ length: p.maintainers ?? 1 }, (_, i) => ({ name: `m${i}` })),
      versions: Object.fromEntries(
        Object.entries(p.versions).map(([v, info]) => [
          v,
          { name, version: v, ...(info.scripts ? { scripts: info.scripts } : {}), ...(info.gypfile ? { gypfile: true } : {}) },
        ]),
      ),
    });
  }
  // Downloads: one URL per name and per sorted batch the scanner might ask for
  // is impossible to enumerate up front, so the fetch below answers batches.
  for (const [url, status] of Object.entries(world.failures ?? {})) r[url] = { status, body: '{}' };
  return r;
}

/** A fetch that replays responses and fails loudly on anything unrecorded. */
export function replayFetch(responses: Responses, world?: World, opts: { jitter?: (url: string) => number } = {}): FetchLike & { urls: string[] } {
  const urls: string[] = [];
  const f = (async (url: string) => {
    urls.push(url);
    const delay = opts.jitter?.(url) ?? 0;
    for (let i = 0; i < delay; i++) await Promise.resolve();
    let hit: { status: number; body: string } | undefined = responses[url];
    if (!hit && world) hit = downloadsAnswer(world, url) ?? undefined;
    if (!hit) throw new Error(`unrecorded URL: ${url}`);
    const { status, body } = hit;
    return { ok: status >= 200 && status < 300, status, text: async () => body };
  }) as FetchLike & { urls: string[] };
  f.urls = urls;
  return f;
}

function downloadsAnswer(world: World, url: string): { status: number; body: string } | null {
  const prefix = upstreamUrl('downloads', '/downloads/point/last-week/');
  if (!url.startsWith(prefix)) return null;
  const names = url.slice(prefix.length).split(',').map((n) => decodeURIComponent(n));
  const point = (n: string) => ({ downloads: world.packages[n]?.weeklyDownloads ?? 0, package: n, start: '2026-11-17', end: '2026-11-23' });
  if (names.length === 1) return { status: 200, body: JSON.stringify(point(names[0]!)) };
  return { status: 200, body: JSON.stringify(Object.fromEntries(names.map((n) => [n, point(n)]))) };
}

// ---------- random worlds for property tests ----------

const NAMES = ['alpha', 'beta', 'gamma', 'delta', 'eps', 'zeta', 'eta', 'theta', '@s/iota', '@s/kappa'];
const VERSIONS = ['1.0.0', '1.1.0', '2.0.0'];

const isoBetween = (min: string, max: string) =>
  fc.date({ min: new Date(min), max: new Date(max), noInvalidDate: true }).map((d) => d.toISOString());

export const worldArb: fc.Arbitrary<{ world: World; repo: string }> = fc
  .tuple(
    fc.uniqueArray(fc.constantFrom(...NAMES), { minLength: 1, maxLength: NAMES.length }),
    fc.infiniteStream(fc.tuple(fc.integer({ min: 1, max: 3 }), isoBetween('2012-01-01', '2026-11-01'), fc.nat(), fc.nat(), fc.integer({ min: 0, max: 1e9 }))),
    fc.array(fc.tuple(fc.nat(), fc.nat(), fc.constantFrom('^1.0.0', '^2.0.0', '*', '1.0.0')), { maxLength: 20 }),
    fc.array(fc.tuple(fc.nat(), fc.boolean(), fc.constantFrom('^1.0.0', '*', 'latest', '^2.0.0')), { minLength: 1, maxLength: 5 }),
  )
  .map(([names, stream, edges, rootDeps]) => {
    const packages: Record<string, WorldPackage> = {};
    const it = stream[Symbol.iterator]();
    for (const n of names) {
      const [count, last, adv, scripts, dl] = it.next().value!;
      const versions: Record<string, WorldVersion> = {};
      VERSIONS.slice(0, count).forEach((v, i) => {
        const t = new Date(Date.parse(last) - (count - 1 - i) * 90 * 86_400_000).toISOString();
        versions[v] = { publishedAt: t, ...(adv % 4 === 0 ? { advisories: [`GHSA-${n}-${v}`] } : {}), ...(scripts % 5 === 0 ? { scripts: { postinstall: 'node x' } } : {}) };
      });
      packages[n] = { versions, maintainers: (adv % 3) + 1, weeklyDownloads: dl };
    }
    for (const [a, b, range] of edges) {
      const from = names[a % names.length]!;
      const to = names[b % names.length]!;
      if (from === to) continue;
      for (const v of Object.values(packages[from]!.versions)) (v.deps ??= {})[to] = range;
    }
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {};
    for (const [i, dev, range] of rootDeps) (dev ? devDependencies : dependencies)[names[i % names.length]!] = range;
    return { world: { packages, repos: { 'o/r': { name: 'root', dependencies, devDependencies } } }, repo: 'o/r' };
  });
