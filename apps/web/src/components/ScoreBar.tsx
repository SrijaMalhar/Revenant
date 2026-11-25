import type { ZombieScore } from '@revenant/core/types';

/** The Zombie Index as one bar of 100: each part fills its own share (40, 40, 20). */
export function ScoreBar({ score }: { score: ZombieScore }) {
  const parts = [
    { id: 'abandonment', label: 'Abandonment', value: score.parts.abandonment, max: 40 },
    { id: 'surface', label: 'Attack surface', value: score.parts.attackSurface, max: 40 },
    { id: 'reach', label: 'Reach', value: score.parts.reach, max: 20 },
  ];
  return (
    <div className="scorebar">
      <div className="scorebar-track" aria-hidden="true">
        {parts.map((p) => (
          <span key={p.id} className="scorebar-part" style={{ flexGrow: p.max }}>
            <span className={`scorebar-fill ${p.id}`} style={{ width: `${(p.value / p.max) * 100}%` }} />
          </span>
        ))}
      </div>
      <ul className="scorebar-legend">
        {parts.map((p) => (
          <li key={p.id} style={{ flexGrow: p.max }}>
            <span className="scorebar-name">{p.label}</span> {p.value.toFixed(1)} of {p.max}
          </li>
        ))}
      </ul>
    </div>
  );
}
