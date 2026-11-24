import type { GraveNode, ZombieScore } from '@revenant/core/types';
import { compact, date } from '../lib/format.ts';
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

export function Tombstone({
  node,
  score,
  deco,
  scannedAt,
  onOpen,
  epitaph,
}: {
  node: GraveNode;
  score: ZombieScore;
  deco: Decoration;
  scannedAt: string;
  onOpen: () => void;
  epitaph?: string | null;
}) {
  const v = node.vitals;
  const label = `${node.name} ${node.version}, Zombie Index ${score.total}, ${actionLabel(node, score)}. Last release ${date(v.lastRelease)}. Open details.`;
  return (
    <button
      type="button"
      className={`stone${deco.glow ? ' glow' : ''}${deco.fog === 'thick' ? ' fog-thick' : ''}`}
      style={{ ['--h' as string]: deco.heightYears.toFixed(2) }}
      onClick={onOpen}
      aria-label={label}
      data-tour={score.action === 'revive' ? 'revive-stone' : undefined}
    >
      <Marks deco={deco} />
      <span className="name">{node.name}</span>
      <span className="ver">{node.version}</span>
      <span className={`action ${score.action}`}>{actionLabel(node, score)}</span>
      <span className="score">{score.total}</span>
      <Heartbeat className="heartbeat" vitals={v} scannedAt={scannedAt} />
      <span className="facts">
        last release {date(v.lastRelease)}
        <br />
        {compact(v.weeklyDownloads)} a week, {v.maintainers === null ? 'maintainers unknown' : `${v.maintainers} ${v.maintainers === 1 ? 'maintainer' : 'maintainers'}`}
        {node.dev ? ', dev' : ''}
      </span>
      {epitaph ? <span className="facts" style={{ fontStyle: 'italic' }}>{epitaph}</span> : null}
    </button>
  );
}

/** A crack for an open advisory, a chain for install scripts. Decorative; the label says the same in words. */
function Marks({ deco }: { deco: Decoration }) {
  if (!deco.cracked && !deco.chained) return null;
  return (
    <svg className="marks" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true">
      {deco.cracked ? (
        <polyline points="78,62 70,80 80,96 66,118 73,134 62,156" fill="none" stroke="var(--night)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      ) : null}
      {deco.chained ? (
        <g fill="none" stroke="var(--ash)" strokeWidth="1.4" vectorEffect="non-scaling-stroke">
          {Array.from({ length: 9 }, (_, i) => (
            <ellipse key={i} cx={6 + i * 11} cy={i % 2 ? 77 : 75} rx="6" ry={i % 2 ? 2.4 : 3.4} />
          ))}
        </g>
      ) : null}
    </svg>
  );
}
