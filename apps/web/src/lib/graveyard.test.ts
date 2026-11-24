import { describe, expect, it } from 'vitest';
import type { GraveNode } from '@revenant/core/types';
import { causeOfDeath, epitaph, type EpitaphTemplate } from './graveyard.ts';

const node = (over: Partial<GraveNode['vitals']> = {}, name = 'type-check'): GraveNode => ({
  name,
  version: '0.4.0',
  depth: 1,
  path: ['root', `${name}@0.4.0`],
  dev: true,
  dead: true,
  replacement: null,
  vitals: { latestVersion: '0.4.0', lastRelease: '2020-04-03T00:00:00Z', maintainers: 1, deprecated: null, installScripts: false, weeklyDownloads: 199_418_512, advisories: [], ...over },
});
const at = '2026-11-25T00:00:00Z';

describe('cause of death', () => {
  it('prefers deprecation, then years without a release', () => {
    expect(causeOfDeath(node({ deprecated: 'x' }), at).cause).toBe('Deprecated by its maintainers');
    expect(causeOfDeath(node(), at)).toEqual({ cause: 'No release in 6 years', factors: ['A single maintainer account'] });
  });
});

describe('epitaph engine', () => {
  // Test templates only; the real ones are written by hand.
  const templates: EpitaphTemplate[] = [
    { id: 'a', when: 'high-reach', text: 'Still installed {weekly} times a week. Nobody has published since {year}.' },
    { id: 'b', when: 'high-reach', text: '{name}: {years} years quiet.' },
    { id: 'c', when: 'any', text: 'Here lies {name}.' },
  ];
  it('fills numbers and is stable for a name', () => {
    const e = epitaph(node(), at, templates)!;
    expect(epitaph(node(), at, templates)).toEqual(e);
    expect(e.text).not.toContain('{');
  });
  it('falls through to a rule that applies', () => {
    expect(epitaph(node({ weeklyDownloads: 5 }), at, templates)!.template).toBe('c');
  });
  it('shows nothing until templates are written', () => {
    expect(epitaph(node(), at, [])).toBeNull();
  });
});
