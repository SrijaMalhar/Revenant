import semver from 'semver';

export type DepSpec =
  | { kind: 'registry'; name: string; range: string; alias?: string }
  | { kind: 'skip'; reason: string };

const SKIP_PREFIXES: [RegExp, string][] = [
  [/^file:/i, 'file: dependency'],
  [/^link:/i, 'link: dependency'],
  [/^workspace:/i, 'workspace: dependency'],
  [/^portal:/i, 'portal: dependency'],
  [/^patch:/i, 'patch: dependency'],
  [/^(git\+|git:|git@)/i, 'git dependency'],
  [/^(github|gitlab|bitbucket|gist):/i, 'git dependency'],
  [/^https?:/i, 'URL dependency'],
];

/** Reads one dependencies entry. npm:<pkg>@<range> aliases resolve <pkg>. */
export function parseDepSpec(name: string, rawSpec: unknown): DepSpec {
  if (typeof rawSpec !== 'string') return { kind: 'skip', reason: 'version spec is not a string' };
  let spec = rawSpec.trim();
  for (const [re, reason] of SKIP_PREFIXES) if (re.test(spec)) return { kind: 'skip', reason };

  let target = name;
  let alias: string | undefined;
  if (/^npm:/i.test(spec)) {
    const body = spec.slice(4);
    const at = body.lastIndexOf('@');
    if (at > 0) {
      target = body.slice(0, at);
      spec = body.slice(at + 1);
    } else {
      target = body;
      spec = '*';
    }
    alias = name;
  }
  if (spec === '' || spec === 'latest') spec = '*';
  if (semver.validRange(spec) === null) {
    // A bare user/repo is a GitHub shorthand; anything else is a dist-tag.
    if (/^[^@\s][^\s]*\/[^\s]+$/.test(spec)) return { kind: 'skip', reason: 'git dependency' };
    return { kind: 'skip', reason: `dist-tag "${spec}" is not resolved` };
  }
  return alias ? { kind: 'registry', name: target, range: spec, alias } : { kind: 'registry', name: target, range: spec };
}

/** The way npm picks a version: the default version if it satisfies the range, else the highest that does. */
export function resolveRange(versions: string[], defaultVersion: string | null, range: string): string | null {
  if (defaultVersion && semver.satisfies(defaultVersion, range)) return defaultVersion;
  return semver.maxSatisfying(versions, range);
}
