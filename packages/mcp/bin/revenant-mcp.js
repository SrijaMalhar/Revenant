#!/usr/bin/env node
// Starts revenant-mcp over stdio. The server is TypeScript, run through tsx.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tsx = join(dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
const child = spawn(process.execPath, [tsx, join(here, '..', 'src', 'index.ts')], { stdio: 'inherit', env: { ...process.env, TZ: 'UTC' } });
child.on('exit', (code) => process.exit(code ?? 0));
