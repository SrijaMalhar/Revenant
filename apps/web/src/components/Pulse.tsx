import { num } from '../lib/format.ts';

const W = 640;
const H = 120;
const BASE = 74;
const BEATS = 20;

/** One heartbeat shape centred on x: a small bump, the spike, a dip, a slow wave. */
function beat(x: number): string {
  const p = (dx: number, dy: number) => `${(x + dx).toFixed(1)} ${(BASE + dy).toFixed(1)}`;
  return [`L${p(-14, 0)}`, `Q${p(-11, -7)} ${p(-8, 0)}`, `L${p(-4, 0)}`, `L${p(-2, 8)}`, `L${p(1, -56)}`, `L${p(4, 14)}`, `L${p(6, 0)}`, `L${p(10, 0)}`, `Q${p(15, -12)} ${p(20, 0)}`].join(' ');
}

const LINE = (() => {
  let d = `M0 ${BASE}`;
  // Each beat finishes exactly at the end of its twentieth, so it is fully drawn only once those inputs are done.
  for (let i = 0; i < BEATS; i++) d += ' ' + beat(((i + 1) / BEATS) * W - 21);
  return `${d} L${W} ${BASE}`;
})();

/**
 * The Soul Match monitor. A dead package starts as a flatline; every beat is
 * one twentieth of the run, drawn only once those inputs have matched. If
 * the answers split, the line breaks where it happened.
 */
export function Pulse({ done, total, state }: { done: number; total: number; state: 'idle' | 'running' | 'same' | 'diverged' | 'error' }) {
  const frac = total ? Math.min(1, done / total) : 0;
  const head = frac * W;
  const per = Math.round(total / BEATS);
  const broken = state === 'diverged';
  return (
    <figure className={`pulse pulse-${state}`}>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <clipPath id="pulse-clip">
            <rect x="0" y="0" width={head} height={H} />
          </clipPath>
          <filter id="pulse-glow" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {Array.from({ length: BEATS - 1 }, (_, i) => (
          <line key={i} className="pulse-grid" x1={((i + 1) / BEATS) * W} x2={((i + 1) / BEATS) * W} y1="8" y2={H - 8} />
        ))}
        <line className="pulse-flat" x1="0" x2={W} y1={BASE} y2={BASE} />
        <g clipPath="url(#pulse-clip)">
          <path className="pulse-glow" d={LINE} filter="url(#pulse-glow)" />
          <path className="pulse-line" d={LINE} />
        </g>
        {broken ? (
          <polyline className="pulse-break" points={`${head},${BASE} ${head + 6},${BASE - 30} ${head + 11},${BASE + 22} ${head + 17},${BASE - 16} ${head + 22},${BASE + 9} ${head + 28},${BASE}`} />
        ) : null}
        {state === 'running' || broken ? <circle className="pulse-head" cx={broken ? head + 28 : head} cy={BASE} r="4" /> : null}
      </svg>
      <figcaption className="small muted">
        {state === 'idle' ? `A flatline until it runs. Each beat is ${num(per)} inputs with matching answers.` : `Each beat is ${num(per)} inputs with matching answers.`}
      </figcaption>
    </figure>
  );
}
