import { useEffect, useState } from 'react';
import type { OssuaryManifest } from '@revenant/core/types';
import { ExorcismChart, Race } from '../components/ExorcismChart.tsx';
import { exorcism, manifest as loadManifest, type ExorcismTiming } from '../lib/ossuary.ts';
import { linkHandler } from '../lib/router.ts';

/** /ossuary/<pkg>/exorcism: the one chart that shows a known slowdown bug gone. */
export function Exorcism({ pkg }: { pkg: string }) {
  const [data, setData] = useState<{ m: OssuaryManifest; timing: ExorcismTiming | null } | 'missing' | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadManifest(pkg), exorcism(pkg)])
      .then(([m, timing]) => live && setData({ m, timing }))
      .catch(() => live && setData('missing'));
    return () => {
      live = false;
    };
  }, [pkg]);

  const crumbs = (
    <nav className="crumbs" aria-label="Breadcrumb">
      <a href="/#ossuary" onClick={linkHandler('/#ossuary')}>
        The Ossuary
      </a>
      <span aria-hidden="true">/</span>
      <a href={`/ossuary/${pkg}`} onClick={linkHandler(`/ossuary/${pkg}`)}>
        {pkg}
      </a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">Exorcism</span>
    </nav>
  );

  if (data === null) {
    return (
      <>
        {crumbs}
        <header className="page-head">
          <h1>The exorcism</h1>
          <p className="caption">Loading the timings…</p>
        </header>
        <div className="chart-skeleton" aria-hidden="true" />
      </>
    );
  }
  if (data === 'missing' || !data.timing) {
    return (
      <>
        {crumbs}
        <header className="page-head">
          <h1>No exorcism for {pkg}</h1>
          <p className="prose">
            Only timespan had a known bug to fix.{' '}
            <a href="/ossuary/timespan/exorcism" onClick={linkHandler('/ossuary/timespan/exorcism')}>
              See timespan's exorcism
            </a>
            .
          </p>
        </header>
      </>
    );
  }

  const { m, timing } = data;
  return (
    <>
      {crumbs}
      <header className="page-head">
        <h1>The exorcism</h1>
        <p className="prose">
          {m.name}'s <code>parseDate</code> slows down badly on a long run of digits:{' '}
          <a href={timing.advisory.url} target="_blank" rel="noreferrer">
            {timing.advisory.cve}
          </a>
          , never patched. Doubling the input roughly quadruples the original's time. The revived parser reads the same modifiers in one pass and gives the same answer on every other input.
        </p>
      </header>
      <ExorcismChart timing={timing} manifest={m} />
      <Race />
    </>
  );
}
