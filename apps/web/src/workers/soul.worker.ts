/// <reference lib="webworker" />
// Runs Soul Match off the main thread so the counter never stutters.
//
// In:  { type: 'run', pkg, target, numRuns, seed }
//      { type: 'ouija', pkg, caseName, text }
//      { type: 'race', sizes }
// Out: { type: 'progress', done, total }  at most 10 times a second
//      { type: 'result', run } | { type: 'ouija-result', ... } | { type: 'race-result', points }
//      { type: 'error', message }
// To cancel, the page terminates this worker and starts a fresh one.
import { FROZEN_NOW, canonical, outcome, runSoulMatch } from '@revenant/core/soul';
import type { Case, Outcome, SoulMatchRun } from '@revenant/core/types';

// Freeze the clock before either module loads. This worker is single-use.
Date.now = () => FROZEN_NOW;

const caseModules = import.meta.glob<{ default: Case<any>[] }>('../../../../ossuary/*/cases.ts');

async function loadCases(pkg: string): Promise<Case<any>[]> {
  const entry = Object.entries(caseModules).find(([path]) => path.endsWith(`/ossuary/${pkg}/cases.ts`));
  if (!entry) throw new Error(`No cases for ${pkg}`);
  return (await entry[1]()).default;
}

async function loadBundle(pkg: string, file: string): Promise<unknown> {
  const url = new URL(`/ossuary/${pkg}/${file}`, self.location.origin).href;
  const mod = (await import(/* @vite-ignore */ url)) as { default?: unknown };
  return mod.default ?? mod;
}

export type Target = 'revived' | 'replay' | `possessed:${string}`;

function bundleFor(target: Target): string {
  if (target === 'revived') return 'revived.js';
  if (target === 'replay') return 'replay.js';
  return `possessed/${target.slice('possessed:'.length)}.js`;
}

export type WorkerIn =
  | { type: 'run'; pkg: string; target: Target; numRuns: number; seed: number }
  | { type: 'ouija'; pkg: string; caseName: string; text: string }
  | { type: 'race'; sizes: number[] };

export type WorkerOut =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; run: SoulMatchRun }
  | { type: 'ouija-result'; input: unknown; original: Outcome; revived: Outcome }
  | { type: 'race-result'; points: { n: number; originalMs: number; revivedMs: number; same: boolean }[] }
  | { type: 'error'; message: string };

const post = (m: WorkerOut) => self.postMessage(m);

async function run(msg: Extract<WorkerIn, { type: 'run' }>) {
  const [original, candidate, cases] = await Promise.all([
    loadBundle(msg.pkg, 'original.js'),
    loadBundle(msg.pkg, bundleFor(msg.target)),
    loadCases(msg.pkg),
  ]);
  let last = 0;
  const result = runSoulMatch({
    pkg: msg.pkg,
    target: msg.target.startsWith('possessed:') ? 'possessed' : (msg.target as 'revived' | 'replay'),
    original,
    candidate,
    cases,
    numRuns: msg.numRuns,
    seed: msg.seed,
    onProgress: (done, total) => {
      const now = performance.now();
      if (now - last >= 100 || done === total) {
        last = now;
        post({ type: 'progress', done, total });
      }
    },
  });
  post({ type: 'result', run: result });
}

async function ouija(msg: Extract<WorkerIn, { type: 'ouija' }>) {
  const [original, revived, cases] = await Promise.all([loadBundle(msg.pkg, 'original.js'), loadBundle(msg.pkg, 'revived.js'), loadCases(msg.pkg)]);
  const c = cases.find((x) => x.name === msg.caseName);
  if (!c) throw new Error(`No case named ${msg.caseName}`);
  const input = c.parse ? c.parse(msg.text) : msg.text;
  post({
    type: 'ouija-result',
    input: canonical(input),
    original: outcome(c, original, input),
    revived: outcome(c, revived, input),
  });
}

async function race(msg: Extract<WorkerIn, { type: 'race' }>) {
  type Mod = { parseDate: (s: string) => unknown };
  const [original, revived] = (await Promise.all([loadBundle('timespan', 'original.js'), loadBundle('timespan', 'revived.js')])) as [Mod, Mod];
  const points = [];
  for (const n of msg.sizes) {
    // The slow-path input is built here and never shown.
    const input = 'NOW+' + '1'.repeat(n) + 'a';
    let t = performance.now();
    const a = original.parseDate(input);
    const originalMs = performance.now() - t;
    t = performance.now();
    const b = revived.parseDate(input);
    const revivedMs = performance.now() - t;
    points.push({ n, originalMs, revivedMs, same: JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)) });
  }
  post({ type: 'race-result', points });
}

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  const job = msg.type === 'run' ? run(msg) : msg.type === 'ouija' ? ouija(msg) : race(msg);
  job.catch((err: unknown) => post({ type: 'error', message: err instanceof Error ? err.message : String(err) }));
};
