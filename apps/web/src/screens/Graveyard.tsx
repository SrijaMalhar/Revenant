import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InputError, ScanError, describeInput, parseScanInput, scan } from '@revenant/core/graveyard';
import { rankDead } from '@revenant/core/zombie';
import type { GraveNode, GraveyardReport, ScanInput } from '@revenant/core/types';
import { Drawer } from '../components/Drawer.tsx';
import { ShareCard } from '../components/ShareCard.tsx';
import { Tombstone } from '../components/Tombstone.tsx';
import { advanceTour, startTour } from '../components/Tour.tsx';
import { date, num } from '../lib/format.ts';
import { decorate, epitaph } from '../lib/graveyard.ts';
import { ossuaryIndex, type OssuaryEntry } from '../lib/ossuary.ts';
import { navigate, useLocation } from '../lib/router.ts';
import { EXAMPLE_MANIFEST, PROXY, loadDemoReport } from '../lib/scan.ts';

type State =
  | { kind: 'empty' }
  | { kind: 'scanning'; checked: number; total: number }
  | { kind: 'done'; report: GraveyardReport }
  | { kind: 'error'; message: string };

export function Graveyard() {
  const { search } = useLocation();
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ kind: 'empty' });
  const [streamed, setStreamed] = useState<GraveNode[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [ossuary, setOssuary] = useState<OssuaryEntry[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    ossuaryIndex().then(setOssuary, () => setOssuary([]));
  }, []);

  const showDemo = useCallback(async () => {
    const demo = await loadDemoReport();
    if (demo) {
      setStreamed([]);
      setState({ kind: 'done', report: demo });
    } else {
      setState({ kind: 'error', message: 'No demo report has been recorded yet. Run npm run fixtures -- <owner/repo> --demo to record one.' });
    }
  }, []);

  const run = useCallback(
    async (raw: string) => {
      let input: ScanInput;
      try {
        input = parseScanInput(raw);
      } catch (e) {
        setState({ kind: 'error', message: e instanceof InputError ? e.message : String(e) });
        return;
      }
      if (input.kind === 'github') navigate(`/?repo=${encodeURIComponent(`${input.owner}/${input.repo}${input.ref ? `/tree/${input.ref}` : ''}`)}`, true);
      const id = ++runId.current;
      let first: Date | null = null;
      setStreamed([]);
      setOpen(null);
      setState({ kind: 'scanning', checked: 0, total: 0 });
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
          onProgress: (checked, total) => id === runId.current && setState({ kind: 'scanning', checked, total }),
        });
        if (id === runId.current) setState({ kind: 'done', report });
      } catch (e) {
        if (id !== runId.current) return;
        // If the upstream services can't be reached, fall back to the recorded demo report.
        if (proxyDown || !(e instanceof ScanError)) {
          const demo = await loadDemoReport();
          if (demo) {
            setState({ kind: 'done', report: demo });
            return;
          }
        }
        setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    },
    [],
  );

  // Permalinks: /?repo=owner/name scans on load; /?demo=1 shows the recorded report.
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
  const top = ranked[0]?.score.total ?? -1;
  const selected = ranked.find((r) => `${r.node.name}@${r.node.version}` === open);
  const manifestMode = text.trimStart().startsWith('{');
  const permalink = report?.input.kind === 'github' ? `${window.location.origin}/?repo=${report.input.owner}/${report.input.repo}` : window.location.origin;

  return (
    <>
      <section className="dig" aria-labelledby="dig-h">
        <h1 id="dig-h">Dig up a project's dead dependencies</h1>
        <p className="muted">
          Paste a public GitHub repo or a package.json. Every package with no release in three years gets a tombstone. The worst ones that Revenant has rebuilt can be tested against their originals.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(text);
          }}
        >
          <label htmlFor="dig-input" className="visually-hidden">
            GitHub repo or package.json
          </label>
          <div className="dig-row">
            <textarea
              id="dig-input"
              className={manifestMode ? 'manifest' : undefined}
              value={text}
              placeholder="owner/repo or a package.json"
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (!manifestMode || e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void run(text);
                }
              }}
            />
            <button type="submit" disabled={state.kind === 'scanning' || !text.trim()}>
              Scan
            </button>
          </div>
        </form>
        <p className="small">
          <button
            type="button"
            className="link"
            data-tour="example"
            onClick={() => {
              setText(EXAMPLE_MANIFEST);
              advanceTour('example');
              void run(EXAMPLE_MANIFEST);
            }}
          >
            Try an example
          </button>
          <span className="muted">: a project with one popular linter installed. </span>
          <button type="button" className="link" onClick={startTour}>
            Take the 60-second tour
          </button>
        </p>
        <div className="status" aria-live="polite">
          {state.kind === 'scanning' ? (
            <p className="muted">
              {state.total ? `Checked ${num(state.checked)} of ${num(state.total)} packages` : 'Reading the dependency graph'}
              {streamed.length ? `, ${streamed.length} dead so far` : ''}…
            </p>
          ) : null}
          {state.kind === 'error' ? <p className="error">{state.message}</p> : null}
        </div>
      </section>

      {state.kind === 'empty' ? <EmptyField /> : null}

      {ranked.length > 0 || report ? (
        <section className="field" aria-labelledby="field-h">
          <div className="summary">
            <h2 id="field-h">
              {report ? describeInput(report.input) : 'Scanning'}
              {report ? <span className="muted">: {ranked.length} dead of {num(report.nodes.length)} packages</span> : null}
            </h2>
            {report?.source === 'demo' ? <span className="badge-demo">demo data, recorded {date(report.scannedAt)}</span> : null}
            {report ? (
              <button type="button" className="quiet" onClick={() => setSharing(true)}>
                Share
              </button>
            ) : null}
          </div>
          {report && ranked.length === 0 ? <p>Nothing here has gone three years without a release. Nothing to dig up.</p> : null}
          {report?.truncated ? <p className="small muted">The scan stopped at its limit (1,500 packages or 60 seconds), so this is part of the tree.</p> : null}
          <ol className="stones" aria-label="Dead packages, worst first">
            {ranked.map(({ node, score }) => {
              const key = `${node.name}@${node.version}`;
              const deco = decorate(node, scannedAt, top, score);
              return (
                <li key={key}>
                  <Tombstone
                    node={node}
                    score={score}
                    deco={deco}
                    scannedAt={scannedAt}
                    epitaph={epitaph(node, scannedAt)?.text ?? null}
                    onOpen={() => {
                      if (score.action === 'revive') advanceTour('revive-stone');
                      setOpen(key);
                    }}
                  />
                </li>
              );
            })}
          </ol>
          {report && report.errors.length ? (
            <details className="notes">
              <summary className="small">
                {report.errors.length} {report.errors.length === 1 ? 'thing' : 'things'} Revenant skipped or couldn't fully read
              </summary>
              <ul>
                {report.errors.map((e) => (
                  <li key={`${e.at}:${e.message}`}>
                    {e.at}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {report ? (
            <p className="small muted notes">
              Data from deps.dev and the npm registry, read {date(report.scannedAt)}. deps.dev resolves each dependency's graph on its own, so the merged graph is close to, but not exactly, what npm install produces. Replacements from e18e's module-replacements.
            </p>
          ) : null}
        </section>
      ) : null}

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

function EmptyField() {
  return (
    <section className="field" aria-label="What a scan shows">
      <p className="muted">
        Revenant resolves the whole dependency tree, dev dependencies included, because those run on your machine and in CI. A package that has had no release in three years becomes a tombstone with a Zombie Index from 0 to 100. If e18e lists a maintained replacement, the stone says so. If Revenant has rebuilt it, you can watch the rebuild agree with the original on 100,000 inputs.
      </p>
    </section>
  );
}
