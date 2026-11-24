/**
 * npm run e18e
 *
 * Compacts the e18e module-replacements manifests into a name -> replacement
 * table the scanner bundles: packages/core/src/e18e/data.json.
 * Credit: https://github.com/e18e/module-replacements (MIT).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { repoRoot } from '../packages/core/src/node/ossuary.ts';

const require = createRequire(join(repoRoot, 'packages', 'core', 'package.json'));
const pkgJson = require.resolve('module-replacements/package.json');
const dir = join(dirname(pkgJson), 'manifests');
const version: string = JSON.parse(await readFile(pkgJson, 'utf8')).version;

type Manifest = { mappings: Record<string, { replacements: string[] }>; replacements: Record<string, { type: string; replacementModule?: string; id: string }> };
const ORDER = ['native', 'micro-utilities', 'preferred'] as const;
const table: Record<string, [string, string[]]> = {};

for (const kind of ORDER) {
  const m = JSON.parse(await readFile(join(dir, `${kind}.json`), 'utf8')) as Manifest;
  for (const [name, mapping] of Object.entries(m.mappings).sort(([a], [b]) => a.localeCompare(b))) {
    if (table[name]) continue; // native wins over micro-utilities, which wins over preferred
    const shown = mapping.replacements.map((id) => {
      const r = m.replacements[id];
      if (r?.replacementModule) return r.replacementModule;
      return id.replace(/^snippet::/, '');
    });
    table[name] = [kind, shown];
  }
}

const out = { source: 'e18e module-replacements', version, url: 'https://github.com/e18e/module-replacements', table };
await writeFile(join(repoRoot, 'packages', 'core', 'src', 'e18e', 'data.json'), JSON.stringify(out) + '\n');
console.log(`e18e: ${Object.keys(table).length} packages from module-replacements ${version}`);
