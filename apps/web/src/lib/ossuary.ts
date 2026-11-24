import type { OssuaryManifest, Soulprint } from '@revenant/core/types';

export interface OssuaryEntry {
  name: string;
  version: string;
  possessions: number;
  replay: boolean;
}

export interface ExorcismTiming {
  advisory: { id: string; cve: string; url: string };
  input: string;
  measuredAt: string;
  runtime: string;
  cpu: string;
  method: string;
  points: { n: number; originalMs: number; revivedMs: number }[];
}

const cache = new Map<string, Promise<unknown>>();
function get<T>(url: string, kind: 'json' | 'text' = 'json'): Promise<T> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} for ${url}`);
      return kind === 'json' ? r.json() : r.text();
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p as Promise<T>;
}
const maybe = <T>(p: Promise<T>) => p.catch(() => null);

export const ossuaryIndex = () => get<OssuaryEntry[]>('/ossuary/index.json');
export const manifest = (pkg: string) => get<OssuaryManifest>(`/ossuary/${pkg}/manifest.json`);
export const soulprint = (pkg: string) => maybe(get<Soulprint>(`/ossuary/${pkg}/soulprint.json`));
export const exorcism = (pkg: string) => maybe(get<ExorcismTiming>(`/ossuary/${pkg}/exorcism.json`));
export const revivedSource = (pkg: string) => get<string>(`/ossuary/${pkg}/revived-source.ts`, 'text');
export const requirements = (pkg: string) => maybe(get<string>(`/ossuary/${pkg}/requirements.md`, 'text').then((t) => (t.trimStart().startsWith('<!') ? Promise.reject(new Error('not found')) : t)));
