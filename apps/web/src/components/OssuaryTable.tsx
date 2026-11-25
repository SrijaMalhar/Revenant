import { useEffect, useState } from 'react';
import type { OssuaryManifest, Soulprint } from '@revenant/core/types';
import { date } from '../lib/format.ts';
import { exorcism, manifest, ossuaryIndex, soulprint, type ExorcismTiming } from '../lib/ossuary.ts';
import { linkHandler } from '../lib/router.ts';
import { Prov } from './Provenance.tsx';

interface Row {
  m: OssuaryManifest;
  print: Soulprint | null;
  timing: ExorcismTiming | null;
}

/** The packages Revenant has rebuilt, each with numbers it measured or looked up. */
export function OssuaryTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let live = true;
    ossuaryIndex()
      .then((idx) => Promise.all(idx.map(async (e) => ({ m: await manifest(e.name), print: await soulprint(e.name), timing: await exorcism(e.name) }))))
      .then((list) => live && setRows(list), () => live && setRows([]));
    return () => {
      live = false;
    };
  }, []);

  const checked = rows?.find((r) => r.m.released)?.m.released?.checkedAt;
  const measured = rows?.find((r) => r.m.coverage)?.m.coverage?.measuredAt;
  return (
    <section className="ossuary" id="ossuary" aria-labelledby="ossuary-h">
      <h2 id="ossuary-h">The Ossuary</h2>
      <p className="prose">
        Dead packages Revenant has rebuilt as TypeScript with no dependencies. A rebuild gets in here only after it gives the same answer as the original on 100,000 generated inputs.
      </p>
      {rows === null ? <p className="caption">Opening the Ossuary…</p> : null}
      {rows?.length === 0 ? <p className="notice error">The Ossuary index didn't load. Refresh to try again.</p> : null}
      {rows?.length ? (
        <div className="table-wrap">
          <table className="ossuary-table">
            <thead>
              <tr>
                <th scope="col">Package</th>
                <th scope="col">Last release</th>
                <th scope="col" className="num">
                  Packages installed
                </th>
                <th scope="col" className="num">
                  Branches reached
                </th>
                <th scope="col" className="num">
                  Planted bugs caught
                </th>
                <th scope="col">Soulprint</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, print, timing }) => {
                const planted = m.possessions?.length ?? 0;
                const caught = m.possessions?.filter((p) => p.caught).length ?? 0;
                return (
                  <tr key={m.name}>
                    <th scope="row">
                      <a href={`/ossuary/${m.name}`} onClick={linkHandler(`/ossuary/${m.name}`)}>
                        {m.name}
                      </a>{' '}
                      <span className="meta">{m.version}</span>
                      {timing ? (
                        <>
                          {' '}
                          <a className="chip action-revive" href={`/ossuary/${m.name}/exorcism`} onClick={linkHandler(`/ossuary/${m.name}/exorcism`)}>
                            {timing.advisory.cve} fixed
                          </a>
                        </>
                      ) : null}
                    </th>
                    <td className="mono">{m.released ? date(m.released.last) : 'unknown'}</td>
                    <td className="num">{m.delta ? `${m.delta.subtreePackages[0]} → ${m.delta.subtreePackages[1]}` : 'unknown'}</td>
                    <td className="num">{m.coverage ? `${m.coverage.branches}%` : 'unknown'}</td>
                    <td className="num">{planted ? `${caught} of ${planted}` : 'none planted'}</td>
                    <td className="mono">{print ? `${print.sha256.slice(0, 8)}` : 'unknown'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {rows?.length ? (
        <p className="caption">
          Release dates from the npm registry{checked ? `, checked ${date(checked)}` : ''}
          <Prov source="npm" at={checked ?? ''} detail="npm run released" />. Packages installed counts the package and everything it pulls in; a rebuild is vendored, so it installs nothing. Branches reached and planted bugs caught are measured in CI{measured ? `, last on ${date(measured)}` : ''}.
        </p>
      ) : null}
    </section>
  );
}
