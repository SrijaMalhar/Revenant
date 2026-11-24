/**
 * npm run cli -- scan <owner/repo | package.json path> [--threshold N] [--json] [--fail-on-new]
 *
 * Prints the graveyard in the terminal from the same @revenant/core the web
 * app uses, and exits 1 when any dead package scores above the threshold,
 * so it works as a CI step.
 */
import { readFile } from 'node:fs/promises';
import { parseScanInput, scan, rankDead } from '../packages/core/src/index.ts';
import type { ScanInput } from '../packages/core/src/types.ts';
import { listOssuary, readManifest } from '../packages/core/src/node/ossuary.ts';

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] !== 'scan' || !argv[1]) {
    console.error('Usage: npm run cli -- scan <owner/repo | package.json path> [--threshold N] [--json]');
    process.exit(2);
  }
  const t = argv.indexOf('--threshold');
  const threshold = t >= 0 ? Number(argv[t + 1]) : 100;
  const input: ScanInput = argv[1].endsWith('.json') ? { kind: 'manifest', packageJson: await readFile(argv[1], 'utf8') } : parseScanInput(argv[1]);
  const report = await scan(input, { fetch, now: () => new Date() });
  const ossuary = await Promise.all((await listOssuary()).map(async (p) => readManifest(p)));
  const ranked = rankDead(report.nodes, { scannedAt: report.scannedAt, ossuary });

  if (argv.includes('--json')) {
    console.log(JSON.stringify({ report, ranked: ranked.map((r) => ({ name: r.node.name, version: r.node.version, ...r.score })) }, null, 2));
  } else {
    console.log(`${report.root.name}: ${report.nodes.length} packages, ${ranked.length} dead${report.truncated ? ' (truncated)' : ''}`);
    for (const { node, score } of ranked) {
      const last = node.vitals.lastRelease.slice(0, 10);
      const action = score.action === 'replace' ? `replace with ${node.replacement!.replacements[0]}` : score.action;
      console.log(`  ${String(score.total).padStart(3)}  ${`${node.name}@${node.version}`.padEnd(40)} last ${last}  ${node.dev ? 'dev ' : 'prod'}  ${action}`);
    }
    for (const e of report.errors) console.log(`  note: ${e.at}: ${e.message}`);
  }
  const over = ranked.filter((r) => r.score.total > threshold);
  process.exit(over.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
