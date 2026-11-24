/** The four upstream hosts. The browser reaches them only through /api/proxy. */
export const HOSTS = {
  depsdev: 'api.deps.dev',
  npm: 'registry.npmjs.org',
  downloads: 'api.npmjs.org',
  ghraw: 'raw.githubusercontent.com',
} as const;
export type HostId = keyof typeof HOSTS;

export interface FetchLike {
  (url: string, init?: { signal?: AbortSignal }): Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
}

export function upstreamUrl(host: HostId, path: string, proxy?: string): string {
  if (proxy) return `${proxy}?host=${host}&path=${encodeURIComponent(path)}`;
  return `https://${HOSTS[host]}${path}`;
}

/** deps.dev wants names fully percent-encoded: @scope/name -> %40scope%2Fname. */
export const depsDevName = (name: string) => encodeURIComponent(name);
/** The npm registry keeps the @ and escapes only the slash: @scope%2Fname. */
export const npmName = (name: string) => (name.startsWith('@') ? '@' + encodeURIComponent(name.slice(1)) : encodeURIComponent(name));

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export interface Limits {
  concurrency: number;
  timeoutMs: number;
  retryDelayMs: number;
  maxNodes: number;
  budgetMs: number;
}

export const DEFAULT_LIMITS: Limits = {
  concurrency: 12,
  timeoutMs: 10_000,
  retryDelayMs: 500,
  maxNodes: 1500,
  budgetMs: 60_000,
};

/**
 * Upstream client: at most `concurrency` requests in flight, a timeout per
 * request, and one retry after a short wait on 429 or 5xx.
 */
export class Upstream {
  private active = 0;
  private queue: (() => void)[] = [];
  readonly cache = new Map<string, Promise<unknown>>();
  calls = 0;

  constructor(
    private readonly fetchFn: FetchLike,
    private readonly limits: Limits,
    private readonly proxy?: string,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  private async slot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limits.concurrency) await new Promise<void>((r) => this.queue.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }

  private async once(url: string): Promise<{ status: number; body: string }> {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), this.limits.timeoutMs) : undefined;
    try {
      this.calls++;
      const res = await this.fetchFn(url, ctrl ? { signal: ctrl.signal } : undefined);
      return { status: res.status, body: await res.text() };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** GET JSON, cached per URL for the life of one scan. Throws UpstreamError on a non-2xx. */
  json<T>(host: HostId, path: string): Promise<T> {
    const url = upstreamUrl(host, path, this.proxy);
    const hit = this.cache.get(url);
    if (hit) return hit as Promise<T>;
    const p = this.slot(async () => {
      let r = await this.once(url).catch((e) => ({ status: 0, body: String(e) }));
      if (r.status === 429 || r.status >= 500 || r.status === 0) {
        await this.sleep(this.limits.retryDelayMs);
        r = await this.once(url).catch((e) => ({ status: 0, body: String(e) }));
      }
      if (r.status < 200 || r.status >= 300) {
        throw new UpstreamError(r.status === 0 ? `${HOSTS[host]} did not answer` : `${HOSTS[host]} returned ${r.status}`, r.status);
      }
      try {
        return JSON.parse(r.body) as T;
      } catch {
        throw new UpstreamError(`${HOSTS[host]} returned something that is not JSON`, r.status);
      }
    });
    this.cache.set(url, p);
    return p;
  }
}
