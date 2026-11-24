import type { GraveNode, GraveyardReport, ScanInput, Vitals } from '../types.ts';
import { lookupReplacement } from '../e18e/lookup.ts';
import { parseDepSpec, resolveRange } from './resolve.ts';
import {
  getGraph,
  getNpmVersion,
  getPackage,
  getVersion,
  getWeeklyDownloads,
  hasInstallScripts,
  rawManifestPath,
  type PackageInfo,
} from './sources.ts';
import { DEFAULT_LIMITS, Upstream, UpstreamError, type FetchLike, type Limits } from './upstream.ts';

export interface ScanDeps {
  fetch: FetchLike;
  now: () => Date;
  /** called with each dead node as soon as its details are in */
  onNode?: (node: GraveNode) => void;
  /** packages checked so far, for the "scanning" state */
  onProgress?: (checked: number, total: number) => void;
  /** e.g. "/api/proxy"; without it, upstream hosts are called directly (Node) */
  proxy?: string;
  limits?: Partial<Limits>;
  sleep?: (ms: number) => Promise<void>;
}

/** Thrown only when the root manifest is missing or invalid; nothing else fails a scan. */
export class ScanError extends Error {
  override name = 'ScanError';
}

const key = (name: string, version: string) => `${name}@${version}`;
const byKey = (a: { name: string; version: string }, b: { name: string; version: string }) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : a.version < b.version ? -1 : a.version > b.version ? 1 : 0;

/** lastRelease at or before scannedAt minus 3 calendar years (UTC). */
export function deadCutoff(scannedAt: Date): number {
  return Date.UTC(
    scannedAt.getUTCFullYear() - 3,
    scannedAt.getUTCMonth(),
    scannedAt.getUTCDate(),
    scannedAt.getUTCHours(),
    scannedAt.getUTCMinutes(),
    scannedAt.getUTCSeconds(),
    scannedAt.getUTCMilliseconds(),
  );
}

export function isDead(lastRelease: string | null, scannedAt: Date): boolean {
  return lastRelease !== null && Date.parse(lastRelease) <= deadCutoff(scannedAt);
}

interface Direct {
  name: string;
  range: string;
  dev: boolean;
}

function readDirect(pkg: Record<string, unknown>, errors: GraveyardReport['errors']): Direct[] {
  const out = new Map<string, Direct>();
  for (const [field, dev] of [
    ['dependencies', false],
    ['devDependencies', true],
  ] as const) {
    const deps = pkg[field];
    if (deps === undefined) continue;
    if (deps === null || typeof deps !== 'object' || Array.isArray(deps)) {
      errors.push({ at: field, message: `${field} is not an object` });
      continue;
    }
    for (const [name, spec] of Object.entries(deps as Record<string, unknown>)) {
      const parsed = parseDepSpec(name, spec);
      if (parsed.kind === 'skip') {
        errors.push({ at: name, message: `skipped: ${parsed.reason}` });
        continue;
      }
      const existing = out.get(parsed.name);
      // In both lists: production wins.
      if (!existing || (existing.dev && !dev)) out.set(parsed.name, { name: parsed.name, range: parsed.range, dev });
    }
  }
  return [...out.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function scan(input: ScanInput, deps: ScanDeps): Promise<GraveyardReport> {
  const limits: Limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const up = new Upstream(deps.fetch, limits, deps.proxy, deps.sleep);
  const started = deps.now();
  const scannedAt = started.toISOString();
  const overBudget = () => deps.now().getTime() - started.getTime() > limits.budgetMs;
  const errors: GraveyardReport['errors'] = [];
  let truncated = false;

  // 1. Root manifest. This is the only thing that can fail the whole scan.
  let pkg: Record<string, unknown>;
  let rootName: string;
  if (input.kind === 'github') {
    try {
      pkg = await up.json<Record<string, unknown>>('ghraw', rawManifestPath(input.owner, input.repo, input.ref));
    } catch (e) {
      if (e instanceof UpstreamError && e.status === 404) {
        throw new ScanError(`No package.json at the root of ${input.owner}/${input.repo}${input.ref ? ` (${input.ref})` : ''}. The repo may be private, or not an npm project.`);
      }
      throw new ScanError(`Couldn't read package.json from GitHub: ${message(e)}`);
    }
    if (pkg === null || typeof pkg !== 'object' || Array.isArray(pkg)) throw new ScanError('package.json does not have an object at the top.');
    rootName = typeof pkg.name === 'string' && pkg.name ? pkg.name : `${input.owner}/${input.repo}`;
  } else {
    try {
      pkg = JSON.parse(input.packageJson);
    } catch {
      throw new ScanError('The pasted package.json does not parse.');
    }
    if (pkg === null || typeof pkg !== 'object' || Array.isArray(pkg)) throw new ScanError('A package.json must have an object at the top.');
    rootName = typeof pkg.name === 'string' && pkg.name ? pkg.name : 'your-project';
  }

  // 2. Direct dependencies.
  const direct = readDirect(pkg, errors);
  const countOf = (f: string) => {
    const v = pkg[f];
    return v && typeof v === 'object' ? Object.keys(v).length : 0;
  };

  // Package-level data (versions, publish dates), fetched once per name.
  const infos = new Map<string, Promise<PackageInfo | null>>();
  const info = (name: string) => {
    let p = infos.get(name);
    if (!p) {
      p = getPackage(up, name).catch((e) => {
        errors.push({ at: name, message: `couldn't read versions: ${message(e)}` });
        return null;
      });
      infos.set(name, p);
    }
    return p;
  };

  // 3. Resolve each direct range the way npm does.
  const roots: { key: string; dev: boolean }[] = [];
  await Promise.all(
    direct.map(async (d) => {
      const i = await info(d.name);
      if (!i) return;
      const version = resolveRange(i.versions, i.defaultVersion, d.range);
      if (!version) {
        errors.push({ at: d.name, message: `no version satisfies ${d.range}` });
        return;
      }
      roots.push({ key: key(d.name, version), dev: d.dev });
    }),
  );
  roots.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  // 4. Fetch each direct dependency's resolved graph and merge them.
  const ids = new Map<string, { name: string; version: string }>();
  const children = new Map<string, Set<string>>();
  const link = (from: string, to: string) => {
    let s = children.get(from);
    if (!s) children.set(from, (s = new Set()));
    s.add(to);
  };
  await Promise.all(
    roots.map(async (r) => {
      const [name, version] = splitKey(r.key);
      ids.set(r.key, { name, version });
      try {
        const g = await getGraph(up, name, version);
        if (g.error) errors.push({ at: r.key, message: `deps.dev: ${g.error}` });
        const keys = g.nodes.map((n) => {
          const k = key(n.versionKey.name, n.versionKey.version);
          ids.set(k, { name: n.versionKey.name, version: n.versionKey.version });
          for (const err of n.errors ?? []) errors.push({ at: k, message: `deps.dev: ${err}` });
          return k;
        });
        for (const e of g.edges) {
          const from = keys[e.fromNode];
          const to = keys[e.toNode];
          if (from && to) link(from, to);
        }
      } catch (e) {
        errors.push({ at: r.key, message: `couldn't read its dependency graph: ${message(e)}` });
      }
    }),
  );

  // Breadth-first from the production roots first, then the dev roots, in
  // name order, so every path is a shortest one and the result never depends
  // on response order. A node is dev when no production path reaches it.
  const paths = new Map<string, { path: string[]; dev: boolean }>();
  const walk = (starts: string[], dev: boolean) => {
    const queue: string[] = [];
    for (const s of starts) {
      if (paths.has(s)) continue;
      if (paths.size >= limits.maxNodes) {
        truncated = true;
        return;
      }
      paths.set(s, { path: [rootName, s], dev });
      queue.push(s);
    }
    for (let qi = 0; qi < queue.length; qi++) {
      const at = queue[qi]!;
      const next = [...(children.get(at) ?? [])].sort((a, b) => byKey(ids.get(a)!, ids.get(b)!));
      for (const c of next) {
        if (paths.has(c)) continue;
        if (paths.size >= limits.maxNodes) {
          truncated = true;
          return;
        }
        paths.set(c, { path: [...paths.get(at)!.path, c], dev });
        queue.push(c);
      }
    }
  };
  walk(roots.filter((r) => !r.dev).map((r) => r.key), false);
  walk(roots.filter((r) => r.dev).map((r) => r.key), true);

  // 5. Mark dead from the package call alone.
  const keys = [...paths.keys()];
  const total = new Set(keys.map((k) => ids.get(k)!.name)).size;
  let checked = 0;
  const nodes = new Map<string, GraveNode>();
  const dead: GraveNode[] = [];
  await Promise.all(
    [...new Set(keys.map((k) => ids.get(k)!.name))].map(async (name) => {
      if (overBudget()) {
        truncated = true;
        return;
      }
      const i = await info(name);
      deps.onProgress?.(++checked, total);
      if (!i) return;
      for (const k of keys) {
        const id = ids.get(k)!;
        if (id.name !== name) continue;
        const p = paths.get(k)!;
        const vitals: Vitals = {
          latestVersion: i.defaultVersion ?? id.version,
          lastRelease: i.lastRelease ?? '',
          maintainers: null,
          deprecated: null,
          installScripts: false,
          weeklyDownloads: null,
          advisories: [],
          ...(i.firstRelease ? { firstRelease: i.firstRelease } : {}),
          releasesByYear: i.releasesByYear,
        };
        const node: GraveNode = {
          name: id.name,
          version: id.version,
          depth: p.path.length - 2,
          path: p.path,
          dev: p.dev,
          vitals,
          dead: isDead(i.lastRelease, started),
          replacement: lookupReplacement(id.name),
        };
        nodes.set(k, node);
        if (node.dead) dead.push(node);
      }
    }),
  );

  // 6. Details for dead packages only: advisories, deprecation, scripts,
  //    maintainer count and downloads.
  dead.sort(byKey);
  const downloads = getWeeklyDownloads(up, [...new Set(dead.map((d) => d.name))]);
  await Promise.all(
    dead.map(async (node) => {
      if (overBudget()) {
        truncated = true;
        return;
      }
      const at = key(node.name, node.version);
      const [ver, doc, dl] = await Promise.all([
        getVersion(up, node.name, node.version).catch((e) => {
          errors.push({ at, message: `couldn't read advisories: ${message(e)}` });
          node.incomplete = true;
          return null;
        }),
        getNpmVersion(up, node.name, node.version).catch((e) => {
          errors.push({ at, message: `couldn't read the npm registry: ${message(e)}` });
          node.incomplete = true;
          return null;
        }),
        downloads,
      ]);
      if (ver) {
        node.vitals.advisories = [...new Set((ver.advisoryKeys ?? []).map((a) => a.id))].sort();
        if (ver.isDeprecated) node.vitals.deprecated = ver.deprecatedReason || 'deprecated';
      }
      if (doc) {
        node.vitals.installScripts = hasInstallScripts(doc);
        // Counts only, never names or emails.
        node.vitals.maintainers = Array.isArray(doc.maintainers) ? doc.maintainers.length : null;
        if (!node.vitals.deprecated && typeof doc.deprecated === 'string' && doc.deprecated) node.vitals.deprecated = doc.deprecated;
      }
      node.vitals.weeklyDownloads = dl.get(node.name) ?? null;
      if (node.vitals.weeklyDownloads === null) node.incomplete = true;
      deps.onNode?.(node);
    }),
  );

  errors.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.message < b.message ? -1 : a.message > b.message ? 1 : 0));
  return {
    input,
    scannedAt,
    root: { name: rootName, deps: countOf('dependencies'), devDeps: countOf('devDependencies') },
    nodes: [...nodes.values()].sort(byKey),
    errors,
    truncated,
    source: 'live',
  };
}

function splitKey(k: string): [string, string] {
  const at = k.lastIndexOf('@');
  return [k.slice(0, at), k.slice(at + 1)];
}
