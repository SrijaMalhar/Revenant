import { depsDevName, npmName, type Upstream } from './upstream.ts';

// ---------- deps.dev ----------

interface VersionKey {
  system?: string;
  name: string;
  version: string;
}

export interface DepsDevPackage {
  versions: { versionKey: VersionKey; publishedAt?: string; isDefault?: boolean; isDeprecated?: boolean }[];
}

export interface DepsDevGraph {
  nodes: { versionKey: VersionKey; relation?: string; bundled?: boolean; errors?: string[] }[];
  edges: { fromNode: number; toNode: number; requirement?: string }[];
  error?: string;
}

export interface DepsDevVersion {
  advisoryKeys?: { id: string }[];
  isDeprecated?: boolean;
  deprecatedReason?: string;
}

export interface PackageInfo {
  versions: string[];
  defaultVersion: string | null;
  lastRelease: string | null;
  firstRelease: string | null;
  releasesByYear: { year: number; count: number }[];
}

export async function getPackage(up: Upstream, name: string): Promise<PackageInfo> {
  const doc = await up.json<DepsDevPackage>('depsdev', `/v3/systems/npm/packages/${depsDevName(name)}`);
  return summarizePackage(doc);
}

export function summarizePackage(doc: DepsDevPackage): PackageInfo {
  const versions: string[] = [];
  let defaultVersion: string | null = null;
  let last: string | null = null;
  let first: string | null = null;
  const byYear = new Map<number, number>();
  for (const v of doc.versions ?? []) {
    versions.push(v.versionKey.version);
    if (v.isDefault) defaultVersion = v.versionKey.version;
    const at = v.publishedAt;
    if (!at || Number.isNaN(Date.parse(at))) continue;
    if (last === null || Date.parse(at) > Date.parse(last)) last = at;
    if (first === null || Date.parse(at) < Date.parse(first)) first = at;
    const year = new Date(at).getUTCFullYear();
    byYear.set(year, (byYear.get(year) ?? 0) + 1);
  }
  return {
    versions,
    defaultVersion,
    lastRelease: last,
    firstRelease: first,
    releasesByYear: [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count })),
  };
}

export function getGraph(up: Upstream, name: string, version: string): Promise<DepsDevGraph> {
  return up.json<DepsDevGraph>('depsdev', `/v3/systems/npm/packages/${depsDevName(name)}/versions/${encodeURIComponent(version)}:dependencies`);
}

export function getVersion(up: Upstream, name: string, version: string): Promise<DepsDevVersion> {
  return up.json<DepsDevVersion>('depsdev', `/v3/systems/npm/packages/${depsDevName(name)}/versions/${encodeURIComponent(version)}`);
}

// ---------- npm registry ----------

export interface NpmVersionDoc {
  scripts?: Record<string, string>;
  gypfile?: boolean;
  maintainers?: unknown[];
  deprecated?: string;
}

export function getNpmVersion(up: Upstream, name: string, version: string): Promise<NpmVersionDoc> {
  return up.json<NpmVersionDoc>('npm', `/${npmName(name)}/${encodeURIComponent(version)}`);
}

/** preinstall, install or postinstall, or a binding.gyp that npm would build. */
export function hasInstallScripts(doc: NpmVersionDoc): boolean {
  const s = doc.scripts ?? {};
  return Boolean(s.preinstall || s.install || s.postinstall || doc.gypfile === true);
}

// ---------- npm downloads ----------

type Point = { downloads: number; package: string };

/**
 * Weekly downloads. Unscoped names go in batches of up to 128; the bulk
 * endpoint doesn't take scoped names, so those go one at a time.
 */
export async function getWeeklyDownloads(up: Upstream, names: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const unscoped = names.filter((n) => !n.startsWith('@')).sort();
  const scoped = names.filter((n) => n.startsWith('@')).sort();
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < unscoped.length; i += 128) {
    const batch = unscoped.slice(i, i + 128);
    jobs.push(
      up
        .json<Point | Record<string, Point | null>>('downloads', `/downloads/point/last-week/${batch.join(',')}`)
        .then((doc) => {
          if (batch.length === 1) {
            const p = doc as Point;
            out.set(batch[0]!, typeof p.downloads === 'number' ? p.downloads : null);
          } else {
            const bulk = doc as Record<string, Point | null>;
            for (const n of batch) out.set(n, bulk[n]?.downloads ?? null);
          }
        })
        .catch(() => {
          for (const n of batch) out.set(n, null);
        }),
    );
  }
  for (const n of scoped) {
    jobs.push(
      up
        .json<Point>('downloads', `/downloads/point/last-week/${npmName(n)}`)
        .then((p) => void out.set(n, typeof p.downloads === 'number' ? p.downloads : null))
        .catch(() => void out.set(n, null)),
    );
  }
  await Promise.all(jobs);
  return out;
}

/** Last year of daily downloads summed by week, for the flatline drawer. */
export async function getYearOfDownloads(up: Upstream, name: string): Promise<{ week: string; downloads: number }[]> {
  const doc = await up.json<{ downloads: { day: string; downloads: number }[] }>('downloads', `/downloads/range/last-year/${npmName(name)}`);
  const weeks: { week: string; downloads: number }[] = [];
  const days = doc.downloads ?? [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    weeks.push({ week: chunk[0]!.day, downloads: chunk.reduce((a, d) => a + d.downloads, 0) });
  }
  return weeks;
}

// ---------- GitHub ----------

export function rawManifestPath(owner: string, repo: string, ref?: string): string {
  const r = ref ? ref.split('/').map(encodeURIComponent).join('/') : 'HEAD';
  return `/${owner}/${repo}/${r}/package.json`;
}
