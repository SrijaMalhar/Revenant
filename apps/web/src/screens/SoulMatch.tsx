import { useCallback, useEffect, useRef, useState } from 'react';
import { canonical } from '@revenant/core/soul';
import type { OssuaryManifest, SoulMatchRun, Soulprint } from '@revenant/core/types';
import { Evidence, HonestLimits } from '../components/Evidence.tsx';
import { Ouija, type CaseInfo } from '../components/Ouija.tsx';
import { Prov } from '../components/Provenance.tsx';
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
type Tab = 'run' | 'seance' | 'possess' | 'will';

// Case names and examples come from the package's cases.ts, loaded lazily so
// the graveyard never pays for fast-check.
const caseModules = import.meta.glob<{ default: { name: string; examples?: string[]; parse?: unknown }[] }>('../../../../ossuary/*/cases.ts');
async function caseInfo(pkg: string): Promise<CaseInfo[]> {
  const entry = Object.entries(caseModules).find(([p]) => p.endsWith(`/ossuary/${pkg}/cases.ts`));
  if (!entry) return [];
  return (await entry[1]()).default.map((c) => ({ name: c.name, examples: c.examples ?? [], hasParse: typeof c.parse === 'function' }));
}

export function SoulMatch({ pkg }: { pkg: string }) {
  const { search } = useLocation();
  const initialTarget = (search.get('target') as Target | null) ?? 'revived';
  const [m, setM] = useState<OssuaryManifest | null | 'missing'>(null);
  const [print, setPrint] = useState<Soulprint | null>(null);
  const [timing, setTiming] = useState<ExorcismTiming | null>(null);
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [tab, setTab] = useState<Tab>(initialTarget.startsWith('possessed:') ? 'possess' : initialTarget === 'replay' ? 'seance' : 'run');
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
      setCopied(null);
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
      w.onerror = (e) => setStatus({ kind: 'error', message: e.message || 'The worker stopped without an answer.' });
      w.postMessage({ type: 'run', pkg, target: t, numRuns: RUNS, seed });
      navigate(`/ossuary/${pkg}?seed=${seed}&target=${encodeURIComponent(t)}`, true);
    },
    [pkg],
  );

  // /ossuary/:pkg?seed=S&target=T re-runs that exact Soul Match on load.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !m || m === 'missing') return;
    const seed = search.get('seed');
    if (seed !== null && /^\d+$/.test(seed)) {
      autoRan.current = true;
      start(initialTarget, Number(seed));
    }
  }, [m, search, start, initialTarget]);

  if (m === 'missing') {
    return (
      <section className="page-head">
        <h1>{pkg} isn't in the Ossuary</h1>
        <p className="prose">
          Revenant has rebuilt type-check, path-browserify and timespan.{' '}
          <a href="/#ossuary" onClick={linkHandler('/#ossuary')}>
            See the Ossuary
          </a>
        </p>
      </section>
    );
  }
  if (!m) return <SoulSkeleton pkg={pkg} />;

  const running = status.kind === 'running';
  const target: Target | null = status.kind === 'running' || status.kind === 'done' ? status.target : null;
  const done = status.kind === 'running' ? status.done : status.kind === 'done' ? status.run.done : 0;
  const total = status.kind === 'running' ? status.total : status.kind === 'done' ? status.run.numRuns : RUNS;
  const seed = status.kind === 'running' ? status.seed : status.kind === 'done' ? status.run.seed : null;
  const possessed = target?.startsWith('possessed:') ? m.possessions?.find((p) => `possessed:${p.id}` === target) : undefined;
  const verdict = status.kind === 'done' ? status.run.status : null;
  const state = status.kind === 'idle' ? 'idle' : status.kind === 'running' ? 'running' : status.kind === 'error' || verdict === 'error' ? 'error' : verdict === 'same-soul' ? 'same' : 'diverged';
  const word = { idle: 'not run yet', running: 'checking', same: 'same soul', diverged: possessed ? 'caught' : 'diverged', error: 'stopped' }[state];
  const against = possessed ? `the planted bug "${possessed.title}"` : target === 'replay' ? 'the recorded failing draft' : 'the revived package';
  const runLink = seed === null || !target ? '' : `${window.location.origin}/ossuary/${pkg}?seed=${seed}&target=${encodeURIComponent(target)}`;
  const d = m.delta;

  const runTarget = (t: Target) => start(t, Math.floor(Math.random() * 2 ** 31));
  const stop = () => {
    worker.current?.terminate();
    setStatus({ kind: 'idle' });
  };

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="/#ossuary" onClick={linkHandler('/#ossuary')}>
          The Ossuary
        </a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{m.name}</span>
      </nav>
      <header className="page-head">
        <h1 className="mono">{m.name}</h1>
        <p className="prose">
          Revived from {m.name} {m.version} by {m.author}, {m.license} licensed. No dependencies and no install scripts.
          {timing ? (
            <>
              {' '}
              <a href={`/ossuary/${m.name}/exorcism`} onClick={linkHandler(`/ossuary/${m.name}/exorcism`)}>
                See the exorcism of {timing.advisory.cve}
              </a>
              .
            </>
          ) : null}
        </p>
      </header>

      <section className={`counter-block state-${state}`} aria-labelledby="counter-h">
        <h2 id="counter-h" className="visually-hidden">
          Soul Match
        </h2>
        <p className="counter" role="status" aria-live="polite" aria-atomic="true">
          <span className="count">
            {num(done)} / {num(total)}
          </span>{' '}
          <span className="word">{word}</span>
        </p>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${total ? (100 * done) / total : 0}%` }} />
        </div>
        <div className="counter-note">
          {state === 'idle' ? <p>The original and the revived package answer the same 100,000 generated inputs in your browser. Same soul means every answer matches, and if one side throws, so does the other.</p> : null}
          {state === 'running' ? (
            <p>
              Running against {against}. Seed <span className="mono">{seed}</span>.{' '}
              <button type="button" className="link" onClick={stop}>
                Stop
              </button>
            </p>
          ) : null}
          {state === 'same' && status.kind === 'done' ? (
            <p>
              Every answer matched, in {num(status.run.millis)} ms. Seed <span className="mono">{seed}</span>.{' '}
              <CopyLink text={runLink} copied={copied === 'run'} onCopied={() => setCopied('run')} />
            </p>
          ) : null}
          {state === 'diverged' ? (
            <p>
              {possessed ? 'Soul Match caught the planted bug.' : 'The two answers split on one input.'} The shrunk input is below. Seed <span className="mono">{seed}</span>.{' '}
              <CopyLink text={runLink} copied={copied === 'run'} onCopied={() => setCopied('run')} />
            </p>
          ) : null}
          {status.kind === 'done' && verdict === 'error' ? <p className="error">The run stopped: {status.run.error}</p> : null}
          {status.kind === 'error' ? <p className="error">The run stopped: {status.message}</p> : null}
        </div>
      </section>

      {status.kind === 'done' && status.run.divergence ? (
        <Seance
          d={status.run.divergence}
          label={possessed ? `Planted bug caught: ${possessed.title}` : status.target === 'replay' && m.replay ? `Replay of draft 1, recorded ${date(m.replay.recordedAt)}` : 'Where the answers split'}
          onCopyRegression={
            possessed
              ? undefined
              : async () => {
                  const dv = status.run.divergence!;
                  await navigator.clipboard.writeText(JSON.stringify({ caseName: dv.caseName, input: canonical(dv.input), recordedAt: new Date().toISOString(), seed: status.run.seed }, null, 2));
                  setCopied('regression');
                }
          }
        />
      ) : null}

      <div className="sides-grid">
        <Side
          role="Original"
          title={`${m.name} ${m.version}`}
          rows={[
            ['By', `${m.author}, ${m.license}`],
            ['Packages installed', d ? num(d.subtreePackages[0]) : 'unknown'],
            ['Install scripts', d ? num(d.installScripts[0]) : 'unknown'],
            ['Maintainer accounts', d ? num(d.maintainerAccounts[0]) : 'unknown'],
            ['Size, gzipped', d ? `${num(d.gzipBytes[0])} B` : 'unknown'],
            ['Speed', d ? `${num(d.opsPerSec[0])} passes a second` : 'unknown'],
            ['Last release', m.released ? date(m.released.last) : 'unknown'],
          ]}
          print={print?.sha256 ?? null}
        />
        <Side
          role="Revived"
          title={`${m.name} ${m.version}, revived`}
          rows={[
            ['By', `credits ${m.author}, keeps ${m.license}`],
            ['Packages installed', d ? num(d.subtreePackages[1]) : 'unknown'],
            ['Install scripts', d ? num(d.installScripts[1]) : 'unknown'],
            ['Maintainer accounts', d ? num(d.maintainerAccounts[1]) : 'unknown'],
            ['Size, gzipped', d ? `${num(d.gzipBytes[1])} B` : 'unknown'],
            ['Speed', d ? `${num(d.opsPerSec[1])} passes a second` : 'unknown'],
            ['Last release', 'rebuilt here'],
          ]}
          print={print?.sha256 ?? null}
        >
          <TakeHome m={m} />
        </Side>
      </div>
      <p className="caption">
        {d ? (
          <>
            Packages and maintainers from the npm registry, size from esbuild, speed from tinybench on Node, all measured {date(d.measuredAt)}
            <Prov source="build" at={d.measuredAt} detail="npm run receipt" />. The rebuild is vendored, so it pulls nothing from the registry. Bigger or slower is shown as it is.{' '}
          </>
        ) : null}
        {print ? (
          <>
            Each Soulprint is a SHA-256 over the answers to {num(print.n)} inputs per case, seed {print.seed}, fast-check {print.fastCheck}. The two are identical
            <Prov source="ci" at="" detail="npm run soulprint:check recomputes both hashes" />.
          </>
        ) : null}
      </p>

      <section className="tabs" aria-label="Soul Match tools">
        <div className="tablist" role="tablist">
          {(
            [
              ['run', 'Run'],
              ['seance', 'Séance'],
              ['possess', 'Possess it'],
              ['will', 'Will and body'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
          {tab === 'run' ? (
            <>
              <p className="actions">
                {running && target === 'revived' ? (
                  <button type="button" className="secondary" onClick={stop}>
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary"
                    data-tour="run"
                    disabled={running}
                    onClick={() => {
                      advanceTour('run');
                      runTarget('revived');
                    }}
                  >
                    Run {num(RUNS)} inputs
                  </button>
                )}
              </p>
              {status.kind === 'done' && status.run.perCase ? (
                <table className="cases">
                  <caption>Inputs per case in the last run</caption>
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
                        <td className="mono">{c.name}</td>
                        <td className="num">{num(c.runs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <h3>Try any input</h3>
              <Ouija pkg={pkg} cases={cases} />
              <h3>Evidence</h3>
              <Evidence m={m} />
              <HonestLimits m={m} runs={RUNS} />
            </>
          ) : null}

          {tab === 'seance' ? (
            <div className="stack">
              <p className="prose">The séance replays a draft of the rebuild that once failed Soul Match, so you can watch the original catch it. Only real failing drafts are kept; nothing is staged.</p>
              {m.replay ? (
                <>
                  <p className="caption">
                    Draft 1, recorded {date(m.replay.recordedAt)}. {m.replay.note}
                  </p>
                  <p className="actions">
                    <button type="button" className="primary" disabled={running} onClick={() => runTarget('replay')}>
                      Replay draft 1
                    </button>
                  </p>
                </>
              ) : (
                <p className="notice">No draft of {m.name} has failed Soul Match yet, so there's nothing real to replay.</p>
              )}
            </div>
          ) : null}

          {tab === 'possess' ? (
            <div className="stack">
              <p className="prose">Plant a known bug in the revived package and see whether Soul Match notices. These are labeled test fixtures, kept apart from the séance.</p>
              {m.possessions?.length ? (
                <table className="possessions">
                  <caption>
                    Recorded in CI: caught {m.possessions.filter((p) => p.caught).length} of {m.possessions.length}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Planted bug</th>
                      <th scope="col" className="num">
                        Caught after
                      </th>
                      <th scope="col">
                        <span className="visually-hidden">Run</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.possessions.map((p) => (
                      <tr key={p.id}>
                        <td>{p.title}</td>
                        <td className="num">{p.caught ? (p.inputsToCatch ? `${num(p.inputsToCatch)} inputs` : 'caught') : 'survived'}</td>
                        <td className="num">
                          <button type="button" className="secondary" disabled={running} onClick={() => runTarget(`possessed:${p.id}`)}>
                            Run against it
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="notice">No planted bugs for {m.name} yet.</p>
              )}
            </div>
          ) : null}

          {tab === 'will' ? <WillAndBody pkg={pkg} /> : null}
        </div>
      </section>
    </>
  );
}

function Side({ role, title, rows, print, children }: { role: string; title: string; rows: [string, string][]; print: string | null; children?: React.ReactNode }) {
  return (
    <article className="side" aria-label={role}>
      <p className="side-role">{role}</p>
      <h2 className="side-title mono">{title}</h2>
      <table className="kv">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{v}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Soulprint</th>
            <td className="hash">{print ? print.match(/.{1,8}/g)!.join(' ') : 'unknown'}</td>
          </tr>
        </tbody>
      </table>
      {children}
    </article>
  );
}

function CopyLink({ text, copied, onCopied }: { text: string; copied: boolean; onCopied: () => void }) {
  if (!text) return null;
  return (
    <button
      type="button"
      className="link"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        onCopied();
      }}
    >
      {copied ? 'Link copied' : 'Copy link to this run'}
    </button>
  );
}

function SoulSkeleton({ pkg }: { pkg: string }) {
  return (
    <div aria-busy="true">
      <header className="page-head">
        <h1 className="mono">{pkg}</h1>
        <p className="caption">Opening the Ossuary…</p>
      </header>
      <div className="counter-block skeleton">
        <span className="bar bar-counter" />
        <div className="progress" />
      </div>
    </div>
  );
}
