/**
 * npm run soul -- <pkg> [--runs N] [--seed S] [--target revived|replay|possessed:<id>]
 *                       [--case NAME --path P] [--json] [--stable]
 *
 * Soul Match in Node: runs the original and the target side by side and
 * prints "same soul" or the shrunk counterexample. Exits 1 on a divergence.
 */
process.env.TZ = 'UTC';

import { runSoulMatch, FROZEN_NOW } from '../packages/core/src/soul/index.ts';
import {
  loadCases,
  loadOriginal,
  loadRegressionCorpus,
  loadTarget,
  withBuildEnv,
  type Target,
} from '../packages/core/src/node/ossuary.ts';
import { formatRun } from './lib/format.ts';

export interface SoulArgs {
  pkg: string;
  runs: number;
  seed: number;
  target: Target;
  onlyCase?: string;
  path?: string;
  json: boolean;
  stable: boolean;
}

export function parseSoulArgs(argv: string[]): SoulArgs {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const pkg = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
  if (!pkg) throw new Error('Usage: npm run soul -- <pkg> [--runs N] [--seed S] [--target revived|replay|possessed:<id>]');
  const seedArg = get('--seed');
  return {
    pkg,
    runs: Number(get('--runs') ?? 100_000),
    seed: seedArg === undefined || seedArg === 'random' ? Math.floor(Math.random() * 2 ** 31) : Number(seedArg),
    target: (get('--target') ?? 'revived') as Target,
    onlyCase: get('--case'),
    path: get('--path'),
    json: argv.includes('--json'),
    stable: argv.includes('--stable'),
  };
}

export async function soul(args: SoulArgs) {
  // Freeze the clock before either module loads, and keep it frozen for the run.
  const realNow = Date.now;
  Date.now = () => FROZEN_NOW;
  try {
    return await withBuildEnv(args.pkg, async () => {
      const [original, candidate, cases, examples] = await Promise.all([
        loadOriginal(args.pkg),
        loadTarget(args.pkg, args.target),
        loadCases(args.pkg),
        loadRegressionCorpus(args.pkg),
      ]);
      const run = runSoulMatch({
        pkg: args.pkg,
        target: args.target.startsWith('possessed:') ? 'possessed' : (args.target as 'revived' | 'replay'),
        original,
        candidate,
        cases,
        numRuns: args.runs,
        seed: args.seed,
        examples,
        onlyCase: args.onlyCase,
        path: args.path,
        clock: args.stable ? () => 0 : undefined,
      });
      return run;
    });
  } finally {
    Date.now = realNow;
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = parseSoulArgs(process.argv.slice(2));
  soul(args)
    .then((run) => {
      console.log(args.json ? JSON.stringify(run) : formatRun(run));
      process.exit(run.status === 'same-soul' ? 0 : 1);
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.stack : e);
      process.exit(2);
    });
}
