var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// ossuary/type-check/revived/src/index.ts
var VERSION = "0.4.0";
var identifierRegex = /[$\w]+/;
var tokenRegex = /\.\.\.|::|->|[$\w]+|\S/g;
var Tokens = class {
  constructor(list) {
    __publicField(this, "list", list);
  }
  get remaining() {
    return this.list;
  }
  peek() {
    const token = this.list[0];
    if (token == null) throw new Error("Unexpected end of input.");
    return token;
  }
  at(i) {
    return this.list[i];
  }
  shift() {
    return this.list.shift();
  }
  ident() {
    const token = this.peek();
    if (!identifierRegex.test(token)) throw new Error(`Expected text, got '${token}' instead.`);
    return this.shift();
  }
  op(op) {
    const token = this.peek();
    if (token !== op) throw new Error(`Expected '${op}', got '${token}' instead.`);
    return this.shift();
  }
  maybeOp(op) {
    return this.list[0] === op ? this.shift() : null;
  }
};
function parseArray(t) {
  t.op("[");
  if (t.peek() === "]") throw new Error("Must specify type of Array - eg. [Type], got [] instead.");
  const of = parseTypes(t);
  t.op("]");
  return { structure: "array", of };
}
function parseTuple(t) {
  const of = [];
  t.op("(");
  if (t.peek() === ")") throw new Error("Tuple must be of at least length 1 - eg. (Type), got () instead.");
  for (; ; ) {
    of.push(parseTypes(t));
    t.maybeOp(",");
    if (t.peek() === ")") break;
  }
  t.op(")");
  return { structure: "tuple", of };
}
function parseFields(t) {
  const of = {};
  let subset = false;
  t.op("{");
  for (; ; ) {
    if (t.maybeOp("...")) {
      subset = true;
      break;
    }
    const key = t.ident();
    t.op(":");
    of[key] = parseTypes(t);
    t.maybeOp(",");
    if (t.peek() === "}") break;
  }
  t.op("}");
  return { structure: "fields", of, subset };
}
function maybeParseStructure(t) {
  switch (t.at(0)) {
    case "[":
      return parseArray(t);
    case "(":
      return parseTuple(t);
    case "{":
      return parseFields(t);
  }
  return void 0;
}
function parseType1(t) {
  const token = t.peek();
  const wildcard = token === "*";
  if (wildcard || identifierRegex.test(token)) {
    const type = wildcard ? t.op("*") : t.ident();
    const structure2 = maybeParseStructure(t);
    if (structure2) {
      structure2.type = type;
      return structure2;
    }
    return { type };
  }
  const structure = maybeParseStructure(t);
  if (!structure) throw new Error(`Unexpected character: ${token}`);
  return structure;
}
function parseTypes(t) {
  if (t.peek() === "::") throw new Error("No comment before comment separator '::' found.");
  const lookahead = t.at(1);
  if (lookahead != null && lookahead === "::") {
    t.shift();
    t.shift();
  }
  let types = [];
  let seen = {};
  if (t.peek() === "Maybe") {
    t.shift();
    types = [{ type: "Undefined" }, { type: "Null" }];
    seen = { Undefined: true, Null: true };
  }
  for (; ; ) {
    const node = parseType1(t);
    const type = node.type;
    if (!seen[type]) types.push(node);
    if (node.structure == null) seen[type] = true;
    if (!t.maybeOp("|")) break;
  }
  return types;
}
function parseType(input) {
  if (!input.length) throw new Error("No type specified.");
  const tokens = input.match(tokenRegex) || [];
  if (tokens.includes("->")) {
    throw new Error("Function types are not supported. To validate that something is a function, you may use 'Function'.");
  }
  const t = new Tokens(tokens);
  try {
    return parseTypes(t);
  } catch (e) {
    throw new Error(`${e.message} - Remaining tokens: ${JSON.stringify(t.remaining)} - Initial input: '${input}'`);
  }
}
var tagOf = (value) => Object.prototype.toString.call(value).slice(8, -1);
var isItNaN = (x) => x !== x;
function any(f, xs) {
  for (let i = 0, len = xs.length; i < len; ++i) if (f(xs[i])) return true;
  return false;
}
function all(f, xs) {
  for (let i = 0, len = xs.length; i < len; ++i) if (!f(xs[i])) return false;
  return true;
}
var builtInTypes = {
  Number: { typeOf: "Number", validate: (it) => !isItNaN(it) },
  NaN: { typeOf: "Number", validate: isItNaN },
  Int: { typeOf: "Number", validate: (it) => !isItNaN(it) && it % 1 === 0 },
  Float: { typeOf: "Number", validate: (it) => !isItNaN(it) },
  Date: { typeOf: "Date", validate: (it) => !isItNaN(it.getTime()) }
};
var defaultType = { array: "Array", tuple: "Array" };
function checkArray(input, node, options) {
  return all((it) => checkMultiple(it, node.of, options), input);
}
function checkTuple(input, node, options) {
  let i = 0;
  for (const types of node.of) {
    if (!checkMultiple(input[i], types, options)) return false;
    i++;
  }
  return input.length <= i;
}
function checkFields(input, node, options) {
  const inputKeys = {};
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
function checkStructure(input, node, options) {
  if (!(input instanceof Object)) return false;
  switch (node.structure) {
    case "fields":
      return checkFields(input, node, options);
    case "array":
      return checkArray(input, node, options);
    case "tuple":
      return checkTuple(input, node, options);
  }
  return void 0;
}
function check(input, node, options) {
  const { type, structure } = node;
  if (type) {
    if (type === "*") return true;
    const setting = options.customTypes[type] || builtInTypes[type];
    if (setting) {
      return (setting.typeOf === void 0 || setting.typeOf === tagOf(input)) && setting.validate(input);
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
function checkMultiple(input, types, options) {
  if (tagOf(types) !== "Array") throw new Error(`Types must be in an array. Input: ${input}.`);
  return any((node) => check(input, node, options), types);
}
function parsedTypeCheck(parsedType, input, options) {
  if (options == null) options = {};
  if (options.customTypes == null && (typeof options === "object" || typeof options === "function")) {
    options.customTypes = {};
  }
  return checkMultiple(input, parsedType, options);
}
function typeCheck(type, input, options) {
  return parsedTypeCheck(parseType(type), input, options);
}
var typeCheckModule = { VERSION, typeCheck, parsedTypeCheck, parseType };
var index_default = typeCheckModule;
export {
  VERSION,
  index_default as default,
  parseType,
  parsedTypeCheck,
  typeCheck
};
