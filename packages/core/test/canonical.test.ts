import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { canonical, canonicalString } from '../src/soul/canonical.ts';
import { sha256Hex } from '../src/soul/sha256.ts';
import { diffOutcomes, charSplit } from '../src/soul/diff.ts';

describe('canonical', () => {
  it('marks values JSON would lose', () => {
    expect(canonical(undefined)).toEqual({ $u: 1 });
    expect(canonical(NaN)).toEqual({ $nan: 1 });
    expect(canonical(-0)).toEqual({ $neg0: 1 });
    expect(canonical(0)).toBe(0);
    expect(canonical(Infinity)).toEqual({ $inf: 1 });
    expect(canonical(-Infinity)).toEqual({ $inf: -1 });
    expect(canonical(10n)).toEqual({ $big: '10' });
  });

  it('handles dates, regexes and functions', () => {
    expect(canonical(new Date(5))).toEqual({ $date: 5 });
    expect(canonical(new Date(NaN))).toEqual({ $date: 'invalid' });
    expect(canonical(/a+/gi)).toEqual({ $re: 'a+', flags: 'gi' });
    expect(canonical(function named() {})).toEqual({ $fn: 'named' });
  });

  it('turns array holes into undefined', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(canonical([1, , 3])).toEqual([1, { $u: 1 }, 3]);
  });

  it('sorts keys and keeps non-Object constructor names', () => {
    class Thing {
      b = 1;
      a = 2;
    }
    expect(canonicalString(new Thing())).toBe('{"$c":"Thing","a":2,"b":1}');
    expect(canonicalString({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonical(Object.create(null))).toEqual({ $c: 'null' });
  });

  it('escapes keys that look like markers', () => {
    expect(canonical({ $nan: 1 })).toEqual({ $$nan: 1 });
  });

  it('marks cycles but not shared references', () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    expect(canonical(a)).toEqual({ self: { $cycle: 1 }, x: 1 });
    const shared = { v: 1 };
    expect(canonical([shared, shared])).toEqual([{ v: 1 }, { v: 1 }]);
  });

  it('is a function of the value: a deep copy gives the same string', () => {
    // structuredClone, not a JSON round trip: JSON turns -0 into 0, and
    // canonical keeps them apart on purpose.
    fc.assert(
      fc.property(fc.anything({ withDate: true, withMap: true, withSet: true }), (v) => canonicalString(v) === canonicalString(structuredClone(v))),
      { numRuns: 2000 },
    );
  });

  it('distinguishes values that JSON.stringify would merge', () => {
    const merged = [null, NaN, Infinity, -Infinity, undefined, -0, 0];
    const strings = new Set(merged.map((v) => canonicalString(v)));
    expect(strings.size).toBe(merged.length);
  });
});

describe('sha256', () => {
  it('matches node:crypto on arbitrary text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 300 }), (s) => {
        return sha256Hex(s) === createHash('sha256').update(s, 'utf8').digest('hex');
      }),
      { numRuns: 300 },
    );
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('diffOutcomes', () => {
  it('spells out thrown versus returned', () => {
    expect(diffOutcomes({ kind: 'ok', value: 1 }, { kind: 'throw', name: 'TypeError' })).toEqual({
      type: 'kind',
      original: 'returned a value',
      candidate: 'threw TypeError',
    });
  });

  it('lists differing paths in objects', () => {
    const d = diffOutcomes({ kind: 'ok', value: { a: 1, b: [1, 2] } }, { kind: 'ok', value: { a: 1, b: [1, 3] } });
    expect(d).toEqual({ type: 'value', paths: [{ path: 'b[1]', original: 2, candidate: 3 }] });
  });

  it('treats one dropped array element as one difference', () => {
    const d = diffOutcomes(
      { kind: 'ok', value: [{ type: 'Undefined' }, { type: 'Null' }, { type: 'Number' }] },
      { kind: 'ok', value: [{ type: 'Undefined' }, { type: 'Number' }] },
    );
    expect(d).toEqual({ type: 'value', paths: [{ path: '[1]', original: { type: 'Null' }, candidate: null, candidateMissing: true }] });
  });

  it('splits strings by character', () => {
    expect(charSplit('a/b/', 'a/b')).toEqual({ prefix: 'a/b', original: '/', candidate: '', suffix: '' });
  });
});
