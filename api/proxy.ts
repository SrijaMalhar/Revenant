/**
 * GET /api/proxy?host=<id>&path=<encoded path>
 *
 * The one serverless function. The browser never calls upstream hosts
 * directly: this adds CORS, caching and one place to rate-limit.
 * `host` is an allowlisted id, never a free URL, so it can't become an open
 * relay. Everything it reads is public, so there are no secrets here.
 */

export const HOSTS: Record<string, string> = {
  depsdev: 'api.deps.dev',
  npm: 'registry.npmjs.org',
  downloads: 'api.npmjs.org',
  ghraw: 'raw.githubusercontent.com',
};

/** deps.dev allows caching; npm responses change slowly enough for a day. */
const CACHE: Record<string, string> = {
  depsdev: 'public, max-age=86400',
  npm: 'public, max-age=86400',
  downloads: 'public, max-age=86400',
  ghraw: 'public, max-age=300',
};

function bad(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** Builds the upstream URL, or explains why it won't. Exported for tests. */
export function upstreamFor(hostId: string | null, path: string | null): URL | string {
  if (!hostId || !(hostId in HOSTS)) return `unknown host "${hostId ?? ''}"`;
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return 'path must start with a single "/"';
  if (path.length > 4096) return 'path is too long';
  const host = HOSTS[hostId]!;
  const url = new URL(path, `https://${host}`);
  // new URL() resolves "..", "@" and the like; make sure we're still on the allowlisted host.
  if (url.host !== host || url.protocol !== 'https:' || url.username || url.password) return 'path escapes its host';
  return url;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const hostId = params.get('host');
  const target = upstreamFor(hostId, params.get('path'));
  if (typeof target === 'string') return bad(400, target);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { accept: 'application/json', 'user-agent': 'revenant (+https://github.com/SrijaMalhar/revenant)' },
      signal: AbortSignal.timeout(9000),
    });
  } catch {
    return bad(504, `${target.host} did not answer in time`);
  }
  const body = await upstream.arrayBuffer();
  const headers = new Headers({
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
    'access-control-allow-origin': '*',
  });
  // Pass upstream status codes through; cache only successes.
  headers.set('cache-control', upstream.ok ? CACHE[hostId!]! : 'no-store');
  return new Response(body, { status: upstream.status, headers });
}

export default { fetch: GET };
