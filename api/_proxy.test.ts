import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, upstreamFor } from './proxy.ts';

describe('proxy allowlist', () => {
  it('maps ids to hosts and keeps the path', () => {
    expect(String(upstreamFor('depsdev', '/v3/systems/npm/packages/%40s%2Fx'))).toBe('https://api.deps.dev/v3/systems/npm/packages/%40s%2Fx');
    expect(String(upstreamFor('ghraw', '/a/b/HEAD/package.json'))).toBe('https://raw.githubusercontent.com/a/b/HEAD/package.json');
  });
  it('refuses anything that could reach another host', () => {
    for (const [host, path] of [
      ['evil', '/x'],
      [null, '/x'],
      ['npm', 'x'],
      ['npm', '//evil.com/x'],
      ['npm', '/\\evil.com'],
      ['npm', 'https://evil.com/'],
      ['npm', null],
    ] as const) {
      expect(typeof upstreamFor(host, path), `${host} ${path}`).toBe('string');
    }
  });
});

describe('GET', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('returns 400 for an unknown host without calling out', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const r = await GET(new Request('http://x/api/proxy?host=nope&path=/a'));
    expect(r.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it('passes the status through and caches only successes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"a":1}', { status: 200 })));
    const ok = await GET(new Request('http://x/api/proxy?host=npm&path=%2Fleft-pad'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('public, max-age=86400');
    expect(await ok.text()).toBe('{"a":1}');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const missing = await GET(new Request('http://x/api/proxy?host=npm&path=%2Fnope'));
    expect(missing.status).toBe(404);
    expect(missing.headers.get('cache-control')).toBe('no-store');
  });
});
