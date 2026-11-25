import { useCallback, useEffect, useRef, useState } from 'react';
import { canonical } from '@revenant/core/soul';
import type { OssuaryManifest, SoulMatchRun, Soulprint } from '@revenant/core/types';
import { ExorcismChart } from '../components/ExorcismChart.tsx';
import { Evidence, HonestLimits } from '../components/Evidence.tsx';
import { Ouija, type CaseInfo } from '../components/Ouija.tsx';
import { Prov } from '../components/Provenance.tsx';
import { Pulse } from '../components/Pulse.tsx';
import { Seance } from '../components/Seance.tsx';
import { TakeHome } from '../components/TakeHome.tsx';
import { advanceTour } from '../components/Tour.tsx';
import { WillAndBody } from '../components/WillAndBody.tsx';
import { date, num } from '../lib/format.ts';
import { exorcism, manifest as loadManifest, soulprint as loadSoulprint, type ExorcismTiming } from '../lib/ossuary.ts';
import { linkHandler, navigate, useLocation } from '../lib/router.ts';
import { newWorker } from '../lib/worker.ts';
import type { Target, WorkerOut } from '../workers/soul.worker.ts';

const RUNS = 100_000;

type Status = { kind: 'idle' } | { kind: 'running'; done: number; total: number; seed: number; target: Target } | { kind: 'done'; run: SoulMatchRun; target: Target } | { kind: 'error'; message: string };

// Case names and Ouija examples come from the package's cases.ts, loaded lazily
// so the graveyard never pays for fast-check.
const caseModules = import.meta.glob<{ default: { name: string; examples?: string[]; parse?: unknown }[] }>('../../../../ossuary/*/cases.ts');
async function caseInfo(pkg: string): Promise<CaseInfo[]> {
  const entry = Object.entries(caseModules).find(([p]) => p.endsWith(`/ossuary/${pkg}/cases.ts`));
  if (!entry) return [];
  return (await entry[1]()).default.map((c) => ({ name: c.name, examples: c.examples ?? [], hasParse: typeof c.parse === 'function' }));
}

export function SoulMatch({ pkg }: { pkg: string }) {
  const { search } = useLocation();
  const [m, setM] = useState<OssuaryManifest | null | 'missing'>(null);
  const [print, setPrint] = useState<Soulprint | null>(null);
  const [timing, setTiming] = useState<ExorcismTiming | null>(null);
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [target, setTarget] = useState<Target>((search.get('target') as Target) ?? 'revived');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [tab, setTab] = useState<'ouija' | 'evidence' | 'will' | 'home'>('ouija');
  const [copied, setCopied] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);

  useEffect(() => {
    setM(null);
    loadManifest(pkg).then(setM, () => setM('missing'));
    loadSoulprint(pkg).then(setPrint);
    exorcism(pkg).then(setTiming);
    caseInfo(pkg).then(setCases);
    return () => worker.current?.terminate();
  }, [pkg]);

  const start = useCallback(
    (t: Target, seed: number) => {
      worker.current?.terminate();
      const w = newWorker();
      worker.current = w;
      setStatus({ kind: 'running', done: 0, total: RUNS, seed, target: t });
      w.onmessage = (e: MessageEvent<WorkerOut>) => {
        const msg = e.data;
        if (msg.type === 'progress') setStatus({ kind: 'running', done: msg.done, total: msg.total, seed, target: t });
        else if (msg.type === 'result') {
          setStatus({ kind: 'done', run: msg.run, target: t });
          w.terminate();
        } else if (msg.type === 'error') {
          setStatus({ kind: 'error', message: msg.message });
          w.terminate();
        }
      };
      w.onerror = (e) => setStatus({ kind: 'error', message: e.message || 'The worker failed.' });
      w.postMessage({ type: 'run', pkg, target: t, numRuns: RUNS, seed });
      navigate(`/soul/${pkg}?seed=${seed}&target=${encodeURIComponent(t)}`, true);
    },
    [pkg],
  );

  // /soul/:pkg?seed=S re-runs that exact Soul Match on load.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !m || m === 'missing') return;
    const seed = search.get('seed');
    if (seed !== null && /^\d+$/.test(seed)) {
      autoRan.current = true;
      start(target, Number(seed));
    }
  }, [m, search, start, target]);

  if (m === 'missing') {
    return (
      <section>
        <h1>{pkg} isn't in the Ossuary</h1>
        <p>
          Revenant has revived type-check, path-browserify and timespan. <a href="/" onClick={linkHandler('/')}>Back to the graveyard</a>
        </p>
      </section>
    );
  }
  if (!m) return <p className="muted">Opening the Ossuary…</p>;

  const cancel = () => {
    worker.current?.terminate();
    setStatus({ kind: 'idle' });
  };
  const running = status.kind === 'running';
  const done = status.kind === 'running' ? status.done : status.kind === 'done' ? status.run.done : 0;
  const total = status.kind === 'running' ? status.total : status.kind === 'done' ? status.run.numRuns : RUNS;
  const seed = status.kind === 'running' ? status.seed : status.kind === 'done' ? status.run.seed : null;
  const possessed = target.startsWith('possessed:') ? m.possessions?.find((p) => `possessed:${p.id}` === target) : undefined;
  const runLink = seed === null ? '' : `${window.location.origin}/soul/${pkg}?seed=${seed}&target=${encodeURIComponent(status.kind === 'done' || status.kind === 'running' ? status.target : target)}`;

  return (
    <>
      <header className="soul-head">
        <p className="small">
          <a href="/" onClick={linkHandler('/')}>
            The graveyard
          </a>
        </p>
        <h1>{m.name}</h1>
        <p className="muted">
          Revived from {m.name} {m.version} by {m.author}, {m.license}. Zero dependencies.
        </p>
        {print ? (
          <div className="soulprints">
            <p className="sp-row">
              <span className="sp-label">Original</span>
              <code className="sp-hash">{groups(print.sha256)}</code>
            </p>
            <p className="sp-row">
              <span className="sp-label">Revived</span>
              <code className="sp-hash">{groups(print.sha256)}</code>
            </p>
            <p className="small muted">
              Each Soulprint is a SHA-256 over the answers to {num(print.n)} inputs per case, seed {print.seed}, fast-check {print.fastCheck}. The two are identical.
              <Prov source="ci" at="" detail="npm run soulprint:check recomputes both hashes" />
            </p>
          </div>
        ) : null}
      </header>

      <section className="run-panel" aria-labelledby="run-h">
        <div className="controls">
          <h2 id="run-h">Soul Match</h2>
          <p className="muted">
            Runs the original and the {possessed ? 'possessed' : 'revived'} package side by side on {num(RUNS)} generated inputs in your browser. Same soul means every answer matches, and if one side throws, so does the other.
          </p>
          <fieldset className="target-choice">
            <legend className="small muted">Run against</legend>
            <label>
              <input type="radio" name="target" checked={target === 'revived'} onChange={() => setTarget('revived')} disabled={running} />
              The revived package
            </label>
            <label>
              <input type="radio" name="target" checked={target === 'replay'} onChange={() => setTarget('replay')} disabled={running || !m.replay} />
              <span>
                Séance replay
                {m.replay ? (
                  <span className="muted small"> of draft 1, recorded {date(m.replay.recordedAt)}</span>
                ) : (
                  <span className="muted small"> (none: no draft of {m.name} has failed Soul Match, so there's nothing real to replay)</span>
                )}
              </span>
            </label>
            {m.possessions?.length ? (
              <label>
                <input type="radio" name="target" checked={target.startsWith('possessed:')} onChange={() => setTarget(`possessed:${m.possessions![0]!.id}`)} disabled={running} />
                <span>
                  A planted bug:{' '}
                  <select
                    aria-label="Planted bug"
                    value={target.startsWith('possessed:') ? target.slice('possessed:'.length) : ''}
                    onChange={(e) => setTarget(`possessed:${e.target.value}`)}
                    disabled={running}
                  >
                    {!target.startsWith('possessed:') ? <option value="">choose one</option> : null}
                    {m.possessions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            ) : null}
          </fieldset>
          {m.possessions?.length ? (
            <p className="small muted">
              Planted bugs are labeled test fixtures, separate from the séance replay. Recorded score: caught {m.possessions.filter((p) => p.caught).length} of {m.possessions.length}.
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {running ? (
              <button type="button" className="quiet" onClick={cancel}>
                Stop
              </button>
            ) : (
              <button
                type="button"
                data-tour="run"
                onClick={() => {
                  advanceTour('run');
                  start(target, Math.floor(Math.random() * 2 ** 31));
                }}
                disabled={target === 'replay' && !m.replay}
              >
                Run Soul Match
              </button>
            )}
          </div>
          {seed !== null ? (
            <p className="small">
              Seed {seed}.{' '}
              <button
                type="button"
                className="link"
                onClick={async () => {
                  await navigator.clipboard.writeText(runLink);
                  setCopied('run');
                }}
              >
                {copied === 'run' ? 'Link copied' : 'Copy link to this run'}
              </button>
            </p>
          ) : null}
        </div>

        <div className="controls" aria-live="polite" aria-atomic="false">
          <div className="counter" role="status" aria-label={`${num(done)} of ${num(total)} inputs checked`}>
            {num(done)}
            <span className="of">of {num(total)}</span>
          </div>
          <Pulse
            done={done}
            total={total}
            state={status.kind === 'running' ? 'running' : status.kind === 'error' ? 'error' : status.kind === 'done' ? (status.run.status === 'same-soul' ? 'same' : status.run.status === 'diverged' ? 'diverged' : 'error') : 'idle'}
          />
          {status.kind === 'done' && status.run.status === 'same-soul' ? (
            <div>
              <p className="verdict">Same soul.</p>
              <p className="muted">
                Every answer matched on {num(status.run.done)} inputs, in {num(status.run.millis)} ms.
              </p>
            </div>
          ) : null}
          {status.kind === 'done' && status.run.status === 'diverged' ? (
            <div>
              <p className="verdict diverged">{possessed ? 'Caught.' : 'Diverged.'}</p>
              <p className="muted">The two answers differ on one input, shown below.</p>
            </div>
          ) : null}
          {status.kind === 'done' && status.run.status === 'error' ? <p className="error">The run stopped: {status.run.error}</p> : null}
          {status.kind === 'error' ? <p className="error">{status.message}</p> : null}
          {status.kind === 'done' && status.run.perCase ? (
            <table>
              <caption className="visually-hidden">Inputs per case</caption>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col" className="num">
                    Inputs
                  </th>
                </tr>
              </thead>
              <tbody>
                {status.run.perCase.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <code>{c.name}</code>
                    </td>
                    <td className="num">{num(c.runs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>

      {status.kind === 'done' && status.run.divergence ? (
        <Seance
          d={status.run.divergence}
          label={possessed ? `Planted bug caught: ${possessed.title}` : status.target === 'replay' && m.replay ? `Replay of draft 1, recorded ${date(m.replay.recordedAt)}` : 'The séance'}
          onCopyRegression={
            possessed
              ? undefined
              : async () => {
                  const d = status.run.divergence!;
                  await navigator.clipboard.writeText(JSON.stringify({ caseName: d.caseName, input: canonical(d.input), recordedAt: new Date().toISOString(), seed: status.run.seed }, null, 2));
                  setCopied('regression');
                }
          }
        />
      ) : null}

      <div style={{ marginTop: '2.5rem' }}>
        <HonestLimits m={m} runs={RUNS} />
      </div>

      {timing ? <ExorcismChart timing={timing} manifest={m} /> : null}

      <section className="tabs">
        <div className="tablist" role="tablist" aria-label="More about this package">
          {(
            [
              ['ouija', 'Try any input'],
              ['evidence', 'Evidence'],
              ['will', 'Spec and source'],
              ['home', 'Take it home'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'ouija' ? <Ouija pkg={pkg} cases={cases} /> : null}
          {tab === 'evidence' ? <Evidence m={m} /> : null}
          {tab === 'will' ? <WillAndBody pkg={pkg} /> : null}
          {tab === 'home' ? <TakeHome m={m} /> : null}
        </div>
      </section>
    </>
  );
}

/** A hash in groups of eight, so two of them can be compared by eye. */
function groups(hash: string): string {
  return hash.match(/.{1,8}/g)?.join(' ') ?? hash;
}
