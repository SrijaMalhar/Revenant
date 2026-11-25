import { useEffect, useState } from 'react';
import { requirements, revivedSource } from '../lib/ossuary.ts';

/**
 * The will and the body: the package's spec next to the revived source.
 * The spec is Kiro's requirements.md for this package, copied in at build
 * time when it exists.
 */
export function WillAndBody({ pkg }: { pkg: string }) {
  const [spec, setSpec] = useState<string | null | undefined>(undefined);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    requirements(pkg).then(setSpec);
    revivedSource(pkg).then(setSrc, () => setSrc(null));
  }, [pkg]);
  return (
    <div className="two-col">
      <section>
        <h3>The will: its spec</h3>
        {spec === undefined ? <p className="muted">Loading…</p> : null}
        {spec === null ? (
          <p className="muted">
            No spec for this package yet. It appears here once <code>.kiro/specs/revive-{pkg}/requirements.md</code> exists and the Ossuary is rebuilt.
          </p>
        ) : null}
        {spec ? <Markdown text={spec} /> : null}
      </section>
      <section>
        <h3>The body: revived source</h3>
        {src ? <pre className="source-view">{src}</pre> : <p className="muted">Loading…</p>}
      </section>
    </div>
  );
}

/** Just enough markdown for a requirements file: headings, lists, paragraphs, inline code. No HTML passes through. */
function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) => s.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part.replace(/\*\*/g, '')));
  return (
    <div className="markdown stack">
      {blocks.map((b, i) => {
        const h = /^(#{1,4})\s+(.*)$/.exec(b.trim());
        if (h) return <h4 key={i}>{inline(h[2]!)}</h4>;
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={i} className="list">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(b)}</p>;
      })}
    </div>
  );
}
