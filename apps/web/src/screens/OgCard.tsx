import { useEffect, useState } from 'react';
import type { OssuaryManifest } from '@revenant/core/types';
import { Logo } from '../components/Logo.tsx';
import { manifest, ossuaryIndex } from '../lib/ossuary.ts';

const year = (iso: string | undefined) => (iso ? new Date(iso).getUTCFullYear() : null);

/**
 * /og: the 1200 x 630 social card, drawn with the site's own fonts and
 * screenshotted into public/og.png. Not linked from anywhere.
 */
export function OgCard() {
  const [list, setList] = useState<OssuaryManifest[]>([]);
  useEffect(() => {
    ossuaryIndex()
      .then((idx) => Promise.all(idx.map((e) => manifest(e.name))))
      .then(setList, () => setList([]));
  }, []);

  return (
    <div className="og" data-ready={list.length ? 'yes' : 'no'}>
      <div className="og-head">
        <Logo size={120} />
        <div>
          <p className="og-name">Revenant</p>
          <p className="og-tagline">Dead npm packages, brought back and tested against the original.</p>
        </div>
      </div>
      <ul className="og-stones">
        {list.map((m) => {
          const first = year(m.released?.first);
          const last = year(m.released?.last);
          return (
            <li key={m.name} className="og-stone">
              <span className="stone-name">{m.name}</span>
              <span className="stone-years">{first && last ? (first === last ? last : `${first} · ${last}`) : ''}</span>
              <span className="chip action-revive">Revived, same soul</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
