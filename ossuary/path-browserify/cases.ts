import fc from 'fast-check';
import type { Case } from '@revenant/core/types';

// What Soul Match calls on path-browserify, and with which inputs.
// process.cwd() is defined as () => "/" in both builds.

const segment = fc.constantFrom('a', 'b', 'c', '.', '..', '', 'a.b', '.x', 'x.', '~', 'a b');

/** 0 to 8 segments joined by "/", with an optional leading and trailing slash. Empty segments give "//". */
export const path = fc
  .tuple(fc.boolean(), fc.array(segment, { maxLength: 8 }), fc.boolean())
  .map(([lead, segs, trail]) => (lead ? '/' : '') + segs.join('/') + (trail ? '/' : ''));

/** A path 95% of the time; anything else 5%, so the TypeError branches run too. */
export const maybePath: fc.Arbitrary<unknown> = fc.oneof(
  { weight: 95, arbitrary: path },
  { weight: 5, arbitrary: fc.anything() },
);

const ext: fc.Arbitrary<unknown> = fc.oneof(
  { weight: 95, arbitrary: fc.constantFrom(undefined, '.b', 'b', '.x') },
  { weight: 5, arbitrary: fc.anything() },
);

const part = fc.oneof(path, segment);
export const pathObject: fc.Arbitrary<unknown> = fc.oneof(
  {
    weight: 95,
    arbitrary: fc.record(
      { root: fc.constantFrom('', '/'), dir: part, base: part, name: part, ext: fc.constantFrom('', '.b', 'b', '.x') },
      { requiredKeys: [] },
    ),
  },
  { weight: 5, arbitrary: fc.anything() },
);

const args = fc.array(maybePath, { maxLength: 4 });
const none = fc.constant(null);

/** Typed text from the Ouija board: a JSON array for several arguments, otherwise one path string. */
function oneArg(text: string): unknown {
  return text;
}
function manyArgs(text: string): unknown[] {
  const t = text.trim();
  if (t.startsWith('[')) {
    const v = JSON.parse(t);
    if (!Array.isArray(v)) throw new Error('Expected a JSON array of arguments');
    return v;
  }
  return [text];
}
function pairArgs(text: string): [unknown, unknown] {
  const v = manyArgs(text);
  return [v[0], v[1]];
}

const pathChips = ['', '/', '..', '//', 'a/../..', '/a/b/../../..', '.x', 'a.b.', 'a//b/', '~/.x/'];

const cases: Case<any>[] = [
  { name: 'resolve', arbitrary: args, call: (m, a: unknown[]) => m.resolve(...a), parse: manyArgs, examples: ['[]', '["a", "/b", ".."]', '["", ""]'] },
  { name: 'normalize', arbitrary: maybePath, call: (m, p) => m.normalize(p), parse: oneArg, examples: pathChips },
  { name: 'isAbsolute', arbitrary: maybePath, call: (m, p) => m.isAbsolute(p), parse: oneArg, examples: pathChips },
  { name: 'join', arbitrary: args, call: (m, a: unknown[]) => m.join(...a), parse: manyArgs, examples: ['[]', '["", ""]', '["/a", "../..", "b/"]'] },
  { name: 'relative', arbitrary: fc.tuple(maybePath, maybePath), call: (m, [f, t]) => m.relative(f, t), parse: pairArgs, examples: ['["/a/b", "/a"]', '["/", "/a"]', '["a", "a/"]'] },
  { name: 'dirname', arbitrary: maybePath, call: (m, p) => m.dirname(p), parse: oneArg, examples: pathChips },
  { name: 'basename', arbitrary: fc.tuple(maybePath, ext), call: (m, [p, e]) => m.basename(p, e), parse: pairArgs, examples: ['["a.b", ".b"]', '["/x/", "x"]', '[".b", ".b"]'] },
  { name: 'extname', arbitrary: maybePath, call: (m, p) => m.extname(p), parse: oneArg, examples: pathChips },
  { name: 'parse', arbitrary: maybePath, call: (m, p) => m.parse(p), parse: oneArg, examples: pathChips },
  { name: 'format', arbitrary: pathObject, call: (m, o) => m.format(o), parse: (t) => JSON.parse(t), examples: ['{}', '{"root": "/", "base": "a"}', '{"dir": "/", "name": ".x"}', 'null'] },
  { name: 'format(parse)', arbitrary: maybePath, call: (m, p) => m.format(m.parse(p)), parse: oneArg, examples: pathChips },
  { name: '_makeLong', arbitrary: maybePath, call: (m, p) => m._makeLong(p), parse: oneArg, examples: ['a'] },
  { name: 'sep', arbitrary: none, call: (m) => m.sep },
  { name: 'delimiter', arbitrary: none, call: (m) => m.delimiter },
  { name: 'win32', arbitrary: none, call: (m) => m.win32 },
  { name: 'posix', arbitrary: none, call: (m) => m.posix },
];

export default cases;
