import type { Case, Outcome } from '../types.ts';
import { canonical } from './canonical.ts';

/** structuredClone when possible, so each side gets its own copy of the input. */
export function cloneInput<T>(input: T): T {
  try {
    return structuredClone(input);
  } catch {
    return input;
  }
}

export function errorName(e: unknown): string {
  if (e === null || e === undefined) return String(e);
  try {
    const name = (e as { constructor?: { name?: string } })?.constructor?.name;
    if (typeof name === 'string' && name) return name;
  } catch {
    /* fall through */
  }
  return typeof e;
}

/** Calls one side of a case and captures what it returned or threw. */
export function outcome<I>(c: Case<I>, mod: unknown, input: I): Outcome {
  const arg = cloneInput(input);
  let raw: unknown;
  try {
    raw = c.call(mod, arg);
  } catch (e) {
    return { kind: 'throw', name: errorName(e) };
  }
  // Projection and canonicalisation run outside the module's try, but a
  // projection can still call into the module (a getter, toString), so a
  // throw there is the module throwing too.
  try {
    return { kind: 'ok', value: canonical(c.project ? c.project(raw) : raw) };
  } catch (e) {
    return { kind: 'throw', name: errorName(e) };
  }
}

export function outcomeKey(o: Outcome, compareErrorClass = false): string {
  if (o.kind === 'throw') return compareErrorClass ? `throw:${o.name}` : 'throw';
  return `ok:${JSON.stringify(o.value)}`;
}

/** Same soul: both ok with identical canonical JSON, or both throw. */
export function sameOutcome(a: Outcome, b: Outcome, compareErrorClass = false): boolean {
  return outcomeKey(a, compareErrorClass) === outcomeKey(b, compareErrorClass);
}
