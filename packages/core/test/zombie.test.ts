import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { zombieIndex, rankDead } from '../src/zombie/score.ts';
import type { GraveNode } from '../src/types.ts';

const scannedAt = '2026-11-25T00:00:00.000Z';
const ossuary = [
  { name: 'type-check', version: '0.4.0' },
  { name: 'path-browserify', version: '1.0.1' },
  { name: 'timespan', version: '2.3.0' },
];

function node(name: string, over: Partial<GraveNode['vitals']> = {}, version = '1.0.0', replacement: GraveNode['replacement'] = null): GraveNode {
  return {
    name,
    version,
    depth: 0,
    path: ['root', `${name}@${version}`],
    dev: false,
    dead: true,
    replacement,
    vitals: { latestVersion: version, lastRelease: '2020-01-01T00:00:00Z', maintainers: 1, deprecated: null, installScripts: false, weeklyDownloads: 1000, advisories: [], ...over },
  };
}

describe('Zombie Index worked examples (scan date Nov 25, 2026)', () => {
  // Inputs are the published figures from the build spec's table.
  const rows: [string, string, string, Partial<GraveNode['vitals']>, number][] = [
    ['natural-compare', '1.4.0', '2016-07-22T00:00:00Z', { weeklyDownloads: 197_550_703 }, 68],
    ['timespan', '2.3.0', '2013-10-08T00:00:00Z', { weeklyDownloads: 109_567, advisories: ['GHSA-f523-2f5j-gfcg'] }, 66],
    ['type-check', '0.4.0', '2020-04-03T00:00:00Z', { weeklyDownloads: 199_418_512 }, 55],
    ['path-browserify', '1.0.1', '2020-03-03T00:00:00Z', { weeklyDownloads: 72_582_972 }, 54],
  ];
  for (const [name, version, lastRelease, vitals, total] of rows) {
    it(`${name} scores ${total}`, () => {
      const s = zombieIndex(node(name, { lastRelease, ...vitals }, version), { scannedAt, ossuary });
      expect(s.total).toBe(total);
      expect(s.action).toBe(name === 'natural-compare' ? 'watch' : 'revive');
    });
  }

  it('ranks natural-compare first, and the worst revivable package after it', () => {
    const nodes = rows.map(([n, v, l, vit]) => node(n, { lastRelease: l, ...vit }, v));
    const ranked = rankDead(nodes, { scannedAt, ossuary });
    expect(ranked[0]!.node.name).toBe('natural-compare');
    expect(ranked.find((r) => r.score.action === 'revive')!.node.name).toBe('timespan');
  });

  it('says so when the installed version differs from the Ossuary version', () => {
    const s = zombieIndex(node('type-check', {}, '0.3.2'), { scannedAt, ossuary });
    expect(s.explain.some((l) => l.includes('0.4.0') && l.includes('0.3.2'))).toBe(true);
  });

  it('says "unknown" for unknown counts', () => {
    const s = zombieIndex(node('x', { maintainers: null, weeklyDownloads: null }), { scannedAt, ossuary });
    expect(s.explain.filter((l) => l.includes('unknown'))).toHaveLength(2);
    expect(s.parts.reach).toBe(0);
  });
});

// ---------- properties ----------

const vitalsArb = fc.record({
  lastRelease: fc.date({ min: new Date('2000-01-01Z'), max: new Date(scannedAt), noInvalidDate: true }).map((d) => d.toISOString()),
  maintainers: fc.option(fc.integer({ min: 0, max: 20 }), { nil: null }),
  deprecated: fc.option(fc.constantFrom('use something else', 'unmaintained'), { nil: null }),
  installScripts: fc.boolean(),
  weeklyDownloads: fc.option(fc.integer({ min: 0, max: 5_000_000_000 }), { nil: null }),
  advisories: fc.uniqueArray(fc.constantFrom('A1', 'A2', 'A3', 'A4', 'A5'), { maxLength: 5 }),
});
const nodeArb = fc
  .tuple(fc.constantFrom('a', 'type-check', 'uri-js'), vitalsArb, fc.option(fc.constant({ manifest: 'preferred' as const, replacements: ['x'] as string[] }), { nil: null }))
  .map(([name, v, repl]) => node(name, v, '0.4.0', repl));
const score = (n: GraveNode) => zombieIndex(n, { scannedAt, ossuary });

describe('Zombie Index properties', () => {
  it('total is an integer from 0 to 100, equal to the rounded sum of the parts, each part within its maximum', () => {
    fc.assert(
      fc.property(nodeArb, (n) => {
        const s = score(n);
        const { abandonment: a, attackSurface: sfc, reach: r } = s.parts;
        return (
          Number.isInteger(s.total) && s.total >= 0 && s.total <= 100 && s.total === Math.round(a + sfc + r) &&
          a >= 0 && a <= 40 && sfc >= 0 && sfc <= 40 && r >= 0 && r <= 20
        );
      }),
    );
  });

  it('more risk never lowers the total', () => {
    fc.assert(
      fc.property(nodeArb, fc.integer({ min: 1, max: 1e9 }), fc.integer({ min: 1, max: 2000 }), (n, extra, days) => {
        const base = score(n).total;
        const v = n.vitals;
        const worse: GraveNode['vitals'][] = [
          { ...v, advisories: [...v.advisories, 'NEW'] },
          { ...v, installScripts: true },
          { ...v, maintainers: 1 },
          { ...v, weeklyDownloads: (v.weeklyDownloads ?? 0) + extra },
          { ...v, lastRelease: new Date(Date.parse(v.lastRelease) - days * 86_400_000).toISOString() },
          { ...v, deprecated: 'deprecated' },
        ];
        return worse.every((w) => score({ ...n, vitals: w }).total >= base);
      }),
    );
  });

  it('action is replace exactly when a replacement exists', () => {
    fc.assert(fc.property(nodeArb, (n) => (score(n).action === 'replace') === (n.replacement !== null)));
  });

  it('explain has a line for every factor that contributed', () => {
    fc.assert(
      fc.property(nodeArb, (n) => {
        const s = score(n);
        const has = (prefix: string) => s.explain.some((l) => l.startsWith(prefix));
        const v = n.vitals;
        return (
          (s.parts.abandonment === 0 || has('Abandonment')) &&
          (!v.installScripts || s.explain.some((l) => l.includes('install scripts'))) &&
          (v.maintainers === null || v.maintainers > 1 || s.explain.some((l) => l.includes('maintainer'))) &&
          (v.advisories.length === 0 || s.explain.some((l) => l.includes('advisor'))) &&
          (s.parts.reach === 0 || has('Reach'))
        );
      }),
    );
  });
});
