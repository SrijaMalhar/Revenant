import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InputError, ScanError, describeInput, parseScanInput, scan } from '@revenant/core/graveyard';
import { rankDead } from '@revenant/core/zombie';
import type { GraveNode, GraveyardReport, ScanInput } from '@revenant/core/types';
import { Drawer } from '../components/Drawer.tsx';
import { Horizon } from '../components/Horizon.tsx';
import { OssuaryTable } from '../components/OssuaryTable.tsx';
import { ShareCard } from '../components/ShareCard.tsx';
import { StoneSkeleton, Tombstone } from '../components/Tombstone.tsx';
import { advanceTour, startTour } from '../components/Tour.tsx';
import { date, num } from '../lib/format.ts';
import { decorate, epitaph } from '../lib/graveyard.ts';
import { ossuaryIndex, type OssuaryEntry } from '../lib/ossuary.ts';
import { navigate, scrollToHash, useLocation } from '../lib/router.ts';
import { PROXY, loadDemoReport } from '../lib/scan.ts';

const SAMPLES = ['SrijaMalhar/revenant-demo', 'eslint/eslint', 'expressjs/express'];

type State =
  | { kind: 'empty' }
  | { kind: 'scanning'; label: string; checked: number; total: number }
  | { kind: 'done'; report: GraveyardReport }
  | { kind: 'error'; message: string; raw: string };

export function Graveyard() {
  const { search } = useLocation();
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ kind: 'empty' });
  const [streamed, setStreamed] = useState<GraveNode[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [ossuary, setOssuary] = useState<OssuaryEntry[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [preview, setPreview] = useState<GraveyardReport | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    ossuaryIndex().then(setOssuary, () => setOssuary([]));
    loadDemoReport().then(setPreview, () => setPreview(null));
    if (window.location.hash) scrollToHash(window.location.hash);
  }, []);

  const showDemo = useCallback(async () => {
    const demo = await loadDemoReport();
    if (demo) {
      setStreamed([]);
      setState({ kind: 'done', report: demo });
    } else {
      setState({ kind: 'error', message: 'No recorded scan is available on this copy of the site.', raw: '' });
    }
  }, []);

  const run = useCallback(async (raw: string) => {
    let input: ScanInput;
    try {
      input = parseScanInput(raw);
    } catch (e) {
      setState({ kind: 'error', message: e instanceof InputError ? e.message : String(e), raw });
      return;
    }
    if (input.kind === 'github') navigate(`/?repo=${encodeURIComponent(`${input.owner}/${input.repo}${input.ref ? `/tree/${input.ref}` : ''}`)}`, true);
    const id = ++runId.current;
    let first: Date | null = null;
    setStreamed([]);
    setOpen(null);
    setState({ kind: 'scanning', label: describeInput(input), checked: 0, total: 0 });
    let proxyDown = false;
    try {
      const report = await scan(input, {
        fetch: async (url, init) => {
          try {
            const res = await fetch(url, init);
            if (res.status >= 502 && res.status <= 504) proxyDown = true;
            return res;
          } catch (e) {
            proxyDown = true;
            throw e;
          }
        },
        now: () => {
          const d = new Date();
          if (!first) {
            first = d;
            setStartedAt(d.toISOString());
          }
          return d;
        },
        proxy: PROXY,
        onNode: (n) => id === runId.current && setStreamed((s) => [...s, n]),
        onProgress: (checked, total) => id === runId.current && setState({ kind: 'scanning', label: describeInput(input), checked, total }),
      });
      if (id === runId.current) setState({ kind: 'done', report });
    } catch (e) {
      if (id !== runId.current) return;
      // If the upstream services can't be reached at all, fall back to the recorded scan and say so.
      if (proxyDown || !(e instanceof ScanError)) {
        const demo = await loadDemoReport();
        if (demo) {
          setState({ kind: 'done', report: demo });
          return;
        }
      }
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e), raw });
    }
  }, []);

  // Permalinks: /?repo=owner/name scans on load; /?demo=1 shows the recorded scan.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const repo = search.get('repo');
    if (search.get('demo') === '1') void showDemo();
    else if (repo) {
      setText(repo);
      void run(repo);
    }
  }, [search, run, showDemo]);

  const report = state.kind === 'done' ? state.report : null;
  const scannedAt = report?.scannedAt ?? startedAt ?? new Date().toISOString();
  const nodes = report ? report.nodes : streamed;
  const ranked = useMemo(() => rankDead(nodes, { scannedAt, ossuary }), [nodes, scannedAt, ossuary]);
  const selected = ranked.find((r) => `${r.node.name}@${r.node.version}` === open);
  const permalink = report?.input.kind === 'github' ? `${window.location.origin}/?repo=${report.input.owner}/${report.input.repo}` : window.location.origin;
  const counts = {
    replace: ranked.filter((r) => r.score.action === 'replace').length,
    revive: ranked.filter((r) => r.score.action === 'revive').length,
  };

  return (
    <>
      <section className="hero" aria-labelledby="hero-h">
        <h1 id="hero-h">Your dependency tree has a graveyard. Walk it.</h1>
        <p className="prose">
          Revenant reads a project's npm dependencies and finds every package with no release in three years. Each one gets a tombstone, a Zombie Index from 0 to 100, and what to do about it.
        </p>
        <form
          className="scan-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(text);
          }}
        >
          <label htmlFor="scan-input">GitHub repo or package.json URL</label>
          <div className="scan-row">
            <input
              id="scan-input"
              type="text"
              value={text}
              placeholder="owner/repo"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="primary" disabled={state.kind === 'scanning' || !text.trim()}>
              {state.kind === 'scanning' ? 'Scanning…' : 'Scan repo'}
            </button>
          </div>
          <p className="samples">
            <span className="meta">Try</span>
            {SAMPLES.map((s, i) => (
              <button
                key={s}
                type="button"
                className="chip sample"
                data-tour={i === 0 ? 'example' : undefined}
                disabled={state.kind === 'scanning'}
                onClick={() => {
                  setText(s);
                  if (i === 0) advanceTour('example');
                  void run(s);
                }}
              >
                {s}
              </button>
            ))}
          </p>
          <p className="caption">
            New here?{' '}
            <button type="button" className="link" onClick={startTour}>
              Take the 60-second tour
            </button>
          </p>
        </form>
      </section>

      <section className="field" aria-labelledby="field-h" aria-busy={state.kind === 'scanning'}>
        <h2 id="field-h" className="visually-hidden">
          The graveyard
        </h2>
        <div className="status" aria-live="polite">
          {state.kind === 'scanning' ? (
            <p className="summary">
              Scanning {state.label} · {state.total ? `${num(state.checked)} of ${num(state.total)} packages checked` : 'reading the dependency graph'} · {ranked.length} dead so far
            </p>
          ) : null}
          {report ? (
            <div className="summary-row">
              <p className="summary">
                {describeInput(report.input)} · {num(report.nodes.length)} packages scanned · {ranked.length} dead · {counts.replace} replaceable · {counts.revive} revivable
              </p>
              {report.source === 'demo' ? <span className="chip">recorded {date(report.scannedAt)}</span> : null}
              <button type="button" className="secondary" onClick={() => setSharing(true)}>
                Share
              </button>
            </div>
          ) : null}
        </div>

        {state.kind === 'empty' ? <EmptyState preview={preview} ossuary={ossuary} onOpen={() => void showDemo()} /> : null}

        {state.kind === 'error' ? (
          <div className="notice error" role="alert">
            <p>{state.message}</p>
            <p className="actions">
              {state.raw ? (
                <button type="button" className="secondary" onClick={() => void run(state.raw)}>
                  Try again
                </button>
              ) : null}
              {preview ? (
                <button type="button" className="secondary" onClick={() => void showDemo()}>
                  Open the recorded scan
                </button>
              ) : null}
            </p>
          </div>
        ) : null}

        {report && report.errors.length ? (
          <details className="notice">
            <summary>
              {report.errors.length} {report.errors.length === 1 ? 'thing' : 'things'} Revenant couldn't fully read, so some numbers are listed as unknown.
            </summary>
            <ul>
              {report.errors.map((e) => (
                <li key={`${e.at}:${e.message}`}>
                  <span className="mono">{e.at}</span>: {e.message}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {report?.truncated ? <p className="notice">The scan stopped at its limit (1,500 packages or 60 seconds), so this is part of the tree.</p> : null}
        {report && ranked.length === 0 ? <p className="notice">Nothing here has gone three years without a release. Nothing to dig up.</p> : null}

        {state.kind === 'scanning' || ranked.length ? (
          <ol className="stones" aria-label="Dead packages, worst first">
            {ranked.map(({ node, score }, i) => {
              const key = `${node.name}@${node.version}`;
              return (
                <li key={key}>
                  <Tombstone
                    node={node}
                    score={score}
                    deco={decorate(node, scannedAt, score)}
                    scannedAt={scannedAt}
                    index={i}
                    epitaph={epitaph(node, scannedAt)?.text ?? null}
                    onOpen={() => {
                      if (score.action === 'revive') advanceTour('revive-stone');
                      setOpen(key);
                    }}
                  />
                </li>
              );
            })}
            {state.kind === 'scanning' && ranked.length < 4
              ? Array.from({ length: 4 - ranked.length }, (_, i) => (
                  <li key={`skeleton-${i}`}>
                    <StoneSkeleton />
                  </li>
                ))
              : null}
          </ol>
        ) : null}

        {report ? (
          <p className="caption">
            Data from deps.dev and the npm registry, read {date(report.scannedAt)}. deps.dev resolves each dependency's graph on its own, so the merged graph is close to, but not exactly, what npm install produces. Replacements from e18e
            module-replacements.
          </p>
        ) : null}
      </section>

      <HowItWorks />
      <OssuaryTable />

      {selected ? (
        <Drawer
          node={selected.node}
          score={selected.score}
          scannedAt={scannedAt}
          demo={report?.source === 'demo'}
          revivable={ossuary.some((o) => o.name === selected.node.name) ? selected.node.name : null}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {sharing && report ? <ShareCard report={report} ranked={ranked} permalink={permalink} onClose={() => setSharing(false)} /> : null}
    </>
  );
}

function EmptyState({ preview, ossuary, onOpen }: { preview: GraveyardReport | null; ossuary: OssuaryEntry[]; onOpen: () => void }) {
  const ranked = useMemo(() => (preview ? rankDead(preview.nodes, { scannedAt: preview.scannedAt, ossuary }) : []), [preview, ossuary]);
  return (
    <div className="empty">
      <p className="empty-line">Paste a repo to walk the graveyard.</p>
      {preview && ranked.length ? (
        <figure className="horizon-wrap">
          <Horizon ranked={ranked} scannedAt={preview.scannedAt} />
          <figcaption className="caption">
            A real scan of <span className="mono">{describeInput(preview.input)}</span>, recorded {date(preview.scannedAt)}: {ranked.length} dead out of {num(preview.nodes.length)} packages. Taller stones have gone longer without a
            release.{' '}
            <button type="button" className="link" onClick={onOpen}>
              Open this graveyard
            </button>
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="how" id="how-it-works" aria-labelledby="how-h">
      <h2 id="how-h">How it works</h2>
      <ol className="steps">
        <li>
          <h3>Scan</h3>
          <p>Reads the repo's package.json and builds the whole dependency tree from deps.dev, dev dependencies included, because those run on your machine and in CI.</p>
        </li>
        <li>
          <h3>Score</h3>
          <p>Every package with no release in three years gets a Zombie Index from 0 to 100: how long it's been abandoned, how much it could hurt you, and how many people still install it.</p>
        </li>
        <li>
          <h3>Replace or revive</h3>
          <p>If e18e's module-replacements list has a maintained alternative, the tombstone points there. If Revenant has rebuilt the package, it says Revive.</p>
        </li>
        <li>
          <h3>Soul Match</h3>
          <p>The original and the rebuild run side by side on 100,000 generated inputs in your browser. Same soul means the same answer every time, or both throw. It's a differential test, not a proof.</p>
        </li>
      </ol>
    </section>
  );
}
