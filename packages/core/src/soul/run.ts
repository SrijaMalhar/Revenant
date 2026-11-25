import fc from 'fast-check';
import type { Case, Outcome, SoulMatchRun } from '../types.ts';
import { outcome, sameOutcome } from './compare.ts';

export interface RunSoulMatchOptions {
  pkg: string;
  target?: SoulMatchRun['target'];
  original: unknown;
  candidate: unknown;
  cases: Case<any>[];
  numRuns: number;
  seed: number;
  /** called as runs complete; callers throttle what they show */
  onProgress?: (done: number, total: number) => void;
  /** regression corpus: inputs per case name that always run first */
  examples?: Record<string, unknown[]>;
  /** restrict to one case, e.g. to replay a failure */
  onlyCase?: string;
  /** fast-check path to replay one specific failure */
  path?: string;
  /** clock for the elapsed time; injected so tests stay deterministic */
  clock?: () => number;
}

/**
 * Splits numRuns across cases. A fixed case (no varying input) gets exactly
 * one run; the rest are split evenly over the cases with real inputs, the
 * first few getting the remainder. The total is always numRuns.
 */
export function splitRuns(numRuns: number, n: number, fixed: boolean[] = []): number[] {
  if (n === 0) return [];
  const isFixed = (i: number) => fixed[i] === true;
  const nFixed = Array.from({ length: n }, (_, i) => i).filter(isFixed).length;
  const varying = n - nFixed;
  if (varying === 0) {
    const base = Math.floor(numRuns / n);
    const rest = numRuns - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
  }
  const fixedRuns = Math.min(nFixed, numRuns);
  const pool = numRuns - fixedRuns;
  const base = Math.floor(pool / varying);
  let rest = pool - base * varying;
  let fixedLeft = fixedRuns;
  return Array.from({ length: n }, (_, i) => {
    if (isFixed(i)) {
      if (fixedLeft === 0) return 0;
      fixedLeft--;
      return 1;
    }
    const extra = rest > 0 ? 1 : 0;
    rest -= extra;
    return base + extra;
  });
}

const PROGRESS_EVERY = 250;

export function runSoulMatch(opts: RunSoulMatchOptions): SoulMatchRun {
  const clock = opts.clock ?? (() => performance.now());
  const started = clock();
  const cases = opts.onlyCase ? opts.cases.filter((c) => c.name === opts.onlyCase) : opts.cases;
  if (opts.onlyCase && cases.length === 0) throw new Error(`No case named "${opts.onlyCase}"`);
  const shares = splitRuns(opts.numRuns, cases.length, cases.map((c) => c.fixed === true));
  const total = shares.reduce((a, b) => a + b, 0);
  const perCase: NonNullable<SoulMatchRun['perCase']> = [];
  let done = 0;

  const base: SoulMatchRun = {
    pkg: opts.pkg,
    target: opts.target ?? 'revived',
    seed: opts.seed,
    numRuns: total,
    done: 0,
    status: 'running',
    millis: 0,
  };

  for (let ci = 0; ci < cases.length; ci++) {
    const c = cases[ci]!;
    const runs = shares[ci]!;
    if (runs === 0) continue;
    let caseRuns = 0;
    let skipped = 0;
    let shrinking = false;

    const predicate = (input: unknown): boolean => {
      if (!shrinking) {
        caseRuns++;
        done++;
        if (done % PROGRESS_EVERY === 0) opts.onProgress?.(done, total);
      }
      if (c.allow?.(input)) {
        skipped++;
        return true;
      }
      const a = outcome(c, opts.original, input);
      const b = outcome(c, opts.candidate, input);
      const same = sameOutcome(a, b, c.compareErrorClass);
      if (!same) shrinking = true;
      return same;
    };

    const examples = (opts.examples?.[c.name] ?? []).map((x) => [x] as [unknown]);
    const details = fc.check(fc.property(c.arbitrary, predicate), {
      numRuns: runs,
      seed: opts.seed,
      // fast-check stops at the first failure on its own. endOnFailure would
      // also skip shrinking, and the shrunk input is the whole point here.
      verbose: 1,
      examples,
      ...(opts.path ? { path: opts.path } : {}),
    });

    perCase.push({ name: c.name, runs: caseRuns, skipped });

    if (details.failed) {
      if (details.counterexample === null) {
        return {
          ...base,
          done,
          perCase,
          status: 'error',
          error: String((details.errorInstance as { message?: string } | null)?.message ?? details.errorInstance),
          millis: Math.round(clock() - started),
        };
      }
      const input = details.counterexample[0];
      const original: Outcome = outcome(c, opts.original, input);
      const candidate: Outcome = outcome(c, opts.candidate, input);
      opts.onProgress?.(done, total);
      return {
        ...base,
        done,
        perCase,
        status: 'diverged',
        divergence: {
          caseName: c.name,
          input,
          original,
          candidate,
          shrinks: details.numShrinks,
          path: details.failures.map((f) => (f as [unknown])[0]),
          counterexamplePath: details.counterexamplePath ?? undefined,
          runSeed: details.seed,
        },
        millis: Math.round(clock() - started),
      };
    }
  }

  opts.onProgress?.(done, total);
  return { ...base, done, perCase, status: 'same-soul', millis: Math.round(clock() - started) };
}

/** Date.now frozen at 2026-01-01T00:00:00Z, the instant every run uses. */
export const FROZEN_NOW = 1767225600000;

/** Runs fn with Date.now frozen, then restores it. */
export function withFrozenClock<T>(fn: () => T, at = FROZEN_NOW): T {
  const real = Date.now;
  Date.now = () => at;
  try {
    return fn();
  } finally {
    Date.now = real;
  }
}

export async function withFrozenClockAsync<T>(fn: () => Promise<T>, at = FROZEN_NOW): Promise<T> {
  const real = Date.now;
  Date.now = () => at;
  try {
    return await fn();
  } finally {
    Date.now = real;
  }
}
