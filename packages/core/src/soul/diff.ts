import type { Outcome } from '../types.ts';

/**
 * Where two outcomes differ, for the séance diff view.
 *
 * - 'kind': one side returned and the other threw
 * - 'throw': both threw, with different error classes
 * - 'value': both returned; `paths` lists every differing location in the
 *   canonical values, and string leaves carry a character-level split
 */
export type DiffPart =
  | { type: 'same' }
  | { type: 'kind'; original: string; candidate: string }
  | { type: 'throw'; original: string; candidate: string }
  | {
      type: 'value';
      paths: {
        path: string;
        original: unknown;
        candidate: unknown;
        chars?: { prefix: string; original: string; candidate: string; suffix: string };
      }[];
    };

const MAX_PATHS = 20;

export function diffOutcomes(a: Outcome, b: Outcome): DiffPart {
  if (a.kind !== b.kind) {
    return { type: 'kind', original: describe(a), candidate: describe(b) };
  }
  if (a.kind === 'throw' && b.kind === 'throw') {
    return a.name === b.name ? { type: 'same' } : { type: 'throw', original: a.name, candidate: b.name };
  }
  const paths: Extract<DiffPart, { type: 'value' }>['paths'] = [];
  walk((a as { value: unknown }).value, (b as { value: unknown }).value, '', paths);
  return paths.length === 0 ? { type: 'same' } : { type: 'value', paths };
}

function describe(o: Outcome): string {
  return o.kind === 'throw' ? `threw ${o.name}` : 'returned a value';
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function walk(x: unknown, y: unknown, path: string, out: Extract<DiffPart, { type: 'value' }>['paths']): void {
  if (out.length >= MAX_PATHS) return;
  if (JSON.stringify(x) === JSON.stringify(y)) return;
  if (Array.isArray(x) && Array.isArray(y)) {
    const n = Math.max(x.length, y.length);
    for (let i = 0; i < n; i++) {
      if (i >= x.length || i >= y.length) {
        out.push({ path: `${path}[${i}]`, original: i < x.length ? x[i] : '(missing)', candidate: i < y.length ? y[i] : '(missing)' });
      } else walk(x[i], y[i], `${path}[${i}]`, out);
    }
    return;
  }
  if (isObj(x) && isObj(y) && !isMarker(x) && !isMarker(y)) {
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].sort();
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in x) || !(k in y)) {
        out.push({ path: p, original: k in x ? x[k] : '(missing)', candidate: k in y ? y[k] : '(missing)' });
      } else walk(x[k], y[k], p, out);
    }
    return;
  }
  const entry: Extract<DiffPart, { type: 'value' }>['paths'][number] = { path: path || '(value)', original: x, candidate: y };
  if (typeof x === 'string' && typeof y === 'string') entry.chars = charSplit(x, y);
  out.push(entry);
}

/** canonical()'s special markers ({"$nan":1}, {"$date":…}) are leaves, not structures. */
function isMarker(v: Record<string, unknown>): boolean {
  const keys = Object.keys(v);
  return keys.length > 0 && keys.length <= 2 && keys.every((k) => /^\$[a-z0-9]+$/.test(k) || k === 'flags') && !('$c' in v);
}

export function charSplit(a: string, b: string): { prefix: string; original: string; candidate: string; suffix: string } {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return {
    prefix: a.slice(0, p),
    original: a.slice(p, a.length - s),
    candidate: b.slice(p, b.length - s),
    suffix: a.slice(a.length - s),
  };
}
