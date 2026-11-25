import type { GraveNode, ZombieScore } from '@revenant/core/types';
import { yearsSince } from '@revenant/core/zombie';
import { useMemo } from 'react';

const W = 1600;
const H = 210;
const GROUND = 200;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The empty state's skyline: one silhouette per dead package in a recorded
 * scan. Height is years since the last release, capped at 10, the same rule
 * the tombstones use. The order is a hash of the name, so it never shifts.
 */
export function Horizon({ ranked, scannedAt }: { ranked: { node: GraveNode; score: ZombieScore }[]; scannedAt: string }) {
  const stones = useMemo(() => {
    const order = [...ranked].sort((a, b) => hash(a.node.name) - hash(b.node.name));
    const n = Math.max(order.length, 1);
    const pad = 24;
    const slot = (W - pad * 2) / n;
    const w = Math.min(slot * 0.72, 60);
    return order.map(({ node }, i) => {
      const yrs = Math.min(10, yearsSince(node.vitals.lastRelease, scannedAt));
      const h = 44 + yrs * 14.5;
      const x = pad + i * slot + (slot - w) / 2;
      const r = w / 2;
      const top = GROUND - h;
      const d = `M${x.toFixed(1)} ${GROUND} V${(top + r).toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(x + w).toFixed(1)} ${(top + r).toFixed(1)} V${GROUND} Z`;
      return { key: `${node.name}@${node.version}`, d, name: node.name, yrs, i };
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
      {stones.map((s) => (
        <path key={s.key} className="hz-stone" d={s.d} style={{ ['--i' as string]: Math.min(s.i, 4) }}>
          <title>{`${s.name}: ${Math.floor(s.yrs)} ${Math.floor(s.yrs) === 1 ? 'year' : 'years'} since its last release`}</title>
        </path>
      ))}
      <line className="hz-ground" x1="0" x2={W} y1={GROUND} y2={GROUND} />
    </svg>
  );
}
