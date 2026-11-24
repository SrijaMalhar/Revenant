import type { Outcome, SoulMatchRun } from '../../packages/core/src/types.ts';

function show(o: Outcome): string {
  return o.kind === 'throw' ? `throws ${o.name}` : `returns ${JSON.stringify(o.value)}`;
}

export function formatRun(run: SoulMatchRun): string {
  const head = `${run.pkg} (${run.target}) seed ${run.seed}: ${run.done.toLocaleString('en-US')} of ${run.numRuns.toLocaleString('en-US')} inputs, ${run.millis} ms`;
  if (run.status === 'same-soul') return `${head}\nsame soul`;
  if (run.status === 'error') return `${head}\nerror: ${run.error}`;
  const d = run.divergence!;
  return [
    head,
    `DIVERGED in ${d.caseName} after ${d.shrinks} shrink steps`,
    `  input     ${JSON.stringify(d.input)}`,
    `  original  ${show(d.original)}`,
    `  candidate ${show(d.candidate)}`,
    `  replay    npm run soul -- ${run.pkg} --target ${run.target} --case "${d.caseName}" --seed ${d.runSeed} --path ${d.counterexamplePath}`,
  ].join('\n');
}
