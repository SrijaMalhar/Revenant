import fc from 'fast-check';
import type { Case } from '../types.ts';
import { canonical } from './canonical.ts';
import { outcome } from './compare.ts';
import { sha256Hex } from './sha256.ts';

export const SOULPRINT_SEED = 42;
export const SOULPRINT_N = 10_000;

/**
 * One line per input: JSON.stringify([caseName, canonical(input), outcome]).
 * A fixed case (no varying input) contributes one line, not n identical ones.
 * Computed once for the original and once for the revived package; equal
 * hashes mean equal behaviour on the same 10,000 inputs per case.
 */
export function soulprintLines(mod: unknown, cases: Case<any>[], seed = SOULPRINT_SEED, n = SOULPRINT_N): string[] {
  const lines: string[] = [];
  for (const c of cases) {
    const inputs = fc.sample(c.arbitrary, { seed, numRuns: c.fixed ? 1 : n });
    for (const input of inputs) {
      lines.push(JSON.stringify([c.name, canonical(input), outcome(c, mod, input)]));
    }
  }
  return lines;
}

export function soulprintHash(mod: unknown, cases: Case<any>[], seed = SOULPRINT_SEED, n = SOULPRINT_N): string {
  return sha256Hex(soulprintLines(mod, cases, seed, n).join('\n'));
}

/** "3f2a…c9" style short form used on badges. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 4)}…${hash.slice(-2)}`;
}
