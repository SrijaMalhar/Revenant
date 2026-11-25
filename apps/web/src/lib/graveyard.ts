import type { GraveNode, ZombieScore } from '@revenant/core/types';
import { yearsSince } from '@revenant/core/zombie';
import { compact } from './format.ts';

// Every visual property of a tombstone encodes something true about the package.
export interface Decoration {
  heightYears: number; // years since last release, capped at 10
  cracked: boolean; // at least one open advisory
  chained: boolean; // install scripts present
  band: Band; // the Zombie Index band, shown as a color and a word
  fog: 'clear' | 'thick'; // thick = Revenant couldn't fully read its data
}

export type Band = 'low' | 'medium' | 'high';

/** 60 and up is high, 40 to 59 medium, below 40 low. */
export function band(total: number): Band {
  return total >= 60 ? 'high' : total >= 40 ? 'medium' : 'low';
}

export function decorate(node: GraveNode, scannedAt: string, score: ZombieScore): Decoration {
  return {
    heightYears: Math.min(10, yearsSince(node.vitals.lastRelease, scannedAt)),
    cracked: node.vitals.advisories.length > 0,
    chained: node.vitals.installScripts,
    band: band(score.total),
    fog: node.incomplete ? 'thick' : 'clear',
  };
}

/** Rule-picked cause of death for the certificate. Describes the package, never a person. */
export function causeOfDeath(node: GraveNode, scannedAt: string): { cause: string; factors: string[] } {
  const v = node.vitals;
  const y = Math.floor(yearsSince(v.lastRelease, scannedAt));
  const cause = v.deprecated ? 'Deprecated by its maintainers' : `No release in ${y} ${y === 1 ? 'year' : 'years'}`;
  const factors: string[] = [];
  if (v.maintainers !== null && v.maintainers <= 1) factors.push('A single maintainer account');
  if (v.installScripts) factors.push('Runs install scripts');
  if (v.advisories.length) factors.push(`${v.advisories.length} open ${v.advisories.length === 1 ? 'advisory' : 'advisories'}`);
  return { cause, factors };
}

// ---------- epitaphs ----------
//
// One line under each tombstone, filled with real numbers. Each template names
// the rule that picks it; the first rule that fits a package wins.
// Placeholders: {name} {weekly} {weeklyShort} {year} {years} {advisories}
export interface EpitaphTemplate {
  id: string;
  when: 'deprecated' | 'advisories' | 'install-scripts' | 'high-reach' | 'single-maintainer' | 'any';
  text: string;
}
export const EPITAPHS: EpitaphTemplate[] = [
  { id: 'deprecated-installs', when: 'deprecated', text: 'Deprecated by its own maintainers, still installed {weeklyShort} times a week.' },
  { id: 'deprecated-goodbye', when: 'deprecated', text: "Its maintainers said goodbye. The installs didn't stop." },
  { id: 'advisory-no-patch', when: 'advisories', text: 'Has a known security hole and no one left to patch it.' },
  { id: 'advisory-since', when: 'advisories', text: 'Open advisories, and no release since {year}.' },
  { id: 'install-script', when: 'install-scripts', text: "Still runs a script every time it's installed." },
  { id: 'reach-since', when: 'high-reach', text: 'Still installed {weeklyShort} times a week. Nobody has published since {year}.' },
  { id: 'reach-old-release', when: 'high-reach', text: '{weeklyShort} installs a week, all of a release from {year}.' },
  { id: 'reach-years-quiet', when: 'high-reach', text: '{years} years quiet, and still {weeklyShort} installs a week.' },
  { id: 'one-account', when: 'single-maintainer', text: 'One maintainer account, quiet since {year}.' },
  { id: 'last-heard', when: 'any', text: 'Last heard from in {year}.' },
];

const RULE_ORDER: EpitaphTemplate['when'][] = ['deprecated', 'advisories', 'install-scripts', 'high-reach', 'single-maintainer', 'any'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function matches(when: EpitaphTemplate['when'], node: GraveNode): boolean {
  const v = node.vitals;
  switch (when) {
    case 'deprecated':
      return Boolean(v.deprecated);
    case 'advisories':
      return v.advisories.length > 0;
    case 'install-scripts':
      return v.installScripts;
    case 'high-reach':
      return (v.weeklyDownloads ?? 0) >= 10_000_000;
    case 'single-maintainer':
      return v.maintainers !== null && v.maintainers <= 1;
    default:
      return true;
  }
}

/** Picks the first rule that applies; ties within a rule broken by a hash of the name, so it never changes between scans. */
export function epitaph(node: GraveNode, scannedAt: string, templates: EpitaphTemplate[] = EPITAPHS): { template: string; text: string } | null {
  for (const rule of RULE_ORDER) {
    const pool = templates.filter((t) => t.when === rule);
    if (!pool.length || !matches(rule, node)) continue;
    const t = pool[hash(node.name) % pool.length]!;
    const v = node.vitals;
    const fill: Record<string, string> = {
      name: node.name,
      weekly: v.weeklyDownloads === null ? 'unknown' : v.weeklyDownloads.toLocaleString('en-US'),
      weeklyShort: v.weeklyDownloads === null ? 'unknown' : compact(v.weeklyDownloads),
      year: String(new Date(v.lastRelease).getUTCFullYear()),
      years: String(Math.floor(yearsSince(v.lastRelease, scannedAt))),
      advisories: String(v.advisories.length),
    };
    return { template: t.id, text: t.text.replace(/\{(\w+)\}/g, (_, k: string) => fill[k] ?? `{${k}}`) };
  }
  return null;
}
