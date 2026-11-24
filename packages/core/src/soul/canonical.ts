/**
 * Turns any value into plain JSON so two results can be compared as strings.
 *
 *   undefined        -> {"$u":1}
 *   NaN / -0         -> {"$nan":1} / {"$neg0":1}
 *   +-Infinity       -> {"$inf":1} / {"$inf":-1}   (JSON would turn these into null)
 *   bigint           -> {"$big":"123"}
 *   symbol           -> {"$sym":"description"}
 *   Date             -> {"$date": getTime()} or {"$date":"invalid"}
 *   RegExp           -> {"$re": source, "flags": flags}
 *   array            -> canonical elements, holes become undefined
 *   Map / Set        -> {"$map": [[k, v]...]} / {"$set": [...]}
 *   object           -> own enumerable string keys, sorted, canonical values,
 *                       constructor name kept as "$c" when it isn't Object
 *   function         -> {"$fn": name}
 *   cycle            -> {"$cycle":1}
 *
 * Object keys that start with "$" get one more "$" so they can't collide with
 * the markers above.
 */
export type Canonical = null | boolean | number | string | Canonical[] | { [k: string]: Canonical };

export function canonical(value: unknown): Canonical {
  return walk(value, []);
}

function walk(v: unknown, stack: object[]): Canonical {
  switch (typeof v) {
    case 'undefined':
      return { $u: 1 };
    case 'boolean':
    case 'string':
      return v;
    case 'number':
      if (Number.isNaN(v)) return { $nan: 1 };
      if (v === 0 && 1 / v < 0) return { $neg0: 1 };
      if (v === Infinity) return { $inf: 1 };
      if (v === -Infinity) return { $inf: -1 };
      return v;
    case 'bigint':
      return { $big: v.toString() };
    case 'symbol':
      return { $sym: v.description ?? '' };
    case 'function':
      return { $fn: (v as { name?: string }).name ?? '' };
  }
  if (v === null) return null;
  const obj = v as object;
  if (stack.includes(obj)) return { $cycle: 1 };

  if (obj instanceof Date) {
    const t = obj.getTime();
    return { $date: Number.isNaN(t) ? 'invalid' : t };
  }
  if (obj instanceof RegExp) return { $re: obj.source, flags: obj.flags };

  stack.push(obj);
  try {
    if (Array.isArray(obj)) {
      const out: Canonical[] = [];
      for (let i = 0; i < obj.length; i++) out.push(walk(obj[i], stack));
      return out;
    }
    if (obj instanceof Map) {
      return { $map: [...obj.entries()].map(([k, val]) => [walk(k, stack), walk(val, stack)]) };
    }
    if (obj instanceof Set) {
      return { $set: [...obj.values()].map((val) => walk(val, stack)) };
    }
    const out: { [k: string]: Canonical } = {};
    const proto = Object.getPrototypeOf(obj);
    const ctor = proto === null ? 'null' : ctorName(obj);
    if (ctor !== 'Object') out.$c = ctor;
    for (const key of Object.keys(obj).sort()) {
      out[key.startsWith('$') ? `$${key}` : key] = walk((obj as Record<string, unknown>)[key], stack);
    }
    return out;
  } finally {
    stack.pop();
  }
}

function ctorName(obj: object): string {
  try {
    const c = (obj as { constructor?: unknown }).constructor;
    if (typeof c === 'function') return c.name || 'anonymous';
    return typeof c === 'undefined' ? 'undefined' : 'non-function';
  } catch {
    return 'unreadable';
  }
}

/** Stable string for a value, used for comparisons and hashing. */
export function canonicalString(value: unknown): string {
  return JSON.stringify(canonical(value));
}
