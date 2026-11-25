import type { GraveNode, ZombieScore } from '@revenant/core/types';
import { yearsSince } from '@revenant/core/zombie';
import { useMemo } from 'react';

const W = 1600;
const H = 224;
const GROUND = 198;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The landing skyline: one silhouette per dead package in a recorded scan.
 * Height is years since the last release, capped at 10, the same rule the
 * tombstones use. The order is a hash of the name, so it never shifts, and
 * the stone with the highest Zombie Index glows.
 */
export function Horizon({ ranked, scannedAt }: { ranked: { node: GraveNode; score: ZombieScore }[]; scannedAt: string }) {
  const stones = useMemo(() => {
    const worst = ranked[0]?.score.total ?? -1;
    const order = [...ranked].sort((a, b) => hash(a.node.name) - hash(b.node.name));
    const n = Math.max(order.length, 1);
    const pad = 24;
    const slot = (W - pad * 2) / n;
    const w = Math.min(slot * 0.74, 64);
    return order.map(({ node, score }, i) => {
      const yrs = Math.min(10, yearsSince(node.vitals.lastRelease, scannedAt));
      const h = 44 + yrs * 14.5;
      const x = pad + i * slot + (slot - w) / 2;
      const rx = w / 2;
      const ry = Math.min(rx * 0.72, h / 2);
      const top = GROUND - h;
      const d = `M${x.toFixed(1)} ${GROUND} V${(top + ry).toFixed(1)} A${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${(x + w).toFixed(1)} ${(top + ry).toFixed(1)} V${GROUND} Z`;
      return { key: `${node.name}@${node.version}`, d, glow: score.total === worst, name: node.name, yrs, delay: i * 45 };
    });
  }, [ranked, scannedAt]);

  const oldest = Math.max(0, ...stones.map((s) => s.yrs));
  return (
    <svg
      className="horizon"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label={`${stones.length} dead packages from a recorded scan, drawn as tombstones. The tallest has gone ${Math.floor(oldest)} years without a release.`}
    >
      <defs>
        <linearGradient id="hz-stone" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#4a4f4a" />
          <stop offset="1" stopColor="#2b2f2c" />
        </linearGradient>
        <linearGradient id="hz-soil" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1b201c" />
          <stop offset="1" stopColor="#0e1210" stopOpacity="0" />
        </linearGradient>
        <filter id="hz-glow" x="-60%" y="-30%" width="220%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <clipPath id="hz-above">
          <rect x="0" y="0" width={W} height={GROUND} />
        </clipPath>
      </defs>
      <g clipPath="url(#hz-above)">
        {stones.map((s) => (
          <g key={s.key} className="hz-stone" style={{ animationDelay: `${s.delay}ms` }}>
            {s.glow ? <path d={s.d} style={{ fill: 'var(--acid)' }} opacity="0.4" filter="url(#hz-glow)" /> : null}
            <path d={s.d} fill="url(#hz-stone)" style={{ stroke: s.glow ? 'var(--acid)' : '#5d635e' }} strokeWidth={s.glow ? 2.5 : 1}>
              <title>{`${s.name}: ${Math.floor(s.yrs)} ${Math.floor(s.yrs) === 1 ? 'year' : 'years'} since its last release`}</title>
            </path>
          </g>
        ))}
      </g>
      <rect x="0" y={GROUND} width={W} height={H - GROUND} fill="url(#hz-soil)" />
      <line x1="0" x2={W} y1={GROUND} y2={GROUND} stroke="#6b716c" strokeWidth="1.5" />
    </svg>
  );
}
