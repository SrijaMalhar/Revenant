/**
 * npm run build:ossuary
 *
 * For each package in ossuary/, bundles with esbuild into
 * apps/web/public/ossuary/<pkg>/:
 *   original.js            the unmodified original, CommonJS wrapped as ESM
 *   revived.js             revived/src/index.ts
 *   replay.js              drafts/<n>.ts, only if a real failing draft exists
 *   possessed/<id>.js      revived with one planted bug applied
 *   manifest.json, soulprint.json, exorcism.json, revived-source.ts
 *   <pkg>-revived.tgz      the revived package to take home
 * and builds the revived package itself (revived/lib: ESM, CJS and types).
 *
 * Output is deterministic; CI rebuilds and fails if the committed files differ.
 */
import { build, type BuildOptions } from 'esbuild';
import { mkdir, readFile, rm, writeFile, copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';
import {
  listOssuary,
  pkgDir,
  possess,
  readManifest,
  readPossessions,
  repoRoot,
} from '../packages/core/src/node/ossuary.ts';

const publicRoot = join(repoRoot, 'apps', 'web', 'public', 'ossuary');
const shimDir = join(repoRoot, 'node_modules', '.revenant', 'shims');

const common: BuildOptions = {
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  write: false,
  legalComments: 'inline',
  logLevel: 'silent',
};

/**
 * esbuild's define only takes JSON or an identifier. A value like
 * `() => "/"` goes into an injected shim, and the define points at it.
 */
async function defineOptions(pkg: string, define: Record<string, string>): Promise<Pick<BuildOptions, 'define' | 'inject'>> {
  const out: Record<string, string> = {};
  const lines: string[] = [];
  let i = 0;
  for (const [key, value] of Object.entries(define)) {
    let plain = /^[A-Za-z_$][\w$]*$/.test(value);
    if (!plain) {
      try {
        JSON.parse(value);
        plain = true;
      } catch {
        plain = false;
      }
    }
    if (plain) out[key] = value;
    else {
      const name = `__revenant_define_${i++}`;
      lines.push(`export const ${name} = ${value};`);
      out[key] = name;
    }
  }
  if (!lines.length) return { define: out };
  await mkdir(shimDir, { recursive: true });
  const shim = join(shimDir, `${pkg}.js`);
  await writeFile(shim, lines.join('\n') + '\n');
  return { define: out, inject: [shim] };
}

async function bundleTo(outfile: string, opts: BuildOptions): Promise<number> {
  const result = await build({ ...common, ...opts });
  const text = result.outputFiles![0]!.text;
  await writeFile(outfile, text);
  return text.length;
}

/** Minimal deterministic ustar writer: sorted entries, mtime 0, fixed modes. */
function tar(entries: { path: string; data: Buffer }[]): Buffer {
  const blocks: Buffer[] = [];
  for (const e of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    const h = Buffer.alloc(512);
    h.write(e.path, 0, 100, 'utf8');
    h.write('0000644\0', 100);
    h.write('0000000\0', 108);
    h.write('0000000\0', 116);
    h.write(e.data.length.toString(8).padStart(11, '0') + '\0', 124);
    h.write('00000000000\0', 136);
    h.write('        ', 148);
    h.write('0', 156);
    h.write('ustar\0', 257);
    h.write('00', 263);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, e.data, Buffer.alloc((512 - (e.data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

function gzipStable(buf: Buffer): Buffer {
  const gz = gzipSync(buf, { level: 9 });
  gz[9] = 0xff; // OS byte: "unknown", so the archive is identical on every platform
  return gz;
}

async function buildRevivedLib(pkg: string): Promise<void> {
  const dir = join(pkgDir(pkg), 'revived');
  const lib = join(dir, 'lib');
  const entry = join(dir, 'src', 'index.ts');
  await mkdir(lib, { recursive: true });
  const base: BuildOptions = { entryPoints: [entry], bundle: true, platform: 'neutral', target: 'es2020', write: false, logLevel: 'silent', legalComments: 'inline' };
  const esm = await build({ ...base, format: 'esm' });
  await writeFile(join(lib, 'index.mjs'), esm.outputFiles![0]!.text);
  // require() gets exactly the original's module.exports shape, without an extra "default" key.
  const cjs = await build({ ...base, format: 'cjs', footer: { js: 'module.exports = module.exports.default;' } });
  await writeFile(join(lib, 'index.cjs'), cjs.outputFiles![0]!.text);

  const host = ts.createCompilerHost({});
  const written: Record<string, string> = {};
  host.writeFile = (file, text) => {
    written[file] = text;
  };
  const program = ts.createProgram(
    [entry],
    { declaration: true, emitDeclarationOnly: true, strict: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, outDir: lib, skipLibCheck: true, types: [] },
    host,
  );
  const emit = program.emit();
  const errors = ts.getPreEmitDiagnostics(program).concat(emit.diagnostics).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(`${pkg}: type errors\n${ts.formatDiagnostics(errors, { getCanonicalFileName: (f) => f, getCurrentDirectory: () => repoRoot, getNewLine: () => '\n' })}`);
  const dts = Object.entries(written).find(([f]) => f.endsWith('index.d.ts'));
  if (!dts) throw new Error(`${pkg}: no declaration emitted`);
  await writeFile(join(lib, 'index.d.ts'), dts[1]);
}

async function packRevived(pkg: string, version: string, out: string): Promise<void> {
  const dir = join(pkgDir(pkg), 'revived');
  const files: { path: string; data: Buffer }[] = [];
  const walk = async (d: string) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else files.push({ path: `package/${relative(dir, full).split('\\').join('/')}`, data: await readFile(full) });
    }
  };
  await walk(dir);
  await writeFile(join(out, `${pkg}-${version}-revived.tgz`), gzipStable(tar(files)));
}

async function buildPackage(pkg: string): Promise<{ name: string; version: string; possessions: number; replay: boolean }> {
  const m = await readManifest(pkg);
  const dir = pkgDir(pkg);
  const out = join(publicRoot, pkg);
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, 'possessed'), { recursive: true });

  const defs = await defineOptions(pkg, m.build?.define ?? {});
  if (!m.main) throw new Error(`${pkg}: manifest.main is missing`);

  await bundleTo(join(out, 'original.js'), { entryPoints: [join(dir, 'original', m.main)], ...defs });
  await bundleTo(join(out, 'revived.js'), { entryPoints: [join(dir, 'revived', 'src', 'index.ts')], ...defs });
  if (m.replay) {
    await bundleTo(join(out, 'replay.js'), { entryPoints: [join(dir, m.replay.draft)], ...defs });
  }

  const source = await readFile(join(dir, 'revived', 'src', 'index.ts'), 'utf8');
  const possessions = await readPossessions(pkg);
  for (const p of possessions) {
    await bundleTo(join(out, 'possessed', `${p.id}.js`), {
      stdin: { contents: possess(source, p), loader: 'ts', resolveDir: join(dir, 'revived', 'src'), sourcefile: `possessed-${p.id}.ts` },
      ...defs,
    });
  }
  if (!possessions.length) await rm(join(out, 'possessed'), { recursive: true });

  await buildRevivedLib(pkg);
  await packRevived(pkg, m.version, out);

  await copyFile(join(dir, 'manifest.json'), join(out, 'manifest.json'));
  await writeFile(join(out, 'revived-source.ts'), source);
  for (const extra of ['soulprint.json', 'exorcism.json']) {
    if (existsSync(join(dir, extra))) await copyFile(join(dir, extra), join(out, extra));
  }
  // The package's Kiro spec, if one exists, for the "will and body" tab.
  const spec = join(repoRoot, '.kiro', 'specs', `revive-${pkg}`, 'requirements.md');
  if (existsSync(spec)) await copyFile(spec, join(out, 'requirements.md'));

  return { name: pkg, version: m.version, possessions: possessions.length, replay: Boolean(m.replay) };
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const pkgs = only.length ? only : await listOssuary();
  await mkdir(publicRoot, { recursive: true });
  const index = [];
  for (const pkg of pkgs) {
    index.push(await buildPackage(pkg));
    console.log(`built ${pkg}`);
  }
  if (!only.length) await writeFile(join(publicRoot, 'index.json'), JSON.stringify(index, null, 2) + '\n');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
