import type { ScanInput } from '../types.ts';

export class InputError extends Error {
  override name = 'InputError';
}

const NAME = /^[A-Za-z0-9_.-]+$/;

/**
 * Accepts owner/repo, https://github.com/owner/repo, URLs with /tree/<branch>,
 * a trailing .git, or the text of a package.json.
 */
export function parseScanInput(raw: string): ScanInput {
  const text = raw.trim();
  if (!text) throw new InputError('Paste a GitHub repo (owner/repo or a URL) or the contents of a package.json.');

  if (text.startsWith('{') || text.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new InputError('That looks like JSON, but it does not parse.');
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new InputError('A package.json must have an object at the top.');
    }
    return { kind: 'manifest', packageJson: text };
  }

  let rest = text.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  // A link to the root package.json: github.com/o/r/blob/<ref>/package.json or raw.githubusercontent.com/o/r/<ref>/package.json.
  const rawLink = /^raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(.+)\/package\.json$/i.exec(rest.replace(/[?#].*$/, ''));
  if (rawLink) rest = `github.com/${rawLink[1]}/${rawLink[2]}/tree/${rawLink[3]}`;
  const blob = /^github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)\/package\.json$/i.exec(rest.replace(/[?#].*$/, ''));
  if (blob) rest = `github.com/${blob[1]}/${blob[2]}/tree/${blob[3]}`;
  if (/^github\.com\//i.test(rest)) rest = rest.slice('github.com/'.length);
  else if (/^[^/]+\.[a-z]{2,}\//i.test(rest)) throw new InputError('Only github.com repositories are supported.');
  rest = rest.replace(/[?#].*$/, '').replace(/\/+$/, '');

  const parts = rest.split('/');
  const owner = parts[0] ?? '';
  let repo = (parts[1] ?? '').replace(/\.git$/i, '');
  if (!NAME.test(owner) || !NAME.test(repo)) {
    throw new InputError('Expected owner/repo, for example eslint/eslint.');
  }
  let ref: string | undefined;
  if (parts.length > 2) {
    if (parts[2] === 'tree' && parts.length > 3) ref = parts.slice(3).join('/');
    else if (parts[2] !== 'tree') throw new InputError('Use the repository URL, or a /tree/<branch> URL.');
  }
  repo = repo.trim();
  return ref ? { kind: 'github', owner, repo, ref } : { kind: 'github', owner, repo };
}

export function describeInput(input: ScanInput): string {
  if (input.kind === 'manifest') return 'pasted package.json';
  return `${input.owner}/${input.repo}${input.ref ? `@${input.ref}` : ''}`;
}
