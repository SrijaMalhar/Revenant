/**
 * Hook command for Pre Tool Use on file writes:
 *   tsx scripts/hooks/oracle-guard.ts < {"tool_name": ..., "tool_input": {...}}
 *
 * Blocks any write into ossuary/<pkg>/original/: the original is the referee,
 * so an agent can't "fix" a failure by editing it. Exits 2 with the reason on
 * stderr to block, 0 to allow. Check in Kiro how a Pre Tool Use command
 * signals "block" and adjust the exit code if it differs.
 */
import { relative, resolve, sep } from 'node:path';
import { repoRoot } from '../../packages/core/src/node/ossuary.ts';

/** Every string in tool_input that looks like a path. */
export function pathsIn(input: unknown, out: string[] = []): string[] {
  if (typeof input === 'string') out.push(input);
  else if (Array.isArray(input)) for (const v of input) pathsIn(v, out);
  else if (input && typeof input === 'object') for (const v of Object.values(input)) pathsIn(v, out);
  return out;
}

export function touchesOriginal(p: string): boolean {
  const rel = relative(repoRoot, resolve(repoRoot, p)).split(sep).join('/');
  return /(^|\/)ossuary\/[^/]+\/original(\/|$)/.test(rel) || /(^|\/)ossuary\/[^/]+\/original(\/|$)/.test(p.split(sep).join('/'));
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let payload: { tool_name?: string; tool_input?: unknown } = {};
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    payload = { tool_input: raw };
  }
  const hit = pathsIn(payload.tool_input).find(touchesOriginal);
  if (hit) {
    console.error(`Blocked: ${hit} is under ossuary/*/original/. The original is the referee and is never edited. Fix the revived code instead.`);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
