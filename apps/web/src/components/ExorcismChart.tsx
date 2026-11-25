import { useState } from 'react';
import type { OssuaryManifest } from '@revenant/core/types';
import { num } from '../lib/format.ts';
import type { ExorcismTiming } from '../lib/ossuary.ts';
import { once } from '../lib/worker.ts';
import { Prov } from './Provenance.tsx';

const W = 720;
const H = 320;
const PAD = { l: 64, r: 72, t: 16, b: 48 };

/**
 * Runtime against input size for timespan's parseDate, original against
 * revived, from the committed timing JSON. Not a live run: the race button
 * below does that on the judge's own machine.
 */
export function ExorcismChart({ timing, manifest }: { timing: ExorcismTiming; manifest: OssuaryManifest }) {
  const pts = timing.points;
  const maxN = Math.max(...pts.map((p) => p.n));
  const maxMs = Math.max(...pts.map((p) => p.originalMs));
  const yTop = niceCeil(maxMs);
  const x = (n: number) => PAD.l + (n / maxN) * (W - PAD.l - PAD.r);
  const y = (ms: number) => H - PAD.b - (ms / yTop) * (H - PAD.t - PAD.b);
  const line = (key: 'originalMs' | 'revivedMs') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.n).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yTop);
  const last = pts[pts.length - 1]!;
  const redos = manifest.redos;

  return (
    <figure className="exorcism" data-tour="exorcism">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="exorcism-desc">
        <desc id="exorcism-desc">
          Line chart. At {num(last.n)} digits the original took {num(Math.round(last.originalMs))} ms and the revived parser {last.revivedMs.toFixed(2)} ms. The data table below has every point.
        </desc>
        {yTicks.map((t) => (
          <text key={t} className="tick" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">
            {t >= 1000 ? `${t / 1000} s` : `${t} ms`}
          </text>
        ))}
        <line className="baseline" x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} />
        {pts.filter((p, i) => i === 0 || x(p.n) - x(pts[i - 1]!.n) >= 32).map((p) => (
          <text key={p.n} className="tick" x={x(p.n)} y={H - PAD.b + 18} textAnchor="middle">
            {p.n >= 1000 ? `${p.n / 1000}k` : p.n}
          </text>
        ))}
        <text className="tick" x={(W - PAD.r + PAD.l) / 2} y={H - 8} textAnchor="middle">
          digits in the input
        </text>
        <path className="series-original" d={line('originalMs')} />
        <path className="series-revived" d={line('revivedMs')} />
        <text className="label-original" x={x(last.n) + 8} y={y(last.originalMs) + 4}>
          original
        </text>
        <text className="label-revived" x={x(last.n) + 8} y={y(last.revivedMs) + 4}>
          revived
        </text>
      </svg>
      <figcaption className="caption">
        Measured on {timing.runtime}, {timing.cpu}, {timing.measuredAt}; {timing.method}
        <Prov source="build" at={timing.measuredAt} detail="npm run exorcism" />. The input is built in code, and no ready-made attack string is published here.
      </figcaption>
      {redos ? (
        <p className="caption">
          recheck: {redos.originalVulnerable} vulnerable {redos.originalVulnerable === 1 ? 'regex' : 'regexes'} in the original, {redos.revivedVulnerable} in the revived
          <Prov source="ci" at={redos.measuredAt} detail={`${redos.checker}, static analysis of every regex literal`} />.
        </p>
      ) : null}
      <details>
        <summary>The numbers as a table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col" className="num">
                Digits
              </th>
              <th scope="col" className="num">
                Original, ms
              </th>
              <th scope="col" className="num">
                Revived, ms
              </th>
            </tr>
          </thead>
          <tbody>
            {pts.map((p) => (
              <tr key={p.n}>
                <td className="num">{num(p.n)}</td>
                <td className="num">{p.originalMs.toFixed(1)}</td>
                <td className="num">{p.revivedMs.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function niceCeil(v: number): number {
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
  return 10 * step;
}

/** Times both parsers on this machine, capped at 10,000 digits, in a fresh worker with a 5-second limit. */
export function Race() {
  const [state, setState] = useState<'idle' | 'running' | { points: { n: number; originalMs: number; revivedMs: number; same: boolean }[] } | { error: string }>('idle');
  return (
    <div className="race">
      <p className="actions">
        <button
          type="button"
          className="secondary"
          disabled={state === 'running'}
          onClick={async () => {
            setState('running');
            const r = await once({ type: 'race', sizes: [2000, 5000, 10000] }, 5000);
            setState(r.type === 'race-result' ? { points: r.points } : { error: r.type === 'error' ? r.message : 'Unexpected answer from the worker.' });
          }}
        >
          {state === 'running' ? 'Racing…' : 'Race on this machine'}
        </button>
      </p>
      {typeof state === 'object' && 'points' in state ? (
        <table aria-live="polite">
          <caption>Race results on this machine, up to 10,000 digits</caption>
          <thead>
            <tr>
              <th scope="col" className="num">
                Digits
              </th>
              <th scope="col" className="num">
                Original
              </th>
              <th scope="col" className="num">
                Revived
              </th>
              <th scope="col">Same answer</th>
            </tr>
          </thead>
          <tbody>
            {state.points.map((p) => (
              <tr key={p.n}>
                <td className="num">{num(p.n)}</td>
                <td className="num">{p.originalMs.toFixed(1)} ms</td>
                <td className="num">{p.revivedMs.toFixed(2)} ms</td>
                <td>{p.same ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {typeof state === 'object' && 'error' in state ? <p className="error">{state.error}</p> : null}
    </div>
  );
}
