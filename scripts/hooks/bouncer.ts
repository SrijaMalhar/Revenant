/**
 * Hook command for Pre Tool Use on package installs (the bouncer):
 *   tsx scripts/hooks/bouncer.ts [--threshold 50] < {"tool_input": {"command": "npm install foo"}}
 *
 * Scans the packages being installed and blocks any that are dead with a
 * Zombie Index at or above the threshold, with a one-line reason each.
 * Exits 2 to block, 0 to allow.
 */
import { rankDead, scan } from '../../packages/core/src/index.ts';
import { listOssuary, readManifest } from '../../packages/core/src/node/ossuary.ts';
import { pathsIn } from './oracle-guard.ts';

/** Package names from npm/yarn/pnpm install commands, versions stripped. */
export function packagesFrom(command: string): string[] {
  const out: string[] = [];
  for (const part of command.split(/&&|;|\|\|/)) {
    const words = part.trim().split(/\s+/);
    const i = words.findIndex((w, k) => ['npm', 'pnpm', 'yarn', 'bun'].includes(w) && ['i', 'install', 'add'].includes(words[k + 1] ?? ''));
    if (i === -1) continue;
    for (const w of words.slice(i + 2)) {
      if (w.startsWith('-') || !w) continue;
      const at = w.lastIndexOf('@');
      out.push(at > 0 ? w.slice(0, at) : w);
    }
  }
  return [...new Set(out)];
}

async function main() {
  const t = process.argv.indexOf('--threshold');
  const threshold = t >= 0 ? Number(process.argv[t + 1]) : 50;
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input: unknown = raw;
  try {
    input = JSON.parse(raw).tool_input;
  } catch {
    /* plain text command */
  }
  const names = [...new Set(pathsIn(input).flatMap(packagesFrom))];
  if (!names.length) return;
  const manifest = JSON.stringify({ name: 'bouncer', dependencies: Object.fromEntries(names.map((n) => [n, '*'])) });
  const report = await scan({ kind: 'manifest', packageJson: manifest }, { fetch, now: () => new Date() });
  const ossuary = await Promise.all((await listOssuary()).map((p) => readManifest(p)));
  const blocked = rankDead(report.nodes.filter((n) => n.depth === 0), { scannedAt: report.scannedAt, ossuary }).filter((r) => r.score.total >= threshold);
  for (const { node, score } of blocked) {
    const advice = score.action === 'replace' ? `use ${node.replacement!.replacements[0]} instead` : score.action === 'revive' ? 'use the revived copy from the Ossuary' : 'find a maintained alternative';
    console.error(`Blocked ${node.name}: Zombie Index ${score.total}, no release since ${node.vitals.lastRelease.slice(0, 10)}; ${advice}.`);
  }
  process.exit(blocked.length ? 2 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    // Never block an install because the bouncer itself failed.
    console.error(`bouncer: ${e instanceof Error ? e.message : e}; letting the install through.`);
    process.exit(0);
  });
}
