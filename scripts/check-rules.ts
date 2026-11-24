/**
 * npm run rules:check
 *
 * The rites, checked mechanically for every revived package:
 * - revived/package.json has no dependencies of any kind and no install scripts
 * - revived/LICENSE keeps the original's notice and credits its author
 * - every file under ossuary/<pkg>/original still has the hash it had when it
 *   was vendored from the registry tarball (original.sha256.json)
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { listOssuary, pkgDir, readManifest } from '../packages/core/src/node/ossuary.ts';
import { fileHashes } from './vendor-original.ts';

const problems: string[] = [];
for (const pkg of await listOssuary()) {
  const dir = join(pkgDir(pkg), 'revived');
  const pj = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as Record<string, any>;
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'bundleDependencies', 'bundledDependencies']) {
    if (pj[field] && Object.keys(pj[field]).length) problems.push(`${pkg}: revived/package.json has ${field}`);
  }
  for (const s of ['preinstall', 'install', 'postinstall', 'prepare']) {
    if (pj.scripts?.[s]) problems.push(`${pkg}: revived/package.json has a ${s} script`);
  }
  if (existsSync(join(dir, 'binding.gyp'))) problems.push(`${pkg}: revived has a binding.gyp`);
  const m = await readManifest(pkg);
  const license = existsSync(join(dir, 'LICENSE')) ? await readFile(join(dir, 'LICENSE'), 'utf8') : '';
  const original = await readFile(join(pkgDir(pkg), 'original', 'LICENSE'), 'utf8');
  if (!license.includes(original.trim())) problems.push(`${pkg}: revived/LICENSE does not keep the original notice in full`);
  if (!license.includes(m.author)) problems.push(`${pkg}: revived/LICENSE does not credit ${m.author}`);
  const hashFile = join(pkgDir(pkg), 'original.sha256.json');
  if (!existsSync(hashFile)) problems.push(`${pkg}: original.sha256.json is missing; re-run npm run vendor`);
  else {
    const saved = JSON.parse(await readFile(hashFile, 'utf8')) as Record<string, string>;
    const now = await fileHashes(join(pkgDir(pkg), 'original'));
    for (const f of new Set([...Object.keys(saved), ...Object.keys(now)])) {
      if (saved[f] !== now[f]) problems.push(`${pkg}: original/${f} was ${saved[f] ? (now[f] ? 'edited' : 'deleted') : 'added'}. The original is the referee and is never edited.`);
    }
  }
  console.log(`${pkg}: checked`);
}
if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
