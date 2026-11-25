import { useEffect, useState } from 'react';
import type { Outcome } from '@revenant/core/types';
import { once } from '../lib/worker.ts';
import { DiffView, show } from './Seance.tsx';

export interface CaseInfo {
  name: string;
  examples: string[];
  hasParse: boolean;
}

const LIMIT = 1000;

/**
 * Try any input: pick a function, type an input, and see both answers side by
 * side. Runs in a fresh worker with a 2-second limit and a 1,000-character
 * cap, so a pathological input can't freeze the page.
 */
export function Ouija({ pkg, cases }: { pkg: string; cases: CaseInfo[] }) {
  const usable = cases.filter((c) => c.hasParse);
  const [caseName, setCaseName] = useState(usable[0]?.name ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ input: unknown; original: Outcome; revived: Outcome } | { error: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const current = usable.find((c) => c.name === caseName);
  useEffect(() => setResult(null), [caseName]);

  const ask = async (value = text) => {
    setBusy(true);
    setCopied(false);
    const r = await once({ type: 'ouija', pkg, caseName, text: value }, 2000);
    setBusy(false);
    if (r.type === 'ouija-result') setResult({ input: r.input, original: r.original, revived: r.revived });
    else setResult({ error: r.type === 'error' ? r.message : 'Unexpected answer from the worker.' });
  };

  const same = result && 'original' in result && JSON.stringify(result.original) === JSON.stringify(result.revived);

  return (
    <div className="ouija stack">
      <p className="prose">Try to break it. Pick a function, type an input, and compare the original's answer with the revived one's. Both packages run in your browser.</p>
      <div className="field-row">
        <label className="field-label">
          <span>Function</span>
          <select value={caseName} onChange={(e) => setCaseName(e.target.value)}>
            {usable.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field-label">
        <span>
          Input ({text.length} of {LIMIT} characters){pkg === 'type-check' ? '. Type string on the first line, the value on the next' : ''}
        </span>
        <textarea rows={3} maxLength={LIMIT} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      </label>
      {current?.examples.length ? (
        <div className="chips" aria-label="Edge cases">
          {current.examples.map((ex) => (
            <button
              key={ex}
              type="button"
              className="chip"
              onClick={() => {
                setText(ex);
                void ask(ex);
              }}
            >
              {ex === '' ? '(empty)' : ex.replace(/\n/g, ' ⏎ ')}
            </button>
          ))}
        </div>
      ) : null}
      <p className="actions">
        <button type="button" className="primary" onClick={() => ask()} disabled={busy || !caseName}>
          {busy ? 'Asking…' : 'Ask both'}
        </button>
      </p>
      <div aria-live="polite">
        {result && 'error' in result ? <p className="error">{result.error}</p> : null}
        {result && 'original' in result ? (
          <div className="answer stack">
            <p className={same ? 'verdict same' : 'verdict diverged'}>{same ? 'Same answer.' : 'They disagree. You found a divergence.'}</p>
            <div className="sides">
              <div className="side">
                <span className="side-role">Original</span>
                <pre className="value">{show(result.original)}</pre>
              </div>
              <div className={`side${same ? '' : ' candidate'}`}>
                <span className="side-role">Revived</span>
                <pre className="value">{show(result.revived)}</pre>
              </div>
            </div>
            {!same ? (
              <>
                <DiffView original={result.original} candidate={result.revived} />
                <p>
                  Revenant is meant to be breakable in public. Copy this as a regression test and it becomes a permanent first example on every run.{' '}
                  <button
                    type="button"
                    className="secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(JSON.stringify({ caseName, input: result.input, recordedAt: new Date().toISOString(), source: 'ouija' }, null, 2));
                      setCopied(true);
                    }}
                  >
                    {copied ? 'Copied' : 'Copy as a regression test'}
                  </button>
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
