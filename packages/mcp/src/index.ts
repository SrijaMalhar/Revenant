/**
 * revenant-mcp over stdio.
 *   scan_repo       { repo }                        -> a GraveyardReport
 *   zombie_index    { report }                      -> scores and actions, worst first
 *   run_soul_match  { pkg, target, numRuns, seed }  -> a SoulMatchRun
 *   soulprint       { pkg }                         -> both hashes and whether they match
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { GraveyardReport } from '@revenant/core/types';
import { runSoulMatch, scanRepo, soulprintOf, zombieIndexes } from './tools.ts';

const server = new McpServer({ name: 'revenant-mcp', version: '0.1.0' });
const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: 'text' as const, text: e instanceof Error ? e.message : String(e) }] });

server.registerTool(
  'scan_repo',
  {
    description: 'Scan a public GitHub repo (owner/repo or URL) or the text of a package.json for dependencies with no release in 3 years.',
    inputSchema: { repo: z.string().describe('owner/repo, a GitHub URL, or package.json text') },
  },
  async ({ repo }) => {
    try {
      return json(await scanRepo(repo));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'zombie_index',
  {
    description: 'Score the dead packages in a GraveyardReport from scan_repo: Zombie Index 0-100, its parts, the action (replace, revive, watch) and an explanation per factor.',
    inputSchema: { report: z.any().describe('a GraveyardReport from scan_repo') },
  },
  async ({ report }) => {
    try {
      const r = (typeof report === 'string' ? JSON.parse(report) : report) as GraveyardReport;
      return json(await zombieIndexes(r));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'run_soul_match',
  {
    description: 'Run Soul Match: the original package and the revived one side by side on generated inputs. Returns same-soul or the shrunk counterexample. Read-only.',
    inputSchema: {
      pkg: z.string().describe('an Ossuary package, e.g. type-check'),
      target: z.string().optional().describe('revived (default), replay, or possessed:<id>'),
      numRuns: z.number().int().positive().max(1_000_000).optional().describe('default 2000'),
      seed: z.number().int().nonnegative().optional(),
    },
  },
  async (args) => {
    try {
      return json(await runSoulMatch(args));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  'soulprint',
  {
    description: "Compute a package's Soulprint for the original and the revived build (10,000 inputs per case, seed 42) and say whether they match.",
    inputSchema: { pkg: z.string() },
  },
  async ({ pkg }) => {
    try {
      return json(await soulprintOf(pkg));
    } catch (e) {
      return fail(e);
    }
  },
);

await server.connect(new StdioServerTransport());
