export { canonical, canonicalString, decanonical, type Canonical } from './canonical.ts';
export { cloneInput, errorName, outcome, outcomeKey, sameOutcome } from './compare.ts';
export {
  runSoulMatch,
  splitRuns,
  withFrozenClock,
  withFrozenClockAsync,
  FROZEN_NOW,
  type RunSoulMatchOptions,
} from './run.ts';
export { soulprintHash, soulprintLines, shortHash, SOULPRINT_N, SOULPRINT_SEED } from './soulprint.ts';
export { sha256Hex } from './sha256.ts';
export { diffOutcomes, type DiffPart } from './diff.ts';
export { parseLooseValue } from './loose.ts';
