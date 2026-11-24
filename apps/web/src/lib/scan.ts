import type { GraveyardReport } from '@revenant/core/types';

export const PROXY = '/api/proxy';

/** A project with one popular linter installed: enough to show both Revive and Replace. */
export const EXAMPLE_MANIFEST = JSON.stringify({ name: 'one-linter-project', private: true, devDependencies: { eslint: '^10.0.0' } }, null, 2);

/** The recorded report for demo mode, or null if none has been recorded. */
export async function loadDemoReport(): Promise<GraveyardReport | null> {
  try {
    const r = await fetch('/demo/report.json');
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    return { ...((await r.json()) as GraveyardReport), source: 'demo' };
  } catch {
    return null;
  }
}
