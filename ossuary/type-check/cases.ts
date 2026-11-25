import fc from 'fast-check';
import type { Case } from '@revenant/core/types';
import { parseLooseValue } from '@revenant/core/soul/loose';

// What Soul Match calls on type-check, and with which inputs.

const BUILT_INS = ['Number', 'NaN', 'Int', 'Float', 'Date', 'String', 'Boolean', 'Array', 'Object', 'RegExp', 'Undefined', 'Null', 'Function'];

const space = fc.constantFrom('', ' ', '  ');

/**
 * Type strings from type-check's grammar, nested at most 3 deep:
 * alternatives joined by "|", an optional "Maybe", "*", identifiers, arrays
 * [T], tuples (T, T), fields {a: T, ...}, an identifier followed by a
 * structure, and the "comment :: T" prefix.
 */
export function typeString(identifiers: string[] = [...BUILT_INS, 'Foo']): fc.Arbitrary<string> {
  const ident = fc.constantFrom(...identifiers);
  const key = fc.constantFrom('a', 'b', 'c');
  const { types } = fc.letrec((tie) => ({
    types: fc
      .tuple(
        fc.oneof({ weight: 1, arbitrary: fc.constant('comment :: ') }, { weight: 9, arbitrary: fc.constant('') }),
        fc.oneof({ weight: 1, arbitrary: fc.constant('Maybe ') }, { weight: 4, arbitrary: fc.constant('') }),
        fc.array(tie('alt') as fc.Arbitrary<string>, { minLength: 1, maxLength: 3 }),
        space,
      )
      .map(([comment, maybe, alts, sp]) => comment + maybe + alts.join(`${sp}|${sp}`)),
    alt: fc.oneof(
      { maxDepth: 3, depthIdentifier: 'type-check' },
      ident,
      fc.constant('*'),
      tie('structure') as fc.Arbitrary<string>,
      fc.tuple(ident, tie('structure') as fc.Arbitrary<string>).map(([i, s]) => i + s),
    ),
    structure: fc.oneof(
      { depthIdentifier: 'type-check' },
      fc.tuple(space, tie('types') as fc.Arbitrary<string>, space).map(([a, t, b]) => `[${a}${t}${b}]`),
      fc
        .tuple(fc.array(tie('types') as fc.Arbitrary<string>, { minLength: 1, maxLength: 3 }), space, fc.boolean())
        .map(([ts, sp, trailing]) => `(${ts.join(`,${sp}`)}${trailing ? ',' : ''})`),
      fc
        .tuple(
          fc.array(fc.tuple(key, tie('types') as fc.Arbitrary<string>), { maxLength: 3 }),
          fc.boolean(),
          space,
        )
        .map(([fields, subset, sp]) => {
          const body = fields.map(([k, t]) => `${k}:${sp}${t}`);
          if (subset || body.length === 0) body.push('...');
          return `{${body.join(`,${sp}`)}}`;
        }),
    ),
  }));
  return types as fc.Arbitrary<string>;
}

const JUNK = ['[', ']', '{', '}', '(', ')', ',', ':', '|', '...', '*', 'Maybe', 'Number', 'a', '::', '->'];
const tokenRegex = /\.\.\.|::|->|[$\w]+|\S/g;

/** Token soup: most of these fail to parse, and both sides must then throw. */
const tokenSoup = fc
  .array(fc.constantFrom(...JUNK), { maxLength: 8 })
  .chain((tokens) => fc.array(space, { minLength: tokens.length, maxLength: tokens.length }).map((sps) => tokens.map((t, i) => t + sps[i]).join('')));

/**
 * Near misses: a valid type string with one token replaced, inserted or
 * dropped. Random soup almost never reaches deep parser branches, such as a
 * field key that isn't an identifier; a planted bug there survived 100,000
 * inputs until these were added.
 */
const nearMiss = fc
  .tuple(typeString(), fc.nat(), fc.constantFrom(...JUNK), fc.constantFrom('replace', 'insert', 'drop'))
  .map(([t, at, junk, how]) => {
    const tokens = t.match(tokenRegex) ?? [];
    const i = tokens.length ? at % tokens.length : 0;
    if (how === 'replace') tokens[i] = junk;
    else if (how === 'insert') tokens.splice(i, 0, junk);
    else tokens.splice(i, 1);
    return tokens.join(' ');
  });

export const badTypeString = fc.oneof(tokenSoup, nearMiss);

// NaN, Infinity and -0 get their own entry: fc.double() alone made NaN so
// rare that a planted "Number accepts NaN" bug survived 100,000 inputs.
const leaf = fc.oneof(
  fc.integer(),
  fc.double(),
  fc.constantFrom(NaN, Infinity, -Infinity, -0),
  fc.string({ maxLength: 5 }),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
  fc.date({ noInvalidDate: false }),
);

/** Integers, doubles (NaN and Infinity included), strings, booleans, null, undefined, dates, arrays and {a, b, c} objects, up to depth 3. */
export const value: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  v: fc.oneof(
    { maxDepth: 3, depthIdentifier: 'value' },
    leaf,
    fc.array(tie('v'), { maxLength: 4 }),
    fc.record({ a: tie('v'), b: tie('v'), c: tie('v') }, { requiredKeys: [] }),
  ),
})).v;

const evenOptions = () => ({
  customTypes: { Even: { typeOf: 'Number', validate: (n: number) => n % 2 === 0 } },
});

/** Ouija text: the type string on the first line, the value (JSON or NaN, undefined, Date(...)) after it. */
function typeAndValue(text: string): [string, unknown] {
  const nl = text.indexOf('\n');
  if (nl === -1) return [text, undefined];
  return [text.slice(0, nl), parseLooseValue(text.slice(nl + 1))];
}

const typeChips = ['Maybe', '[', 'Number |', '{...}', 'Int\n1.5', 'NaN\nNaN', 'Maybe Number\nnull', '{a: Number, ...}\n{"a": 1, "b": 2}', '(Int, String)\n[1, "a", true]', '*\nundefined'];

const cases: Case<any>[] = [
  {
    name: 'parseType',
    arbitrary: fc.oneof(typeString(), badTypeString),
    call: (m, t: string) => m.parseType(t),
    parse: (t) => t,
    examples: ['Maybe', '[', '', 'Number |', '{...}', 'comment :: [Int]', '(String,)', 'a -> b'],
  },
  {
    name: 'typeCheck',
    arbitrary: fc.tuple(typeString(), value),
    call: (m, [t, v]) => m.typeCheck(t, v),
    parse: typeAndValue,
    examples: typeChips,
  },
  {
    name: 'parsedTypeCheck',
    arbitrary: fc.tuple(typeString(), value),
    call: (m, [t, v]) => m.parsedTypeCheck(m.parseType(t), v),
    parse: typeAndValue,
    examples: typeChips,
  },
  {
    name: 'typeCheck customTypes',
    arbitrary: fc.tuple(typeString([...BUILT_INS, 'Foo', 'Even']), value),
    call: (m, [t, v]) => m.typeCheck(t, v, evenOptions()),
    parse: typeAndValue,
    examples: ['Even\n2', 'Even\n3', '[Even]\n[2, 4]', 'Maybe Even\nnull'],
  },
  { name: 'VERSION', arbitrary: fc.constant(null), fixed: true, call: (m) => m.VERSION },
];

export default cases;
