/**
 * npm run redos -- [<pkg>...] [--write]
 *
 * Static ReDoS gate. Collects every regex literal, and every string literal
 * (or constant-folded string) passed to RegExp, in the revived source and in
 * the runtime files of the original, then runs recheck on each. Fails if any
 * revived regex is vulnerable. With --write, records the counts in
 * manifest.redos so the exorcism panel can show them.
 */
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import ts from 'typescript';
import { check } from 'recheck';
import { listOssuary, pkgDir, readManifest, repoRoot } from '../packages/core/src/node/ossuary.ts';
import { updateManifest } from './lib/ossuary.ts';

const require = createRequire(import.meta.url);
const recheckVersion: string = require('recheck/package.json').version;

export interface Found {
  file: string;
  line: number;
  pattern: string;
  flags: string;
}

/** Collects regexes from one file. Dynamic RegExp arguments that can't be folded are counted, not guessed. */
export function collectRegexes(file: string, text: string): { found: Found[]; dynamic: number } {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const found: Found[] = [];
  let dynamic = 0;
  const regexVars = new Map<string, string>(); // identifier -> regex source, for X.source
  const stringVars = new Map<string, ts.Expression>();

  const visitDecls = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      if (ts.isRegularExpressionLiteral(n.initializer)) {
        const { pattern } = splitLiteral(n.initializer.text);
        regexVars.set(n.name.text, pattern);
      } else stringVars.set(n.name.text, n.initializer);
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left)) {
      if (ts.isRegularExpressionLiteral(n.right)) regexVars.set(n.left.text, splitLiteral(n.right.text).pattern);
    }
    // A variable that is ever reassigned with += can't be folded.
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken && ts.isIdentifier(n.left)) {
      stringVars.delete(n.left.text);
      stringVars.set(`!${n.left.text}`, n.right);
    }
    ts.forEachChild(n, visitDecls);
  };
  visitDecls(sf);

  const fold = (e: ts.Expression, depth = 0): string | null => {
    if (depth > 20) return null;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isParenthesizedExpression(e)) return fold(e.expression, depth + 1);
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const a = fold(e.left, depth + 1);
      const b = fold(e.right, depth + 1);
      return a !== null && b !== null ? a + b : null;
    }
    if (ts.isPropertyAccessExpression(e) && e.name.text === 'source' && ts.isIdentifier(e.expression)) {
      return regexVars.get(e.expression.text) ?? null;
    }
    if (ts.isIdentifier(e) && stringVars.has(e.text) && !stringVars.has(`!${e.text}`)) return fold(stringVars.get(e.text)!, depth + 1);
    return null;
  };

  const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const visit = (n: ts.Node) => {
    if (ts.isRegularExpressionLiteral(n)) {
      found.push({ file, line: line(n), ...splitLiteral(n.text) });
    } else if ((ts.isNewExpression(n) || ts.isCallExpression(n)) && ts.isIdentifier(n.expression) && n.expression.text === 'RegExp') {
      const [src, fl] = n.arguments ?? [];
      const pattern = src ? fold(src) : null;
      const flags = fl ? fold(fl) : '';
      if (pattern === null || flags === null) dynamic++;
      else found.push({ file, line: line(n), pattern, flags });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { found, dynamic };
}

function splitLiteral(text: string): { pattern: string; flags: string } {
  const end = text.lastIndexOf('/');
  return { pattern: text.slice(1, end), flags: text.slice(end + 1) };
}

/** Files esbuild pulls into the bundle, so tests and docs in the tarball don't count. */
async function runtimeFiles(entry: string): Promise<string[]> {
  const r = await build({ entryPoints: [entry], bundle: true, write: false, metafile: true, platform: 'browser', format: 'esm', logLevel: 'silent' });
  return Object.keys(r.metafile!.inputs)
    .filter((f) => !f.includes('.revenant/shims'))
    .map((f) => join(repoRoot, f))
    .sort();
}

async function scanFiles(files: string[]) {
  const results: (Found & { status: string; complexity: string })[] = [];
  let dynamic = 0;
  for (const f of files) {
    const c = collectRegexes(relative(repoRoot, f), await readFile(f, 'utf8'));
    dynamic += c.dynamic;
    for (const x of c.found) {
      const r = await check(x.pattern, x.flags.replace(/[^dgimsuyv]/g, ''));
      const complexity = r.status === 'vulnerable' ? r.complexity.summary : r.status === 'safe' ? r.complexity.summary : r.status;
      results.push({ ...x, status: r.status, complexity });
    }
  }
  return { results, dynamic };
}

async function main() {
  const argv = process.argv.slice(2);
  const named = argv.filter((a) => !a.startsWith('--'));
  const pkgs = named.length ? named : await listOssuary();
  let failed = false;
  for (const pkg of pkgs) {
    const m = await readManifest(pkg);
    const original = await scanFiles(await runtimeFiles(join(pkgDir(pkg), 'original', m.main!)));
    const revived = await scanFiles(await runtimeFiles(join(pkgDir(pkg), 'revived', 'src', 'index.ts')));
    const ov = original.results.filter((r) => r.status === 'vulnerable');
    const rv = revived.results.filter((r) => r.status === 'vulnerable');
    console.log(`${pkg}: original ${ov.length} vulnerable of ${original.results.length} (${original.dynamic} dynamic, not analyzed); revived ${rv.length} vulnerable of ${revived.results.length} (${revived.dynamic} dynamic)`);
    for (const v of [...ov, ...rv]) console.log(`  ${v.file}:${v.line}  /${v.pattern}/${v.flags}  ${v.complexity}`);
    if (rv.length > 0 || revived.dynamic > 0) failed = true;
    if (argv.includes('--write')) {
      await updateManifest(pkg, (man) => {
        man.redos = {
          originalVulnerable: ov.length,
          revivedVulnerable: rv.length,
          checker: `recheck ${recheckVersion}`,
          measuredAt: new Date().toISOString().slice(0, 10),
          originalFindings: ov.map((v) => ({ file: `${v.file}:${v.line}`, pattern: `/${v.pattern}/${v.flags}`, complexity: v.complexity })),
        };
      });
    }
  }
  if (failed) console.error('A revived package has a vulnerable or unanalyzable regex.');
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
