/**
 * npm run released -- [<pkg>...]
 *
 * Reads each Ossuary package's publish history from the npm registry and
 * records its first and last release in manifest.released, so the site's
 * Ossuary table never shows a date that nobody looked up.
 */
process.env.TZ = 'UTC';

import { listPackages, today, updateManifest } from './lib/ossuary.ts';

async function main() {
  const named = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const pkgs = named.length ? named : await listPackages();
  const checkedAt = today();
  for (const pkg of pkgs) {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
    if (!res.ok) throw new Error(`${pkg}: the registry answered ${res.status}`);
    const doc = (await res.json()) as { time: Record<string, string>; versions: Record<string, unknown> };
    // "created" and "modified" are document timestamps, not releases.
    const times = Object.keys(doc.versions)
      .map((v) => doc.time[v])
      .filter((t): t is string => typeof t === 'string')
      .sort();
    if (!times.length) throw new Error(`${pkg}: no publish times in the registry document`);
    const released = { first: times[0]!, last: times[times.length - 1]!, source: 'registry.npmjs.org', checkedAt };
    await updateManifest(pkg, (m) => {
      m.released = released;
    });
    console.log(`${pkg}: first ${released.first.slice(0, 10)}, last ${released.last.slice(0, 10)}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
