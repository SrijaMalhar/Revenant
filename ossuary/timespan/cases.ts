import fc from 'fast-check';
import type { Case } from '@revenant/core/types';
import { parseLooseValue } from '@revenant/core/soul/loose';

// What Soul Match calls on timespan, and with which inputs.
// Every run freezes Date.now at 2026-01-01T00:00:00Z and Node runs use TZ=UTC.

/** Compare TimeSpans by behaviour, not internals. */
export function projectSpan(v: unknown): unknown {
  if (v !== null && typeof v === 'object' && typeof (v as { totalMilliseconds?: unknown }).totalMilliseconds === 'function') {
    const ts = v as Record<string, any>;
    return {
      ms: ts.totalMilliseconds(),
      str: ts.toString(),
      parts: [ts.days, ts.hours, ts.minutes, ts.seconds, ts.milliseconds],
    };
  }
  return v;
}

/** Integers from -1e9 to 1e9, doubles including NaN, plus 0, -0, 0.5 and 1e15. */
export const amount: fc.Arbitrary<number> = fc.oneof(
  fc.integer({ min: -1e9, max: 1e9 }),
  fc.double(),
  fc.constantFrom(0, -0, 0.5, 1e15),
);

/** The constructor and add* methods accept anything; numeric strings take a different path. */
const loose: fc.Arbitrary<unknown> = fc.oneof(
  { weight: 6, arbitrary: amount },
  { weight: 1, arbitrary: fc.integer({ min: -5000, max: 5000 }).map(String) },
  { weight: 1, arbitrary: fc.constantFrom(undefined, null, '', 'x', true) },
);

const digits = (max: number) => fc.integer({ min: 0, max }).map(String);
const fraction = fc.option(fc.integer({ min: 0, max: 999 }).map((n) => '.' + String(n).padStart(3, '0')), { nil: '' });

/** d:h:m:s or h:m:s with an optional .fff fraction, plus junk. */
export const spanString: fc.Arbitrary<string> = fc.oneof(
  fc.tuple(digits(400), digits(30), digits(70), digits(70), fraction).map(([d, h, m, s, f]) => `${d}:${h}:${m}:${s}${f}`),
  fc.tuple(digits(30), digits(70), digits(70), fraction).map(([h, m, s, f]) => `${h}:${m}:${s}${f}`),
  fc.string({ maxLength: 12 }),
  fc.constantFrom('', ':', '1:2', '1:2:3.', '01:02:03.5x', '-1:2:3'),
);

const UNITS = ['milli', 'millis', 'milliseconds', 'second', 'seconds', 'minute', 'minutes', 'hour', 'hours', 'day', 'days', 'month', 'months', 'year', 'years'];

/** A unit in random case. */
const unit = fc
  .tuple(fc.constantFrom(...UNITS), fc.array(fc.boolean(), { minLength: 12, maxLength: 12 }))
  .map(([u, caps]) => [...u].map((ch, i) => (caps[i % caps.length] ? ch.toUpperCase() : ch)).join(''));

/** A number up to 10,000 followed by a unit. Numbers stay short on purpose: long digit runs belong to the exorcism test. */
const modifier = fc.tuple(fc.integer({ min: 0, max: 10_000 }), unit).map(([n, u]) => `${n}${u}`);
const modifiers = fc.array(modifier, { minLength: 1, maxLength: 7 }).map((ms) => ms.join(''));

const isoDate = fc
  .date({ min: new Date('1970-01-01T00:00:00Z'), max: new Date('2100-12-31T23:59:59Z'), noInvalidDate: true })
  .map((d) => d.toISOString());
const sign = fc.constantFrom('+', '-');
const optSign = fc.constantFrom('+', '-', '');

/** ISO dates; NOW; NOW, + or - with 1 to 7 modifiers; an ISO date, Z, a sign and modifiers; plus junk. */
export const dateString: fc.Arbitrary<string> = fc.oneof(
  isoDate,
  fc.constantFrom('NOW', 'now', 'Now'),
  fc.tuple(fc.constantFrom('NOW', 'now'), optSign, modifiers).map(([n, s, m]) => n + s + m),
  fc.tuple(sign, modifiers).map(([s, m]) => s + m),
  fc.tuple(isoDate, optSign, modifiers).map(([d, s, m]) => `${d.slice(0, 19)}Z${s}${m}`),
  fc.tuple(isoDate, sign, modifiers).map(([d, s, m]) => `${d.slice(0, 10)}Z${s}${m}`),
  fc.string({ maxLength: 12 }),
  fc.constantFrom('', 'Z', 'NOW+', 'NOW+3', 'NOW+days', '+', '1970-01-01T00:00:00Z+1day', 'NOW 3days', 'NOW|2hours'),
);

const ADDERS = ['addMilliseconds', 'addSeconds', 'addMinutes', 'addHours', 'addDays'];
const SUBTRACTERS = ['subtractMilliseconds', 'subtractSeconds', 'subtractMinutes', 'subtractHours', 'subtractDays'];

type Op = { op: string; amount: unknown };
const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ op: fc.constantFrom(...ADDERS, ...SUBTRACTERS), amount: loose }),
  fc.record({ op: fc.constantFrom('add', 'subtract'), amount: amount }),
);

/** A starting amount and 0 to 6 operations. */
export const ops = fc.record({ start: amount, ops: fc.array(op, { maxLength: 6 }) });

function applyOps(m: any, input: { start: number; ops: Op[] }) {
  const ts = new m.TimeSpan(input.start);
  for (const o of input.ops) {
    if (o.op === 'add' || o.op === 'subtract') ts[o.op](m.fromMilliseconds(o.amount));
    else ts[o.op](o.amount);
  }
  return ts;
}

const TOTALS = ['totalMilliseconds', 'totalSeconds', 'totalMinutes', 'totalHours', 'totalDays'];

const dateOrString: fc.Arbitrary<unknown> = fc.oneof(
  dateString,
  fc.date({ min: new Date('1970-01-01T00:00:00Z'), max: new Date('2100-12-31T23:59:59Z'), noInvalidDate: false }),
  fc.constantFrom(null, undefined, 5),
);

const json = (t: string) => parseLooseValue(t);

const amountChips = ['NaN', '-0', '0', '0.5', '1e15', '"12"', '-1'];
const dateChips = ['NOW', 'NOW+3days', 'NOW-1month', '+12hours', '2010-04-03T12:34:15Z+12MINUTES', 'NOW+40days', 'Z', ''];

const cases: Case<any>[] = [
  ...['fromMilliseconds', 'fromSeconds', 'fromMinutes', 'fromHours', 'fromDays'].map(
    (fn): Case<unknown> => ({
      name: fn,
      arbitrary: loose,
      call: (m, a) => m[fn](a),
      project: projectSpan,
      parse: json,
      examples: amountChips,
    }),
  ),
  {
    name: 'new TimeSpan',
    arbitrary: fc.array(loose, { maxLength: 5 }),
    call: (m, a: unknown[]) => new m.TimeSpan(...a),
    project: projectSpan,
    parse: (t) => {
      const v = json(t);
      return Array.isArray(v) ? v : [v];
    },
    examples: ['[1, 2, 3, 4, 5]', '["5"]', '[0.5, 0, 0, 0, 1]', '[NaN]'],
  },
  { name: 'parse', arbitrary: spanString, call: (m, s) => m.parse(s), project: projectSpan, parse: (t) => t, examples: ['1:2:3', '1:2:3:4.5', '00:00:00.999', ':', ''] },
  { name: 'parseDate', arbitrary: dateString, call: (m, s) => m.parseDate(s), project: projectSpan, parse: (t) => t, examples: dateChips },
  {
    name: 'fromDates',
    arbitrary: fc.tuple(dateOrString, dateOrString, fc.option(fc.boolean(), { nil: undefined })),
    call: (m, [a, b, abs]) => m.fromDates(a, b, abs),
    project: projectSpan,
    parse: (t) => {
      const v = json(t) as unknown[];
      return [v[0], v[1], v[2]];
    },
    examples: ['["NOW", "NOW+1day"]', '["NOW+1day", "NOW", true]', '["2020-01-01T00:00:00Z", "Z"]'],
  },
  { name: 'test', arbitrary: fc.oneof(spanString, fc.anything()), call: (m, s) => m.test(s), parse: (t) => t, examples: ['1:2:3', 'x1:2:3', ''] },
  {
    name: 'instanceOf',
    arbitrary: fc.oneof(amount.map((n) => ({ make: n })), fc.anything()),
    call: (m, x: any) => m.instanceOf(x && typeof x === 'object' && 'make' in x ? new m.TimeSpan(x.make) : x),
    parse: json,
    examples: ['{"make": 5}', '5', 'null'],
  },
  {
    name: 'clone',
    arbitrary: fc.oneof(amount.map((n) => ({ make: n })), fc.anything()),
    call: (m, x: any) => m.clone(x && typeof x === 'object' && 'make' in x ? new m.TimeSpan(x.make) : x),
    project: projectSpan,
    parse: json,
    examples: ['{"make": 0}', '{"make": 1.5}', '{"make": NaN}', '5'],
  },
  ...TOTALS.map(
    (fn): Case<[number, unknown]> => ({
      name: fn,
      arbitrary: fc.tuple(amount, fc.constantFrom(undefined, true, false, 1)),
      call: (m, [ms, roundDown]) => new m.TimeSpan(ms)[fn](roundDown),
      parse: (t) => {
        const v = json(t) as [number, unknown];
        return [v[0], v[1]];
      },
      examples: ['[-1, true]', '[1.5, true]', '[86399999, true]'],
    }),
  ),
  {
    name: 'equals',
    arbitrary: fc.tuple(amount, fc.oneof(amount.map((n) => ({ make: n })), fc.anything())),
    call: (m, [a, b]: [number, any]) => new m.TimeSpan(a).equals(b && typeof b === 'object' && 'make' in b ? new m.TimeSpan(b.make) : b),
    parse: (t) => json(t),
    examples: ['[0, {"make": -0}]', '[NaN, {"make": NaN}]', '[1, 1]'],
  },
  {
    name: 'ops',
    arbitrary: ops,
    call: applyOps,
    project: projectSpan,
    parse: json,
    examples: ['{"start": 0, "ops": [{"op": "addDays", "amount": 1}]}', '{"start": 5, "ops": [{"op": "addSeconds", "amount": "3"}]}'],
  },
];

export default cases;
