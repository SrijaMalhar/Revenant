import type { GraveNode, ZombieScore } from '../types.ts';

export interface ZombieOptions {
  /** ISO time the report was scanned at; ages are measured from here */
  scannedAt: string;
  /** packages Revenant can revive */
  ossuary: { name: string; version: string }[];
}

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => n.toLocaleString('en-US');

export function yearsSince(lastRelease: string, scannedAt: string): number {
  const ms = Date.parse(scannedAt) - Date.parse(lastRelease);
  return Number.isFinite(ms) ? Math.max(0, ms / DAY / 365.25) : 0;
}

/**
 * Zombie Index, 0 to 100, from three visible parts:
 *   A, abandonment (max 40): 40 if deprecated, else 40 * min(years, 10) / 10
 *   S, attack surface (max 40): 15 for install scripts, 10 for one maintainer
 *      or fewer, 15 * min(advisories, 3) / 3
 *   R, reach (max 20): 20 * min(log10(max(weekly downloads, 1)) / 9, 1)
 * An unknown maintainer or download count adds 0 and the drawer says so.
 */
export function zombieIndex(node: GraveNode, opts: ZombieOptions): ZombieScore {
  const v = node.vitals;
  const explain: string[] = [];

  const years = v.lastRelease ? yearsSince(v.lastRelease, opts.scannedAt) : 0;
  let abandonment: number;
  if (v.deprecated) {
    abandonment = 40;
    explain.push(`Abandonment +40: deprecated by its maintainers ("${v.deprecated}")`);
  } else {
    abandonment = (40 * Math.min(years, 10)) / 10;
    if (abandonment > 0) {
      explain.push(`Abandonment +${round1(abandonment)}: no release in ${round1(years)} years${years >= 10 ? ' (capped at 10)' : ''}`);
    }
  }

  let attackSurface = 0;
  if (v.installScripts) {
    attackSurface += 15;
    explain.push('Attack surface +15: runs install scripts');
  }
  if (v.maintainers === null) {
    explain.push('Maintainers: unknown, adds 0');
  } else if (v.maintainers <= 1) {
    attackSurface += 10;
    explain.push(`Attack surface +10: ${v.maintainers === 0 ? 'no maintainers listed' : 'a single maintainer account'}`);
  }
  const adv = Math.min(v.advisories.length, 3);
  if (adv > 0) {
    const pts = (15 * adv) / 3;
    attackSurface += pts;
    explain.push(`Attack surface +${round1(pts)}: ${v.advisories.length} open ${v.advisories.length === 1 ? 'advisory' : 'advisories'} (${v.advisories.join(', ')})`);
  }

  let reach = 0;
  if (v.weeklyDownloads === null) {
    explain.push('Weekly downloads: unknown, adds 0');
  } else {
    reach = 20 * Math.min(Math.log10(Math.max(v.weeklyDownloads, 1)) / 9, 1);
    if (reach > 0) explain.push(`Reach +${round1(reach)}: ${fmt(v.weeklyDownloads)} downloads a week`);
  }

  const total = Math.max(0, Math.min(100, Math.round(abandonment + attackSurface + reach)));

  let action: ZombieScore['action'];
  const inOssuary = opts.ossuary.find((o) => o.name === node.name);
  if (node.replacement) {
    action = 'replace';
    explain.push(`e18e lists a maintained replacement: ${node.replacement.replacements.join(', ')}`);
  } else if (inOssuary) {
    action = 'revive';
    if (inOssuary.version !== node.version) {
      explain.push(`Revenant revived ${node.name}@${inOssuary.version}; this tree installs ${node.version}`);
    }
  } else {
    action = 'watch';
  }

  return { total, parts: { abandonment, attackSurface, reach }, action, explain };
}

/** Sort by score, worst first; ties by name so the order never changes between scans. */
export function rankDead(nodes: GraveNode[], opts: ZombieOptions): { node: GraveNode; score: ZombieScore }[] {
  return nodes
    .filter((n) => n.dead)
    .map((node) => ({ node, score: zombieIndex(node, opts) }))
    .sort((a, b) => b.score.total - a.score.total || (a.node.name < b.node.name ? -1 : a.node.name > b.node.name ? 1 : 0));
}
