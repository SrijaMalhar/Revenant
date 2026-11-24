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

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header>
          <div>
            <h2 id="drawer-title">{node.name}</h2>
            <p className="muted">
              {node.version} installed, {v.latestVersion} latest
            </p>
          </div>
          <button ref={closeRef} type="button" className="quiet" onClick={onClose}>
            Close
          </button>
        </header>

        <section aria-labelledby="score-h">
          <h3 id="score-h">
            Zombie Index <span className="total-line">{score.total}</span>
          </h3>
          <ul className="breakdown">
            {score.explain.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="small muted">
            Abandonment {score.parts.abandonment.toFixed(1)} of 40, attack surface {score.parts.attackSurface.toFixed(1)} of 40, reach {score.parts.reach.toFixed(1)} of 20.
          </p>
          <p>
            <span className={`action ${score.action}`}>{actionLabel(node, score)}</span>
          </p>
          {score.action === 'replace' ? (
            <p className="small">
              Replacement from the{' '}
              <a href={E18E_SOURCE.url} target="_blank" rel="noreferrer">
                e18e module-replacements
              </a>{' '}
              list ({E18E_SOURCE.version}): {node.replacement!.replacements.join(', ')}.
            </p>
          ) : null}
          {revivable ? (
            <p>
              <a className="button" href={`/soul/${revivable}`} onClick={linkHandler(`/soul/${revivable}`)} data-tour="open-soul">
                Run Soul Match on the revived {revivable}
              </a>
            </p>
          ) : null}
        </section>

        <section aria-labelledby="pulse-h">
          <h3 id="pulse-h">Pulse</h3>
          <Heartbeat vitals={v} scannedAt={scannedAt} width={420} height={44} className="heartbeat-lg" />
          <p className="small muted">
            Releases by year from deps.dev publish dates
            <Prov source="deps.dev" at={scanDay} />. Last release {date(v.lastRelease)}.
          </p>
          {weeks === 'loading' ? <p className="small muted">Loading the last year of downloads…</p> : null}
          {Array.isArray(weeks) ? (
            <>
              <DownloadsLine weeks={weeks} />
              <p className="small muted">
                Weekly downloads over the last year, {num(weeks.reduce((a, w) => a + w.downloads, 0))} in total
                <Prov source="npm" at={scanDay} detail="api.npmjs.org downloads range" />.
              </p>
            </>
          ) : null}
          {weeks === 'unavailable' ? <p className="small muted">The year of downloads isn't available{demo ? ' in demo mode' : ' right now'}.</p> : null}
        </section>

        <section aria-labelledby="path-h">
          <h3 id="path-h">How it got here</h3>
          <ol className="crumbs">
            {node.path.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <p className="small muted">
            One path, the shortest: the merged graph keeps only that one. Reached {node.dev ? 'only through devDependencies, so it runs on developer machines and in CI' : 'through production dependencies'}.
          </p>
        </section>

        <section aria-labelledby="vitals-h">
          <h3 id="vitals-h">Vitals</h3>
          <dl className="legend">
            <dt>Weekly downloads</dt>
            <dd>
              {v.weeklyDownloads === null ? 'unknown' : num(v.weeklyDownloads)}
              <Prov source="npm" at={scanDay} />
            </dd>
            <dt>Maintainer accounts</dt>
            <dd>
              {v.maintainers ?? 'unknown'}
              <Prov source="npm" at={scanDay} detail="count only, from the package document" />
            </dd>
            <dt>Install scripts</dt>
            <dd>{v.installScripts ? 'yes' : 'none'}</dd>
            <dt>Open advisories</dt>
            <dd>
              {v.advisories.length ? v.advisories.join(', ') : 'none'}
              <Prov source="deps.dev" at={scanDay} />
            </dd>
            <dt>Deprecated</dt>
            <dd>{v.deprecated ?? 'no'}</dd>
          </dl>
          <button type="button" className="quiet" onClick={() => setCert(true)}>
            Issue a death certificate
          </button>
        </section>

        <section aria-labelledby="legend-h">
          <h3 id="legend-h">Reading a tombstone</h3>
          <dl className="legend">
            <dt>Height</dt>
            <dd>Years since the last release, up to 10</dd>
            <dt>A crack</dt>
            <dd>At least one open advisory</dd>
            <dt>A chain</dt>
            <dd>Install scripts</dd>
            <dt>Glow</dt>
            <dd>The highest Zombie Index on screen</dd>
            <dt>Thick fog</dt>
            <dd>Revenant couldn't read all of its data</dd>
            <dt>The line</dt>
            <dd>One spike per year of releases, flat since the last one</dd>
          </dl>
        </section>
        {cert ? <DeathCertificate node={node} scannedAt={scannedAt} onClose={() => setCert(false)} /> : null}
      </aside>
    </>
  );
}
