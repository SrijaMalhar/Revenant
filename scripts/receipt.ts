/**
 * npm run receipt -- [<pkg>...]
 *
 * Exhumation receipt: before-and-after numbers for each revived package,
 * written to manifest.delta. Every number is measured here:
 *   subtree packages, install scripts and maintainer accounts: walked from the
 *     npm registry with npm's range resolution (counts only, never names)
 *   gzip bytes: esbuild, minified, then gzip level 9
 *   ops/sec: tinybench, one pass of every case over a fixed input set
 * The revived package is vendored, so it pulls nothing from the registry.
 */
process.env.TZ = 'UTC';

import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import fc from 'fast-check';
import semver from 'semver';
import { Bench } from 'tinybench';
import { FROZEN_NOW, cloneInput } from '../packages/core/src/soul/index.ts';
import { listOssuary, loadCases, loadOriginal, loadRevived, pkgDir, readManifest, withBuildEnv } from '../packages/core/src/node/ossuary.ts';
import { updateManifest } from './lib/ossuary.ts';

const REGISTRY = 'https://registry.npmjs.org';
type Packument = { 'dist-tags': Record<string, string>; maintainers?: { name?: string }[]; versions: Record<string, { dependencies?: Record<string, string>; scripts?: Record<string, string>; gypfile?: boolean; maintainers?: { name?: string }[] }> };
const docs = new Map<string, Promise<Packument>>();
const packument = (name: string) => {
  let p = docs.get(name);
  if (!p) {
    p = fetch(`${REGISTRY}/${name.startsWith('@') ? '@' + encodeURIComponent(name.slice(1)) : encodeURIComponent(name)}`).then((r) => {
      if (!r.ok) throw new Error(`${r.status} for ${name}`);
      return r.json() as Promise<Packument>;
    });
    docs.set(name, p);
  }
  return p;
};

async function subtree(name: string, version: string) {
  const seen = new Map<string, Packument['versions'][string]>();
  const queue: [string, string][] = [[name, version]];
  while (queue.length) {
    const [n, v] = queue.shift()!;
    if (seen.has(`${n}@${v}`)) continue;
    const doc = await packument(n);
    const meta = doc.versions[v]!;
    // Current publishers, from the package document (see sources.ts).
    seen.set(`${n}@${v}`, { ...meta, maintainers: doc.maintainers });
    for (const [dep, range] of Object.entries(meta.dependencies ?? {})) {
      const d = await packument(dep);
      const latest = d['dist-tags'].latest!;
      const pick = semver.satisfies(latest, range) ? latest : semver.maxSatisfying(Object.keys(d.versions), range);
      if (pick) queue.push([dep, pick]);
    }
  }
  const metas = [...seen.values()];
  const accounts = new Set<string>();
  for (const m of metas) for (const a of m.maintainers ?? []) if (a.name) accounts.add(a.name);
  return {
    packages: metas.length,
    installScripts: metas.filter((m) => m.scripts?.preinstall || m.scripts?.install || m.scripts?.postinstall || m.gypfile).length,
    maintainerAccounts: accounts.size,
  };
}

async function gzipBytes(entry: string, define: Record<string, string>): Promise<number> {
  const plainDefine = Object.fromEntries(Object.entries(define).map(([k, v]) => [k, v.startsWith('()') ? '__cwd' : v]));
  const r = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    write: false,
    logLevel: 'silent',
    legalComments: 'none',
    define: plainDefine,
    banner: Object.values(define).some((v) => v.startsWith('()')) ? { js: 'var __cwd=()=>"/";' } : undefined,
  });
  return gzipSync(r.outputFiles![0]!.contents, { level: 9 }).length;
}

async function opsPerSec(pkg: string): Promise<[number, number]> {
  const realNow = Date.now;
  Date.now = () => FROZEN_NOW;
  try {
    return await withBuildEnv(pkg, async () => {
      const [original, revived, cases] = await Promise.all([loadOriginal(pkg), loadRevived(pkg), loadCases(pkg)]);
      const fixed = cases.map((c) => ({ c, inputs: fc.sample(c.arbitrary, { seed: 7, numRuns: 200 }) }));
      const pass = (mod: unknown) => () => {
        for (const { c, inputs } of fixed)
          for (const input of inputs) {
            try {
              c.call(mod, cloneInput(input));
            } catch {
              /* throwing is a result too */
            }
          }
      };
      const bench = new Bench({ time: 1500, warmup: true });
      bench.add('original', pass(original)).add('revived', pass(revived));
      await bench.run();
      const hz = (name: string) => {
        const r = bench.getTask(name)!.result as unknown as { throughput?: { mean: number } };
        if (!r.throughput) throw new Error(`${pkg}: no benchmark result for ${name}`);
        return Math.round(r.throughput.mean);
      };
      return [hz('original'), hz('revived')];
    });
  } finally {
    Date.now = realNow;
  }
}

async function main() {
  const named = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  for (const pkg of named.length ? named : await listOssuary()) {
    const m = await readManifest(pkg);
    const sub = await subtree(m.name, m.version);
    const define = m.build?.define ?? {};
    const gz: [number, number] = [
      await gzipBytes(join(pkgDir(pkg), 'original', m.main!), define),
      await gzipBytes(join(pkgDir(pkg), 'revived', 'src', 'index.ts'), define),
    ];
    const ops = await opsPerSec(pkg);
    await updateManifest(pkg, (man) => {
      man.delta = {
        subtreePackages: [sub.packages, 0],
        installScripts: [sub.installScripts, 0],
        maintainerAccounts: [sub.maintainerAccounts, 0],
        gzipBytes: gz,
        opsPerSec: ops,
        measuredAt: new Date().toISOString().slice(0, 10),
      };
    });
    console.log(`${pkg}: subtree ${sub.packages} -> 0 packages, install scripts ${sub.installScripts} -> 0, maintainer accounts ${sub.maintainerAccounts} -> 0, gzip ${gz[0]} -> ${gz[1]} bytes, ${ops[0]} -> ${ops[1]} passes/s (Node ${process.versions.node})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
