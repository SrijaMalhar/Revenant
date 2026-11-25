import { useEffect, useRef, useState } from 'react';
import { DEFAULT_LIMITS, Upstream, getYearOfDownloads } from '@revenant/core/graveyard';
import { E18E_SOURCE } from '@revenant/core';
import type { GraveNode, ZombieScore } from '@revenant/core/types';
import { date, num } from '../lib/format.ts';
import { linkHandler } from '../lib/router.ts';
import { PROXY } from '../lib/scan.ts';
import { DeathCertificate } from './DeathCertificate.tsx';
import { DownloadsLine, Heartbeat } from './Heartbeat.tsx';
import { Prov } from './Provenance.tsx';
import { actionLabel } from './Tombstone.tsx';
import { band } from '../lib/graveyard.ts';

export function Drawer({
  node,
  score,
  scannedAt,
  demo,
  revivable,
  onClose,
}: {
  node: GraveNode;
  score: ZombieScore;
  scannedAt: string;
  demo: boolean;
  revivable: string | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [weeks, setWeeks] = useState<{ week: string; downloads: number }[] | 'loading' | 'unavailable'>(demo ? 'unavailable' : 'loading');
  const [cert, setCert] = useState(false);
  const v = node.vitals;
  const scanDay = scannedAt.slice(0, 10);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The year of downloads is fetched only when a drawer opens, to keep the scan light.
  useEffect(() => {
    if (demo) return;
    let live = true;
    getYearOfDownloads(new Upstream(fetch.bind(window), DEFAULT_LIMITS, PROXY), node.name)
      .then((w) => live && setWeeks(w))
      .catch(() => live && setWeeks('unavailable'));
    return () => {
      live = false;
    };
  }, [node.name, demo]);

  const b = band(score.total);
  const factors = [
    { name: 'Abandonment', value: score.parts.abandonment, max: 40, why: reasons(score.explain, ['Abandonment']) },
    { name: 'Attack surface', value: score.parts.attackSurface, max: 40, why: reasons(score.explain, ['Attack surface', 'Maintainers']) },
    { name: 'Reach', value: score.parts.reach, max: 20, why: reasons(score.explain, ['Reach', 'Weekly downloads']) },
  ];

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer-head">
          <div>
            <h2 id="drawer-title" className="mono">
              {node.name}
            </h2>
            <p className="meta">
              {node.version} installed, {v.latestVersion} latest
            </p>
          </div>
          <button ref={closeRef} type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </header>

        <nav className="path" aria-label="How it got into the tree">
          <ol>
            {node.path.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <p className="caption">
            One path, the shortest: the merged graph keeps only that one. Reached {node.dev ? 'only through devDependencies, so it runs on developer machines and in CI' : 'through production dependencies'}.
          </p>
        </nav>

        <section aria-labelledby="score-h">
          <h3 id="score-h">Zombie Index</h3>
          <p className={`drawer-index band-${b}`}>
            <span className="n">{score.total}</span> <span className="band-word">{b}</span>
          </p>
          <table className="factors">
            <caption className="visually-hidden">The three parts of the Zombie Index</caption>
            <thead>
              <tr>
                <th scope="col">Factor</th>
                <th scope="col" className="num">
                  Score
                </th>
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>
              {factors.map((f) => (
                <tr key={f.name}>
                  <th scope="row">{f.name}</th>
                  <td className="num">
                    {f.value.toFixed(1)} <span className="of">/ {f.max}</span>
                  </td>
                  <td>{f.why}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className="num">
                  {score.total} <span className="of">/ 100</span>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </section>

        <section aria-labelledby="downloads-h">
          <h3 id="downloads-h">Downloads</h3>
          {weeks === 'loading' ? <p className="caption">Loading the last year of downloads…</p> : null}
          {Array.isArray(weeks) ? (
            <>
              <DownloadsLine weeks={weeks} />
              <p className="caption">
                Weekly downloads over the last year, {num(weeks.reduce((a, w) => a + w.downloads, 0))} in total
                <Prov source="npm" at={scanDay} detail="api.npmjs.org downloads range" />.
              </p>
            </>
          ) : null}
          {weeks === 'unavailable' ? (
            <p className="caption">
              {v.weeklyDownloads === null ? 'Weekly downloads unknown' : `${num(v.weeklyDownloads)} downloads last week`}
              <Prov source="npm" at={scanDay} />. The full year isn't available{demo ? ' in demo mode' : ' right now'}.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="action-h">
          <h3 id="action-h">What to do</h3>
          <p>
            <span className={`chip action-${score.action}`}>{actionLabel(node, score)}</span>
          </p>
          {score.action === 'replace' ? (
            <p className="small">
              From the{' '}
              <a href={E18E_SOURCE.url} target="_blank" rel="noreferrer">
                e18e module-replacements
              </a>{' '}
              list ({E18E_SOURCE.version}): {node.replacement!.replacements.join(', ')}.
            </p>
          ) : null}
          {revivable ? (
            <p>
              <a className="button primary" href={`/ossuary/${revivable}`} onClick={linkHandler(`/ossuary/${revivable}`)} data-tour="open-soul">
                Open the Soul Match for {revivable}
              </a>
            </p>
          ) : null}
          {score.action === 'watch' ? <p className="small">No maintained replacement is listed and Revenant hasn't rebuilt it. Keep an eye on it.</p> : null}
        </section>

        <section aria-labelledby="pulse-h">
          <h3 id="pulse-h">Release history</h3>
          <Heartbeat vitals={v} scannedAt={scannedAt} width={420} height={44} className="heartbeat-lg" />
          <p className="caption">
            Releases by year from deps.dev publish dates
            <Prov source="deps.dev" at={scanDay} />. Last release {date(v.lastRelease)}.
          </p>
        </section>

        <section aria-labelledby="vitals-h">
          <h3 id="vitals-h">Vitals</h3>
          <table className="kv">
            <tbody>
              <tr>
                <th scope="row">Maintainer accounts</th>
                <td>
                  {v.maintainers ?? 'unknown'}
                  <Prov source="npm" at={scanDay} detail="count only, from the package document" />
                </td>
              </tr>
              <tr>
                <th scope="row">Install scripts</th>
                <td>{v.installScripts ? 'yes' : 'none'}</td>
              </tr>
              <tr>
                <th scope="row">Open advisories</th>
                <td>
                  {v.advisories.length ? v.advisories.join(', ') : 'none'}
                  <Prov source="deps.dev" at={scanDay} />
                </td>
              </tr>
              <tr>
                <th scope="row">Deprecated</th>
                <td>{v.deprecated ?? 'no'}</td>
              </tr>
            </tbody>
          </table>
          <button type="button" className="secondary" onClick={() => setCert(true)}>
            Issue a death certificate
          </button>
        </section>

        <section aria-labelledby="legend-h">
          <h3 id="legend-h">Reading a tombstone</h3>
          <table className="kv">
            <tbody>
              <tr>
                <th scope="row">Height</th>
                <td>Years since the last release, up to 10</td>
              </tr>
              <tr>
                <th scope="row">Years</th>
                <td>First and last release</td>
              </tr>
              <tr>
                <th scope="row">Number and word</th>
                <td>Zombie Index: low under 40, medium 40 to 59, high 60 and up</td>
              </tr>
              <tr>
                <th scope="row">The line</th>
                <td>One spike per year of releases, flat since the last one</td>
              </tr>
              <tr>
                <th scope="row">A crack</th>
                <td>At least one open advisory</td>
              </tr>
              <tr>
                <th scope="row">A chain</th>
                <td>Install scripts</td>
              </tr>
              <tr>
                <th scope="row">Dashed outline</th>
                <td>Revenant couldn't read all of its data</td>
              </tr>
            </tbody>
          </table>
        </section>
        {cert ? <DeathCertificate node={node} scannedAt={scannedAt} onClose={() => setCert(false)} /> : null}
      </aside>
    </>
  );
}

/** The explanation lines for one factor, without the "Factor +12: " prefix. */
function reasons(explain: string[], prefixes: string[]): string {
  const lines = explain.filter((l) => prefixes.some((p) => l.startsWith(p))).map((l) => l.replace(/^(Abandonment|Attack surface|Reach) \+[\d.]+:\s*/, ''));
  return lines.length ? lines.join('; ') : 'nothing adds to this';
}
