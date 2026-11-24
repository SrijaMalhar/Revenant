import fc from 'fast-check';
import type { Case } from '../../packages/core/src/types.ts';

// What kinds of inputs the generators actually produce, so "100,000 inputs"
// can't quietly mean 100,000 trivial ones. Labels are per package; shares
// are fractions of the sampled inputs of the cases each label applies to.

type Classifier = { cases: string[]; labels: Record<string, (input: any) => boolean> };

const pathOf = (x: unknown) => (typeof x === 'string' ? x : null);
const typeDepth = (t: string) => {
  let d = 0;
  let max = 0;
  for (const ch of t) {
    if ('[({'.includes(ch)) max = Math.max(max, ++d);
    else if (')]}'.includes(ch)) d--;
  }
  return max;
};

export const CLASSIFIERS: Record<string, Classifier> = {
  'path-browserify': {
    cases: ['normalize', 'isAbsolute', 'dirname', 'extname', 'parse', 'format(parse)'],
    labels: {
      'absolute': (x) => pathOf(x)?.startsWith('/') ?? false,
      'relative': (x) => pathOf(x) !== null && pathOf(x) !== '' && !pathOf(x)!.startsWith('/'),
      'contains ..': (x) => pathOf(x)?.includes('..') ?? false,
      'contains //': (x) => pathOf(x)?.includes('//') ?? false,
      'trailing /': (x) => (pathOf(x)?.length ?? 0) > 1 && pathOf(x)!.endsWith('/'),
      'empty string': (x) => x === '',
      'not a string': (x) => typeof x !== 'string',
    },
  },
  'type-check': {
    cases: ['typeCheck', 'parsedTypeCheck'],
    labels: {
      'has |': ([t]) => t.includes('|'),
      'has Maybe': ([t]) => t.includes('Maybe'),
      'nested 2+ deep': ([t]) => typeDepth(t) >= 2,
      'has fields {}': ([t]) => t.includes('{'),
      'has ...': ([t]) => t.includes('...'),
      'value is NaN': ([, v]) => typeof v === 'number' && Number.isNaN(v),
      'value is an object or array': ([, v]) => typeof v === 'object' && v !== null,
    },
  },
  'timespan': {
    cases: ['parseDate'],
    labels: {
      'ISO date': (s) => !Number.isNaN(Date.parse(s)),
      'NOW form': (s) => /^NOW/i.test(s),
      'signed form': (s) => /^[+-]/.test(s),
      'ISO + Z + modifiers': (s) => Number.isNaN(Date.parse(s)) && /^\d{4}-.*Z/.test(s),
      '3+ modifiers': (s) => (s.match(/\d+[a-zA-Z]+/g) ?? []).length >= 3,
      'other text': (s) => Number.isNaN(Date.parse(s)) && !/^(NOW|[+-]|\d{4}-)/i.test(s),
    },
  },
};

export function inputStats(pkg: string, cases: Case<any>[], n = 10_000, seed = 42): Record<string, number> {
  const cls = CLASSIFIERS[pkg];
  if (!cls) return {};
  const counts: Record<string, number> = Object.fromEntries(Object.keys(cls.labels).map((l) => [l, 0]));
  let total = 0;
  for (const c of cases.filter((x) => cls.cases.includes(x.name))) {
    for (const input of fc.sample(c.arbitrary, { seed, numRuns: n })) {
      total++;
      for (const [label, test] of Object.entries(cls.labels)) if (test(input)) counts[label]!++;
    }
  }
  return Object.fromEntries(Object.entries(counts).map(([l, k]) => [l, Math.round((k / total) * 1000) / 1000]));
}

/** Minimum shares the generators must keep. A drop below any of these is a generator regression. */
export const MINIMUMS: Record<string, Record<string, number>> = {
  'path-browserify': { 'contains ..': 0.1, 'contains //': 0.1, 'absolute': 0.3, 'relative': 0.3, 'not a string': 0.02 },
  'type-check': { 'has |': 0.2, 'has Maybe': 0.1, 'nested 2+ deep': 0.1, 'has fields {}': 0.1, 'value is NaN': 0.005 },
  'timespan': { 'NOW form': 0.1, 'signed form': 0.05, 'ISO + Z + modifiers': 0.1, '3+ modifiers': 0.1 },
};
