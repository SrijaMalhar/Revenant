import type { GraveNode, ZombieScore } from '@revenant/core/types';
import { date } from '../lib/format.ts';
import type { Decoration } from '../lib/graveyard.ts';
import { Heartbeat } from './Heartbeat.tsx';

export function actionLabel(node: GraveNode, score: ZombieScore): string {
  if (score.action === 'replace') {
    const r = node.replacement!;
    if (r.manifest === 'micro-utilities') return 'Replace with a snippet';
    if (r.manifest === 'native') return `Replace with native ${r.replacements[0]}`;
    return `Replace with ${r.replacements[0]}`;
  }
  return score.action === 'revive' ? 'Revive' : 'Watch';
}

/** "2013 · 2020", or one year when the first and last releases share it. */
export function lifespan(node: GraveNode): string {
  const last = new Date(node.vitals.lastRelease).getUTCFullYear();
  const first = node.vitals.firstRelease ? new Date(node.vitals.firstRelease).getUTCFullYear() : null;
  return first === null || first === last ? String(last) : `${first} · ${last}`;
}

export function Tombstone({
  node,
  score,
  deco,
  scannedAt,
  onOpen,
  epitaph,
  index = 0,
}: {
  node: GraveNode;
  score: ZombieScore;
  deco: Decoration;
  scannedAt: string;
  onOpen: () => void;
  epitaph?: string | null;
  index?: number;
}) {
  const label = `${node.name} ${node.version}, Zombie Index ${score.total}, ${deco.band}. ${actionLabel(node, score)}. Last release ${date(node.vitals.lastRelease)}. Open details.`;
  return (
    <button
      type="button"
      className={`stone band-${deco.band}${deco.fog === 'thick' ? ' fog-thick' : ''}`}
      style={{ ['--h' as string]: deco.heightYears.toFixed(2), ['--i' as string]: Math.min(index, 4) }}
      onClick={onOpen}
      aria-label={label}
      data-tour={score.action === 'revive' ? 'revive-stone' : undefined}
    >
      <Marks deco={deco} />
      <span className="stone-name">{node.name}</span>
      <span className="stone-years">{lifespan(node)}</span>
      <span className="stone-score">
        <span className="stone-index">{score.total}</span>
        <span className="stone-band">{deco.band}</span>
      </span>
      <Heartbeat className="stone-line" vitals={node.vitals} scannedAt={scannedAt} />
      {epitaph ? <span className="stone-epitaph">{epitaph}</span> : null}
      {deco.fog === 'thick' ? <span className="stone-note">Some data missing</span> : null}
      <span className={`chip action-${score.action}`}>{actionLabel(node, score)}</span>
    </button>
  );
}

/** Skeleton stone shown while a scan is still reading the tree. */
export function StoneSkeleton() {
  return (
    <span className="stone stone-skeleton" aria-hidden="true">
      <span className="bar bar-name" />
      <span className="bar bar-years" />
      <span className="bar bar-score" />
      <span className="bar bar-line" />
    </span>
  );
}

/** A crack for an open advisory, a chain for install scripts. The label says the same in words. */
function Marks({ deco }: { deco: Decoration }) {
  if (!deco.cracked && !deco.chained) return null;
  return (
    <svg className="marks" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true">
      {deco.cracked ? <polyline className="mark-crack" points="80,58 72,76 82,92 68,114 75,130 64,152" vectorEffect="non-scaling-stroke" /> : null}
      {deco.chained ? (
        <g className="mark-chain">
          {Array.from({ length: 9 }, (_, i) => (
            <ellipse key={i} cx={6 + i * 11} cy={i % 2 ? 77 : 75} rx="6" ry={i % 2 ? 2.4 : 3.4} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      ) : null}
    </svg>
  );
}
