import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { FROZEN_NOW, outcome, sameOutcome } from '@revenant/core/soul';
import { loadOriginal, loadRevived } from '@revenant/core/node';
import { projectSpan } from './cases.ts';

// EXORCISED requirement: parseDate runs in linear time and rejects malformed
// trailing input in bounded time; for every input the original parses to a
// valid Date, the revived parseDate returns an equal Date.
//
// This file is the only place the slow inputs exist. They're built here in
// code and kept out of the 100,000-input same-soul run.

type Mod = { parseDate: (s: string) => Date | null };
let original: Mod;
let revived: Mod;
const realNow = Date.now;

beforeAll(async () => {
  Date.now = () => FROZEN_NOW;
  original = (await loadOriginal('timespan')) as Mod;
  revived = (await loadRevived('timespan')) as Mod;
});
afterAll(() => {
  Date.now = realNow;
});

/** A long digit run with a letter after it: the shape the original's unit regexes choke on. */
export function slowInput(n: number): string {
  return 'NOW+' + '1'.repeat(n) + 'a';
}

function timeMs(fn: () => unknown, reps: number): number {
  const times: number[] = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}

const SIZES = [1000, 2000, 4000, 8000];

describe('exorcism: timespan parseDate', () => {
  it('the revived parseDate stays under 5 ms at every size', () => {
    for (const n of SIZES) {
      const input = slowInput(n);
      revived.parseDate(input); // warm up
      expect(timeMs(() => revived.parseDate(input), 5)).toBeLessThan(5);
    }
  });

  it('the original grows at least quadratically: doubling n roughly quadruples the time', () => {
    const times = SIZES.map((n) => {
      const input = slowInput(n);
      original.parseDate(input);
      return timeMs(() => original.parseDate(input), 3);
    });
    const ratios = times.slice(1).map((t, i) => t / times[i]!);
    // Linear would be about 2. Allow for timer noise on the smallest size,
    // but the overall growth has to look quadratic.
    for (const r of ratios.slice(1)) expect(r).toBeGreaterThan(2.8);
    const geometricMean = Math.pow(ratios.reduce((a, b) => a * b, 1), 1 / ratios.length);
    expect(geometricMean).toBeGreaterThan(3);
  });

  it('both still agree on the answer for the slow shape', () => {
    for (const n of [10, 100, 1000]) {
      const input = slowInput(n);
      const c = { name: 'parseDate', arbitrary: fc.constant(input), call: (m: Mod, s: string) => m.parseDate(s), project: projectSpan };
      expect(sameOutcome(outcome(c, original, input), outcome(c, revived, input))).toBe(true);
    }
  });

  it('agrees with the original on long-but-tractable modifiers', () => {
    // Long digit runs with units whose arithmetic is O(1) in the original, plus
    // day counts small enough for its month-by-month loop. Both must agree.
    const fastUnit = fc.constantFrom('milli', 'seconds', 'MINUTE', 'hours', 'months', 'Years', 'x', 'q');
    const longDigits = fc.integer({ min: 1, max: 400 }).chain((n) => fc.stringMatching(new RegExp(`^[0-9]{${n}}$`)));
    const input = fc.oneof(
      fc.tuple(fc.constantFrom('NOW+', 'NOW-', '+', '-', '2020-02-29T10:00:00Z+'), longDigits, fastUnit).map(([a, d, u]) => a + d + u),
      fc.tuple(fc.constantFrom('NOW+', 'NOW-', '-'), fc.integer({ min: 0, max: 400_000 }), fc.constantFrom('day', 'DAYS')).map(([a, d, u]) => `${a}${d}${u}`),
    );
    const c = { name: 'parseDate', arbitrary: input, call: (m: Mod, s: string) => m.parseDate(s), project: projectSpan };
    fc.assert(
      fc.property(input, (s) => sameOutcome(outcome(c, original, s), outcome(c, revived, s))),
      { numRuns: 300, seed: 42 },
    );
  });

  it('skips whole 400-year cycles instead of looping month by month', () => {
    // 10 million days would take the original millions of loop steps.
    const t = timeMs(() => revived.parseDate('NOW+10000000days'), 3);
    expect(t).toBeLessThan(5);
    expect(revived.parseDate('NOW+10000000days')).toBeInstanceOf(Date);
  });
});
