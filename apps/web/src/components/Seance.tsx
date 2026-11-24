import { useEffect, useState } from 'react';
import { canonical, diffOutcomes } from '@revenant/core/soul';
import type { Divergence, Outcome } from '@revenant/core/types';

export function show(o: Outcome): string {
  return o.kind === 'throw' ? `throws ${o.name}` : JSON.stringify(o.value, null, 2);
}

export const inputText = (input: unknown) => JSON.stringify(canonical(input), null, 1);

/**
 * The séance view: the shrunk input, both answers side by side, where they
 * differ, and the shrink itself played back step by step.
 */
export function Seance({ d, label, onCopyRegression }: { d: Divergence; label: string; onCopyRegression?: () => void }) {
  const path = d.path && d.path.length ? d.path : [d.input];
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // With reduced motion, show only the first and the last step.
  const frames = reduced && path.length > 2 ? [path[0], path[path.length - 1]] : path;
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [d]);
  useEffect(() => {
    if (i >= frames.length - 1) return;
    const t = setTimeout(() => setI((x) => x + 1), reduced ? 1200 : 150);
    return () => clearTimeout(t);
  }, [i, frames.length, reduced]);
  const done = i >= frames.length - 1;

  return (
    <section className="seance" aria-labelledby="seance-h">
      <h2 id="seance-h">{label}</h2>
      <p className="muted">
        Case <code>{d.caseName}</code>. fast-check found a failing input and shrank it {d.shrinks} {d.shrinks === 1 ? 'time' : 'times'} to the smallest one that still fails.
      </p>
      <div>
        <p className="small muted" aria-live="off">
          {done ? 'Shrunk input' : `Shrinking, step ${i + 1} of ${frames.length}`}
          {!done ? (
            <>
              {' '}
              <button type="button" className="link" onClick={() => setI(frames.length - 1)}>
                Skip to the end
              </button>
            </>
          ) : null}
        </p>
        <pre className="shrink-input">{inputText(frames[Math.min(i, frames.length - 1)])}</pre>
      </div>
      <div className="sides">
        <div className="side">
          <span className="small muted">Original</span>
          <pre className="value">{show(d.original)}</pre>
        </div>
        <div className="side candidate">
          <span className="small muted">Candidate</span>
          <pre className="value">{show(d.candidate)}</pre>
        </div>
      </div>
      <DiffView original={d.original} candidate={d.candidate} />
      {onCopyRegression ? (
        <p>
          <button type="button" className="quiet" onClick={onCopyRegression}>
            Copy as a regression test
          </button>
        </p>
      ) : null}
    </section>
  );
}

export function DiffView({ original, candidate }: { original: Outcome; candidate: Outcome }) {
  const diff = diffOutcomes(original, candidate);
  if (diff.type === 'same') return <p className="muted">Both sides gave the same answer.</p>;
  if (diff.type === 'kind') {
    return (
      <p>
        The original {diff.original}; the candidate {diff.candidate}.
      </p>
    );
  }
  if (diff.type === 'throw') {
    return (
      <p>
        Both threw, but the original threw {diff.original} and the candidate threw {diff.candidate}.
      </p>
    );
  }
  return (
    <table>
      <caption className="visually-hidden">Where the answers differ</caption>
      <thead>
        <tr>
          <th scope="col">Where</th>
          <th scope="col">Original</th>
          <th scope="col">Candidate</th>
        </tr>
      </thead>
      <tbody>
        {diff.paths.map((p) => (
          <tr key={p.path}>
            <td>
              <code>{p.path}</code>
            </td>
            {p.chars ? (
              <>
                <td>
                  <code>
                    {p.chars.prefix}
                    <mark className="diff-hit">{p.chars.original || ' '}</mark>
                    {p.chars.suffix}
                  </code>
                </td>
                <td>
                  <code>
                    {p.chars.prefix}
                    <mark className="diff-hit">{p.chars.candidate || ' '}</mark>
                    {p.chars.suffix}
                  </code>
                </td>
              </>
            ) : (
              <>
                <td>{p.originalMissing ? <em className="muted">nothing here</em> : <code>{JSON.stringify(p.original)}</code>}</td>
                <td>{p.candidateMissing ? <em className="diff-hit">nothing here</em> : <code className="diff-hit">{JSON.stringify(p.candidate)}</code>}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
