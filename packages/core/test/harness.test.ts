import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Case } from '../src/types.ts';
import { runSoulMatch, splitRuns, withFrozenClock, FROZEN_NOW } from '../src/soul/run.ts';
import { soulprintHash } from '../src/soul/soulprint.ts';

// Harness self-test. Before trusting Soul Match on real packages, it has to
// catch a difference it was built to catch. A harness that always said "same
// soul" would look like a success, so this file is the floor under every
// other result.

const truth = { len: (s: string) => s.length, upper: (s: string) => s.toUpperCase() };
// Wrong on one input class only: off by one for strings longer than 5.
const offByOne = { len: (s: string) => (s.length > 5 ? s.length + 1 : s.length), upper: truth.upper };
const throwsOnEmpty = {
  len: (s: string) => {
    if (s === '') throw new RangeError('empty');
    return s.length;
  },
  upper: truth.upper,
};

const cases: Case<string>[] = [
  { name: 'len', arbitrary: fc.string({ maxLength: 20 }), call: (m, s) => m.len(s) },
  { name: 'upper', arbitrary: fc.string({ maxLength: 20 }), call: (m, s) => m.upper(s) },
];

describe('runSoulMatch', () => {
  it('reports same soul when both sides agree', () => {
    const run = runSoulMatch({ pkg: 'self', original: truth, candidate: { ...truth }, cases, numRuns: 2000, seed: 42 });
    expect(run.status).toBe('same-soul');
    expect(run.done).toBe(2000);
    expect(run.perCase).toEqual([
      { name: 'len', runs: 1000, skipped: 0 },
      { name: 'upper', runs: 1000, skipped: 0 },
    ]);
  });

  it('catches an off-by-one and shrinks it to a minimal input', () => {
    const run = runSoulMatch({ pkg: 'self', original: truth, candidate: offByOne, cases, numRuns: 2000, seed: 42 });
    expect(run.status).toBe('diverged');
    const d = run.divergence!;
    expect(d.caseName).toBe('len');
    // The smallest failing input is a 6-character string; fast-check shrinks
    // its characters too, so it lands on six spaces or similar.
    expect((d.input as string).length).toBe(6);
    expect(d.original).toEqual({ kind: 'ok', value: 6 });
    expect(d.candidate).toEqual({ kind: 'ok', value: 7 });
    expect(d.shrinks).toBeGreaterThan(0);
    // The verbose path starts at the first failure and ends at the shrunk one.
    expect(d.path!.length).toBe(d.shrinks + 1);
    expect(d.path!.at(-1)).toBe(d.input);
  });

  it('treats returned-versus-thrown as a divergence', () => {
    const run = runSoulMatch({ pkg: 'self', original: truth, candidate: throwsOnEmpty, cases, numRuns: 2000, seed: 1 });
    expect(run.status).toBe('diverged');
    expect(run.divergence!.input).toBe('');
    expect(run.divergence!.candidate).toEqual({ kind: 'throw', name: 'RangeError' });
  });

  it('counts inputs in a declared-divergence domain as skipped', () => {
    const allowed: Case<string>[] = [{ ...cases[0]!, allow: (s) => s.length > 5 }];
    const run = runSoulMatch({ pkg: 'self', original: truth, candidate: offByOne, cases: allowed, numRuns: 500, seed: 3 });
    expect(run.status).toBe('same-soul');
    expect(run.perCase![0]!.skipped).toBeGreaterThan(0);
  });

  it('runs regression examples first', () => {
    const run = runSoulMatch({
      pkg: 'self',
      original: truth,
      candidate: offByOne,
      cases,
      numRuns: 2,
      seed: 42,
      examples: { len: ['abcdefgh'] },
    });
    expect(run.status).toBe('diverged');
  });

  it('is deterministic for a fixed seed', () => {
    const a = runSoulMatch({ pkg: 'self', original: truth, candidate: offByOne, cases, numRuns: 2000, seed: 7, clock: () => 0 });
    const b = runSoulMatch({ pkg: 'self', original: truth, candidate: offByOne, cases, numRuns: 2000, seed: 7, clock: () => 0 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('splits runs evenly', () => {
    expect(splitRuns(10, 3)).toEqual([4, 3, 3]);
    expect(splitRuns(100_000, 7).reduce((x, y) => x + y)).toBe(100_000);
  });

  it('gives a fixed case one run, so constants never pad the count', () => {
    expect(splitRuns(100_000, 5, [false, false, false, false, true])).toEqual([25_000, 25_000, 25_000, 24_999, 1]);
    expect(splitRuns(10, 3, [true, false, true])).toEqual([1, 8, 1]);
    expect(splitRuns(100_000, 16, Array.from({ length: 16 }, (_, i) => i >= 12)).reduce((x, y) => x + y)).toBe(100_000);
  });
});

describe('soulprint', () => {
  it('is equal for equal behaviour and different otherwise', () => {
    const a = soulprintHash(truth, cases, 42, 500);
    expect(soulprintHash({ ...truth }, cases, 42, 500)).toBe(a);
    expect(soulprintHash(offByOne, cases, 42, 500)).not.toBe(a);
  });
});

describe('withFrozenClock', () => {
  it('freezes and restores Date.now', () => {
    const before = Date.now;
    expect(withFrozenClock(() => Date.now())).toBe(FROZEN_NOW);
    expect(Date.now).toBe(before);
  });
});
