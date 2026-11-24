/**
 * type-check, revived.
 *
 * A zero-dependency TypeScript reimplementation of type-check 0.4.0 by
 * George Zahariev. The three prelude-ls helpers it used (any, all, isItNaN)
 * are inlined, so this one package replaces both type-check and prelude-ls.
 * It aims to behave exactly like the original on every input.
 */

export const VERSION = '0.4.0';

export type TypeNode =
  | { type: string; structure?: undefined }
  | { type?: string; structure: 'array'; of: TypeNode[] }
  | { type?: string; structure: 'tuple'; of: TypeNode[][] }
  | { type?: string; structure: 'fields'; of: Record<string, TypeNode[]>; subset: boolean };

export interface CustomType {
  typeOf?: string;
  validate: (value: any) => boolean;
}

export interface Options {
  customTypes?: Record<string, CustomType>;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

// An identifier is any token containing a word character or "$" (the test is
// not anchored, matching the original).
const identifierRegex = /[$\w]+/;
// Tokens: "...", "::", "->", identifiers, or any single non-space character.
const tokenRegex = /\.\.\.|::|->|[$\w]+|\S/g;

class Tokens {
  constructor(private readonly list: string[]) {}
  get remaining(): string[] {
    return this.list;
  }
  peek(): string {
    const token = this.list[0];
    if (token == null) throw new Error('Unexpected end of input.');
    return token;
  }
  at(i: number): string | undefined {
    return this.list[i];
  }
  shift(): string {
    return this.list.shift() as string;
  }
  ident(): string {
    const token = this.peek();
    if (!identifierRegex.test(token)) throw new Error(`Expected text, got '${token}' instead.`);
    return this.shift();
  }
  op(op: string): string {
    const token = this.peek();
    if (token !== op) throw new Error(`Expected '${op}', got '${token}' instead.`);
    return this.shift();
  }
  maybeOp(op: string): string | null {
    return this.list[0] === op ? this.shift() : null;
  }
}

function parseArray(t: Tokens): TypeNode {
  t.op('[');
  if (t.peek() === ']') throw new Error('Must specify type of Array - eg. [Type], got [] instead.');
  const of = parseTypes(t);
  t.op(']');
  return { structure: 'array', of };
}

function parseTuple(t: Tokens): TypeNode {
  const of: TypeNode[][] = [];
  t.op('(');
  if (t.peek() === ')') throw new Error('Tuple must be of at least length 1 - eg. (Type), got () instead.');
  for (;;) {
    of.push(parseTypes(t));
    t.maybeOp(',');
    if (t.peek() === ')') break;
  }
  t.op(')');
  return { structure: 'tuple', of };
}

function parseFields(t: Tokens): TypeNode {
  // A plain object on purpose: the original stores fields this way, and keys
  // such as "__proto__" behave the same as a result.
  const of: Record<string, TypeNode[]> = {};
  let subset = false;
  t.op('{');
  for (;;) {
    if (t.maybeOp('...')) {
      subset = true;
      break;
    }
    const key = t.ident();
    t.op(':');
    of[key] = parseTypes(t);
    t.maybeOp(',');
    if (t.peek() === '}') break;
  }
  t.op('}');
  return { structure: 'fields', of, subset };
}

function maybeParseStructure(t: Tokens): TypeNode | undefined {
  switch (t.at(0)) {
    case '[':
      return parseArray(t);
    case '(':
      return parseTuple(t);
    case '{':
      return parseFields(t);
  }
  return undefined;
}

function parseType1(t: Tokens): TypeNode {
  const token = t.peek();
  const wildcard = token === '*';
  if (wildcard || identifierRegex.test(token)) {
    const type = wildcard ? t.op('*') : t.ident();
    const structure = maybeParseStructure(t);
    if (structure) {
      (structure as { type?: string }).type = type;
      return structure;
    }
    return { type };
  }
  const structure = maybeParseStructure(t);
  if (!structure) throw new Error(`Unexpected character: ${token}`);
  return structure;
}

function parseTypes(t: Tokens): TypeNode[] {
  if (t.peek() === '::') throw new Error("No comment before comment separator '::' found.");
  const lookahead = t.at(1);
  if (lookahead != null && lookahead === '::') {
    t.shift();
    t.shift();
  }
  let types: TypeNode[] = [];
  // A plain object, like the original, so lookups behave identically.
  let seen: Record<string, boolean> = {};
  if (t.peek() === 'Maybe') {
    t.shift();
    types = [{ type: 'Undefined' }, { type: 'Null' }];
    seen = { Undefined: true, Null: true };
  }
  for (;;) {
    const node = parseType1(t);
    const type = node.type as string;
    if (!seen[type]) types.push(node);
    if (node.structure == null) seen[type] = true;
    if (!t.maybeOp('|')) break;
  }
  return types;
}

export function parseType(input: string): TypeNode[] {
  if (!input.length) throw new Error('No type specified.');
  const tokens: string[] = input.match(tokenRegex) || [];
  if (tokens.includes('->')) {
    throw new Error("Function types are not supported. To validate that something is a function, you may use 'Function'.");
  }
  const t = new Tokens(tokens);
  try {
    return parseTypes(t);
  } catch (e) {
    throw new Error(`${(e as Error).message} - Remaining tokens: ${JSON.stringify(t.remaining)} - Initial input: '${input}'`);
  }
}

// ---------------------------------------------------------------------------
// Checking
// ---------------------------------------------------------------------------

const tagOf = (value: unknown): string => Object.prototype.toString.call(value).slice(8, -1);
const isItNaN = (x: unknown): boolean => x !== x;

// prelude-ls's any and all, inlined: they read `length` and index like this,
// so array-likes and plain objects behave as they did.
function any<T>(f: (x: T) => boolean, xs: ArrayLike<T>): boolean {
  for (let i = 0, len = xs.length; i < len; ++i) if (f(xs[i] as T)) return true;
  return false;
}
function all<T>(f: (x: T) => boolean, xs: ArrayLike<T>): boolean {
  for (let i = 0, len = xs.length; i < len; ++i) if (!f(xs[i] as T)) return false;
  return true;
}

const builtInTypes: Record<string, CustomType> = {
  Number: { typeOf: 'Number', validate: (it) => !isItNaN(it) },
  NaN: { typeOf: 'Number', validate: isItNaN },
  Int: { typeOf: 'Number', validate: (it) => !isItNaN(it) && it % 1 === 0 },
  Float: { typeOf: 'Number', validate: (it) => !isItNaN(it) },
  Date: { typeOf: 'Date', validate: (it) => !isItNaN(it.getTime()) },
};

const defaultType: Record<string, string> = { array: 'Array', tuple: 'Array' };

function checkArray(input: any, node: any, options: Options): boolean {
  return all((it) => checkMultiple(it, node.of, options), input);
}

function checkTuple(input: any, node: any, options: Options): boolean {
  let i = 0;
  for (const types of node.of as TypeNode[][]) {
    if (!checkMultiple(input[i], types, options)) return false;
    i++;
  }
  return input.length <= i;
}

function checkFields(input: any, node: any, options: Options): boolean {
  const inputKeys: Record<string, boolean> = {};
  let numInputKeys = 0;
  for (const k in input) {
    inputKeys[k] = true;
    numInputKeys++;
  }
  let numOfKeys = 0;
  for (const key in node.of) {
    if (!checkMultiple(input[key], node.of[key], options)) return false;
    if (inputKeys[key]) numOfKeys++;
  }
  return node.subset || numInputKeys === numOfKeys;
}

function checkStructure(input: unknown, node: any, options: Options): boolean | undefined {
  if (!(input instanceof Object)) return false;
  switch (node.structure) {
    case 'fields':
      return checkFields(input, node, options);
    case 'array':
      return checkArray(input, node, options);
    case 'tuple':
      return checkTuple(input, node, options);
  }
  return undefined;
}

function check(input: unknown, node: any, options: Options): unknown {
  const { type, structure } = node;
  if (type) {
    if (type === '*') return true;
    const setting = (options.customTypes as any)[type] || (builtInTypes as any)[type];
    if (setting) {
      return (setting.typeOf === undefined || setting.typeOf === tagOf(input)) && setting.validate(input);
    }
    return type === tagOf(input) && (!structure || checkStructure(input, node, options));
  }
  if (structure) {
    const expected = defaultType[structure];
    if (expected && expected !== tagOf(input)) return false;
    return checkStructure(input, node, options);
  }
  throw new Error(`No type defined. Input: ${input}.`);
}

function checkMultiple(input: unknown, types: unknown, options: Options): boolean {
  if (tagOf(types) !== 'Array') throw new Error(`Types must be in an array. Input: ${input}.`);
  return any((node) => check(input, node, options) as boolean, types as TypeNode[]);
}

export function parsedTypeCheck(parsedType: TypeNode[], input: unknown, options?: Options | null): boolean {
  if (options == null) options = {};
  // The original ran in sloppy mode, where setting a property on a primitive
  // is silently ignored. Skip the write for primitives so it fails (or not)
  // in the same place it did.
  if (options.customTypes == null && (typeof options === 'object' || typeof options === 'function')) {
    options.customTypes = {};
  }
  return checkMultiple(input, parsedType, options);
}

export function typeCheck(type: string, input: unknown, options?: Options | null): boolean {
  return parsedTypeCheck(parseType(type), input, options);
}

const typeCheckModule = { VERSION, typeCheck, parsedTypeCheck, parseType };
export default typeCheckModule;
