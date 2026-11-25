import { useEffect, useState } from 'react';
import type { OssuaryManifest, Soulprint } from '@revenant/core/types';
import { exorcism, manifest, ossuaryIndex, soulprint, type ExorcismTiming } from '../lib/ossuary.ts';
import { linkHandler } from '../lib/router.ts';

interface Entry {
  m: OssuaryManifest;
  print: Soulprint | null;
  timing: ExorcismTiming | null;
}

/** The packages Revenant has rebuilt, each with numbers it measured itself. */
export function OssuaryShelf() {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    let live = true;
    ossuaryIndex()
      .then((idx) => Promise.all(idx.map(async (e) => ({ m: await manifest(e.name), print: await soulprint(e.name), timing: await exorcism(e.name) }))))
      .then(
        (list) => live && setEntries(list),
        () => live && setEntries([]),
      );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (entries?.length && window.location.hash === '#ossuary') document.getElementById('ossuary')?.scrollIntoView();
  }, [entries]);

  if (!entries?.length) return null;
  return (
    <section className="ossuary" id="ossuary" aria-labelledby="ossuary-h">
      <div className="ossuary-head">
        <h2 id="ossuary-h">The Ossuary</h2>
        <p className="muted">
          Dead packages Revenant has rebuilt in TypeScript with no dependencies. Each rebuild has to give the same answer as the original on 100,000 inputs before it gets in here.
        </p>
      </div>
      <ol className="risen">
        {entries.map(({ m, print, timing }) => {
          const caught = m.possessions?.filter((p) => p.caught).length ?? 0;
          const planted = m.possessions?.length ?? 0;
          return (
            <li key={m.name}>
              <a className="risen-stone" href={`/soul/${m.name}`} onClick={linkHandler(`/soul/${m.name}`)}>
                <span className="risen-name">{m.name}</span>
                <span className="risen-ver">
                  {m.version}, by {m.author}
                </span>
                <dl className="risen-facts">
                  {m.coverage ? (
                    <>
                      <dt>Branches reached</dt>
                      <dd>{m.coverage.branches}%</dd>
                    </>
                  ) : null}
                  {planted ? (
                    <>
                      <dt>Planted bugs caught</dt>
                      <dd>
                        {caught} of {planted}
                      </dd>
                    </>
                  ) : null}
                  {timing ? (
                    <>
                      <dt>Fixed</dt>
                      <dd>{timing.advisory.cve}</dd>
                    </>
                  ) : null}
                  {print ? (
                    <>
                      <dt>Soulprint</dt>
                      <dd>
                        <code>{print.sha256.slice(0, 8)}</code>
                      </dd>
                    </>
                  ) : null}
                </dl>
                <span className="risen-go">Watch the Soul Match</span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
