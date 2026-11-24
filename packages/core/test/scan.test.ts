import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scan, ScanError, deadCutoff, isDead } from '../src/graveyard/scan.ts';
import { parseScanInput, InputError } from '../src/graveyard/input.ts';
import { parseDepSpec, resolveRange } from '../src/graveyard/resolve.ts';
import { upstreamUrl } from '../src/graveyard/upstream.ts';
import type { GraveyardReport, ScanInput } from '../src/types.ts';
import { replayFetch, responsesFor, worldArb, type World } from './world.ts';

const NOW = new Date('2026-11-25T00:00:00Z');
const deps = (world: World, extra: Partial<Parameters<typeof scan>[1]> = {}) => ({
  fetch: replayFetch(responsesFor(world), world),
  now: () => NOW,
  sleep: async () => {},
  ...extra,
});

// A small linter-shaped tree, hand-built for the unit tests.
const linterWorld: World = {
  repos: {
    'demo/app': {
      name: 'demo-app',
      dependencies: { aliased: 'npm:@scope/real@^2.0.0' },
      devDependencies: { linter: '^10.0.0', local: 'file:../local', fromgit: 'github:a/b', nexttag: 'next' },
    },
  },
  packages: {
    linter: { versions: { '10.15.0': { publishedAt: '2026-10-01T00:00:00Z', deps: { optionator: '^0.9.0', 'natural-compare': '^1.4.0', 'uri-js': '^4.0.0' } } }, maintainers: 3, weeklyDownloads: 70_000_000 },
    optionator: { versions: { '0.9.4': { publishedAt: '2024-05-01T00:00:00Z', deps: { 'type-check': '^0.4.0', levn: '^0.4.1' } } } },
    levn: { versions: { '0.4.1': { publishedAt: '2020-04-04T00:00:00Z', deps: { 'type-check': '~0.4.0', 'prelude-ls': '^1.2.1' } } }, weeklyDownloads: 199_431_898 },
    'type-check': {
      versions: { '0.3.2': { publishedAt: '2015-01-01T00:00:00Z' }, '0.4.0': { publishedAt: '2020-04-03T00:00:00Z', deps: { 'prelude-ls': '^1.2.1' } } },
      weeklyDownloads: 199_418_512,
    },
    'prelude-ls': { versions: { '1.2.1': { publishedAt: '2020-04-02T00:00:00Z' } }, weeklyDownloads: 199_453_405 },
    'natural-compare': { versions: { '1.4.0': { publishedAt: '2016-07-22T00:00:00Z' } }, weeklyDownloads: 197_550_703 },
    'uri-js': { versions: { '4.4.1': { publishedAt: '2021-01-10T00:00:00Z', deprecated: 'use URL', advisories: ['GHSA-test-0001'], scripts: { postinstall: 'node x.js' } } }, weeklyDownloads: 50_000_000 },
    '@scope/real': { versions: { '2.1.0': { publishedAt: '2019-01-01T00:00:00Z' } }, maintainers: 2, weeklyDownloads: 12 },
  },
};

describe('parseScanInput', () => {
  it('accepts the documented forms', () => {
    const gh = { kind: 'github', owner: 'eslint', repo: 'eslint' };
    expect(parseScanInput('eslint/eslint')).toEqual(gh);
    expect(parseScanInput('https://github.com/eslint/eslint')).toEqual(gh);
    expect(parseScanInput('github.com/eslint/eslint.git')).toEqual(gh);
    expect(parseScanInput('https://github.com/eslint/eslint/')).toEqual(gh);
    expect(parseScanInput('https://github.com/a/b/tree/feature/x')).toEqual({ kind: 'github', owner: 'a', repo: 'b', ref: 'feature/x' });
    expect(parseScanInput(' {"dependencies": {}} ')).toEqual({ kind: 'manifest', packageJson: '{"dependencies": {}}' });
  });
  it('rejects the rest with a plain message', () => {
    for (const bad of ['', 'nope', 'a/b c', 'https://gitlab.com/a/b', '[1]', '{bad', 'a/b/blob/main/x', 'null']) {
      expect(() => parseScanInput(bad), bad).toThrow(InputError);
    }
  });
});

describe('parseDepSpec and resolveRange', () => {
  it('skips non-registry specs and resolves aliases', () => {
    expect(parseDepSpec('x', 'file:../x')).toEqual({ kind: 'skip', reason: 'file: dependency' });
    expect(parseDepSpec('x', 'workspace:*').kind).toBe('skip');
    expect(parseDepSpec('x', 'git+https://a/b.git').kind).toBe('skip');
    expect(parseDepSpec('x', 'user/repo')).toEqual({ kind: 'skip', reason: 'git dependency' });
    expect(parseDepSpec('x', 'next')).toEqual({ kind: 'skip', reason: 'dist-tag "next" is not resolved' });
    expect(parseDepSpec('x', 'latest')).toEqual({ kind: 'registry', name: 'x', range: '*' });
    expect(parseDepSpec('x', 'npm:@s/y@^2')).toEqual({ kind: 'registry', name: '@s/y', range: '^2', alias: 'x' });
  });
  it('prefers the default version when it satisfies the range', () => {
    expect(resolveRange(['1.0.0', '1.2.0', '2.0.0-beta.1'], '1.0.0', '^1.0.0')).toBe('1.0.0');
    expect(resolveRange(['1.0.0', '1.2.0'], '2.0.0', '^1.0.0')).toBe('1.2.0');
    expect(resolveRange(['1.0.0'], null, '^3.0.0')).toBeNull();
  });
});

describe('dead marking', () => {
  it('uses three calendar years in UTC, inclusive', () => {
    expect(new Date(deadCutoff(NOW)).toISOString()).toBe('2023-11-25T00:00:00.000Z');
    expect(isDead('2023-11-25T00:00:00Z', NOW)).toBe(true);
    expect(isDead('2023-11-25T00:00:00.001Z', NOW)).toBe(false);
    expect(isDead(null, NOW)).toBe(false);
  });
});

describe('scan on a linter-shaped tree', () => {
  it('builds the graveyard', async () => {
    const streamed: string[] = [];
    const report = await scan({ kind: 'github', owner: 'demo', repo: 'app' }, deps(linterWorld, { onNode: (n) => streamed.push(n.name) }));
    const byName = Object.fromEntries(report.nodes.map((n) => [n.name, n]));

    expect(report.root).toEqual({ name: 'demo-app', deps: 1, devDeps: 4 });
    expect(report.errors.map((e) => `${e.at}: ${e.message}`)).toEqual([
      'fromgit: skipped: git dependency',
      'local: skipped: file: dependency',
      'nexttag: skipped: dist-tag "next" is not resolved',
    ]);
    expect(report.nodes.filter((n) => n.dead).map((n) => n.name).sort()).toEqual(
      ['@scope/real', 'levn', 'natural-compare', 'prelude-ls', 'type-check', 'uri-js'].sort(),
    );
    expect(streamed.sort()).toEqual(report.nodes.filter((n) => n.dead).map((n) => n.name).sort());

    const tc = byName['type-check']!;
    expect(tc.version).toBe('0.4.0');
    expect(tc.dev).toBe(true);
    expect(tc.path).toEqual(['demo-app', 'linter@10.15.0', 'optionator@0.9.4', 'type-check@0.4.0']);
    expect(tc.depth).toBe(2);
    expect(tc.vitals.lastRelease).toBe('2020-04-03T00:00:00Z');
    expect(tc.vitals.firstRelease).toBe('2015-01-01T00:00:00Z');
    expect(tc.vitals.releasesByYear).toEqual([
      { year: 2015, count: 1 },
      { year: 2020, count: 1 },
    ]);
    expect(tc.vitals.maintainers).toBe(1);
    expect(tc.vitals.weeklyDownloads).toBe(199_418_512);

    const uri = byName['uri-js']!;
    expect(uri.vitals.deprecated).toBe('use URL');
    expect(uri.vitals.advisories).toEqual(['GHSA-test-0001']);
    expect(uri.vitals.installScripts).toBe(true);
    expect(uri.replacement).toEqual({ manifest: 'preferred', replacements: ['URL', 'uri-js-replace', 'fast-uri'] });

    // The npm: alias resolves the real package, as production.
    expect(byName['@scope/real']!.dev).toBe(false);
    expect(byName['@scope/real']!.path).toEqual(['demo-app', '@scope/real@2.1.0']);
    // Alive packages carry no dead-only details.
    expect(byName['linter']!.dead).toBe(false);
    expect(byName['linter']!.vitals.maintainers).toBeNull();
  });

  it('fails the scan only when the root manifest is missing', async () => {
    await expect(scan({ kind: 'github', owner: 'demo', repo: 'missing' }, deps({ ...linterWorld, failures: { [upstreamUrl('ghraw', '/demo/missing/HEAD/package.json')]: 404 } }))).rejects.toThrow(ScanError);
    await expect(scan({ kind: 'manifest', packageJson: '[]' }, deps(linterWorld))).rejects.toThrow(ScanError);
  });

  it('keeps going when one package fails, and marks it incomplete', async () => {
    const url = upstreamUrl('npm', '/natural-compare/1.4.0');
    const world = { ...linterWorld, failures: { [url]: 500 } };
    const report = await scan({ kind: 'github', owner: 'demo', repo: 'app' }, deps(world));
    const nc = report.nodes.find((n) => n.name === 'natural-compare')!;
    expect(nc.incomplete).toBe(true);
    expect(report.errors.some((e) => e.at === 'natural-compare@1.4.0')).toBe(true);
  });

  it('retries once after a 429', async () => {
    const responses = responsesFor(linterWorld);
    const url = upstreamUrl('depsdev', '/v3/systems/npm/packages/linter');
    let calls = 0;
    const base = replayFetch(responses, linterWorld);
    const flaky = (async (u: string) => {
      if (u === url && calls++ === 0) return { ok: false, status: 429, text: async () => '' };
      return base(u);
    }) as typeof base;
    const report = await scan({ kind: 'github', owner: 'demo', repo: 'app' }, { fetch: flaky, now: () => NOW, sleep: async () => {} });
    expect(calls).toBe(2);
    expect(report.nodes.some((n) => n.name === 'linter')).toBe(true);
  });

  it('stops at the node cap and says so', async () => {
    const report = await scan({ kind: 'github', owner: 'demo', repo: 'app' }, deps(linterWorld, { limits: { maxNodes: 3 } }));
    expect(report.truncated).toBe(true);
    expect(report.nodes.length).toBeLessThanOrEqual(3);
  });

  it('never has more than 12 requests in flight', async () => {
    let active = 0;
    let peak = 0;
    const base = replayFetch(responsesFor(linterWorld), linterWorld);
    const counting = (async (u: string) => {
      active++;
      peak = Math.max(peak, active);
      for (let i = 0; i < 5; i++) await Promise.resolve();
      try {
        return await base(u);
      } finally {
        active--;
      }
    }) as typeof base;
    await scan({ kind: 'github', owner: 'demo', repo: 'app' }, { fetch: counting, now: () => NOW, limits: { concurrency: 2 } });
    expect(peak).toBeLessThanOrEqual(2);
  });
});

// ---------- scanner properties ----------

const input: ScanInput = { kind: 'github', owner: 'o', repo: 'r' };

function reachable(report: GraveyardReport, world: World): boolean {
  // Every path starts at the root, and each step is a real dependency edge.
  return report.nodes.every((n) => {
    if (n.path[0] !== report.root.name || n.path.at(-1) !== `${n.name}@${n.version}`) return false;
    for (let i = 1; i < n.path.length - 1; i++) {
      const [from, to] = [n.path[i]!, n.path[i + 1]!];
      const fromName = from.slice(0, from.lastIndexOf('@'));
      const fromVersion = from.slice(from.lastIndexOf('@') + 1);
      const toName = to.slice(0, to.lastIndexOf('@'));
      if (!(toName in (world.packages[fromName]?.versions[fromVersion]?.deps ?? {}))) return false;
    }
    return true;
  });
}

describe('scanner properties', () => {
  it('the same input and upstream data always give an identical report, whatever order responses arrive in', async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, fc.func(fc.integer({ min: 0, max: 20 })), async ({ world }, jitter) => {
        const a = await scan(input, { fetch: replayFetch(responsesFor(world), world), now: () => NOW });
        const b = await scan(input, { fetch: replayFetch(responsesFor(world), world, { jitter: (u) => jitter(u) }), now: () => NOW });
        return JSON.stringify(a) === JSON.stringify(b);
      }),
      { numRuns: 60 },
    );
  });

  it('every package in the report is reachable from the root', async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, async ({ world }) => reachable(await scan(input, { fetch: replayFetch(responsesFor(world), world), now: () => NOW }), world)),
      { numRuns: 60 },
    );
  });

  it('no name@version appears twice', async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, async ({ world }) => {
        const r = await scan(input, { fetch: replayFetch(responsesFor(world), world), now: () => NOW });
        const keys = r.nodes.map((n) => `${n.name}@${n.version}`);
        return new Set(keys).size === keys.length;
      }),
      { numRuns: 60 },
    );
  });

  it('dead is true exactly when the last release is at least 3 years before the scan', async () => {
    await fc.assert(
      fc.asyncProperty(worldArb, async ({ world }) => {
        const r = await scan(input, { fetch: replayFetch(responsesFor(world), world), now: () => NOW });
        return r.nodes.every((n) => {
          const last = Math.max(...Object.values(world.packages[n.name]!.versions).map((v) => Date.parse(v.publishedAt)));
          return n.dead === last <= Date.UTC(2023, 10, 25);
        });
      }),
      { numRuns: 60 },
    );
  });
});

// ---------- recorded fixtures (npm run fixtures -- <owner/repo>) ----------

const fixturesDir = join(import.meta.dirname, 'fixtures');
const recorded = existsSync(fixturesDir) ? readdirSync(fixturesDir).filter((d) => existsSync(join(fixturesDir, d, 'responses.json'))) : [];

describe.skipIf(recorded.length === 0)('recorded fixtures', () => {
  for (const name of recorded) {
    it(`${name}: replays to the recorded report`, async () => {
      const dir = join(fixturesDir, name);
      const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as { input: ScanInput; scannedAt: string };
      const responses = JSON.parse(readFileSync(join(dir, 'responses.json'), 'utf8'));
      const expected = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
      const report = await scan(meta.input, { fetch: replayFetch(responses), now: () => new Date(meta.scannedAt) });
      expect(report).toEqual(expected);
    });
  }
});
