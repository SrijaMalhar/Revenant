import type { Provenance as P } from '@revenant/core/types';

const SOURCE: Record<P['source'], string> = {
  'deps.dev': 'deps.dev',
  npm: 'the npm registry',
  ci: 'measured by CI',
  build: 'measured at build time',
};

/** A small marker next to a number saying where it came from and when. Hover, focus or tap. */
export function Prov({ source, at, detail }: P) {
  const text = `${source === 'ci' || source === 'build' ? SOURCE[source] : `From ${SOURCE[source]}`}${at ? ` on ${at}` : ''}${detail ? `. ${detail}` : ''}`;
  return (
    <button type="button" className="prov" title={text} aria-label={`Source: ${text}`} onClick={(e) => e.currentTarget.focus()}>
      i
    </button>
  );
}
