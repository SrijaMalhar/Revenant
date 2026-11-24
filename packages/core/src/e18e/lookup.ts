import type { Replacement } from '../types.ts';
import data from './data.json' with { type: 'json' };

// Built from e18e's module-replacements manifests by `npm run e18e`.
// Credit: https://github.com/e18e/module-replacements (MIT).
const table = (data as unknown as { table: Record<string, [Replacement['manifest'], string[]]> }).table;

export const E18E_SOURCE = { name: data.source, version: data.version, url: data.url };

export function lookupReplacement(name: string): Replacement | null {
  const hit = Object.prototype.hasOwnProperty.call(table, name) ? table[name] : undefined;
  if (!hit) return null;
  return { manifest: hit[0], replacements: hit[1] };
}
