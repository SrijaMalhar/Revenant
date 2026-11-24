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
        /** true when this side has nothing at this path */
        originalMissing?: boolean;
        candidateMissing?: boolean;
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
    for (const [i, j] of alignArrays(x, y)) {
      if (i !== null && j !== null) walk(x[i], y[j], `${path}[${i}]`, out);
      else if (i !== null) out.push({ path: `${path}[${i}]`, original: x[i], candidate: null, candidateMissing: true });
      else out.push({ path: `${path}[${j}]`, original: null, candidate: y[j!], originalMissing: true });
    }
    return;
  }
  if (isObj(x) && isObj(y) && !isMarker(x) && !isMarker(y)) {
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].sort();
    for (const k of keys) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in x)) out.push({ path: p, original: null, candidate: y[k], originalMissing: true });
      else if (!(k in y)) out.push({ path: p, original: x[k], candidate: null, candidateMissing: true });
      else walk(x[k], y[k], p, out);
    }
    return;
  }
  const entry: Extract<DiffPart, { type: 'value' }>['paths'][number] = { path: path || '(value)', original: x, candidate: y };
  if (typeof x === 'string' && typeof y === 'string') entry.chars = charSplit(x, y);
  out.push(entry);
}

/**
 * Lines up two arrays so one inserted or dropped element reads as one
 * difference, not as every later index changing. Equal elements are matched
 * by longest common subsequence; unmatched ones in the same gap are paired
 * in order and compared; the rest are reported as missing on one side.
 */
export function alignArrays(x: unknown[], y: unknown[]): [number | null, number | null][] {
  const n = x.length;
  const m = y.length;
  if (n * m > 4000) return Array.from({ length: Math.max(n, m) }, (_, i) => [i < n ? i : null, i < m ? i : null]);
  const xs = x.map((v) => JSON.stringify(v));
  const ys = y.map((v) => JSON.stringify(v));
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = xs[i] === ys[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: [number | null, number | null][] = [];
  let gapX: number[] = [];
  let gapY: number[] = [];
  const flush = () => {
    const k = Math.min(gapX.length, gapY.length);
    for (let t = 0; t < k; t++) out.push([gapX[t]!, gapY[t]!]);
    for (const i of gapX.slice(k)) out.push([i, null]);
    for (const j of gapY.slice(k)) out.push([null, j]);
    gapX = [];
    gapY = [];
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (xs[i] === ys[j]) {
      flush();
      out.push([i++, j++]);
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) gapX.push(i++);
    else gapY.push(j++);
  }
  while (i < n) gapX.push(i++);
  while (j < m) gapY.push(j++);
  flush();
  return out;
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
