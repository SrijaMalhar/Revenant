import type { Vitals } from '@revenant/core/types';
import { monthYear } from '../lib/format.ts';

/**
 * An ECG line drawn from real publish dates: one spike per year, sized by
 * that year's releases, then a flat line from the last release to the scan
 * date. A literal flatline.
 */
export function Heartbeat({ vitals, scannedAt, width = 160, height = 26, className }: { vitals: Vitals; scannedAt: string; width?: number; height?: number; className?: string }) {
  const years = vitals.releasesByYear ?? [];
  const total = years.reduce((a, y) => a + y.count, 0);
  const label = describe(vitals, total);
  if (!years.length || !vitals.firstRelease) {
    return (
      <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Release history unknown">
        <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="3 4" />
      </svg>
    );
  }
  const start = Date.UTC(years[0]!.year, 0, 1);
  const end = Math.max(Date.parse(scannedAt), Date.parse(vitals.lastRelease));
  const x = (t: number) => ((t - start) / (end - start)) * (width - 4) + 2;
  const base = height * 0.62;
  const max = Math.max(...years.map((y) => y.count));
  let d = `M0 ${base}`;
  for (const y of years) {
    const mid = x(Date.UTC(y.year, 6, 1));
    const h = (0.35 + 0.65 * Math.sqrt(y.count / max)) * (base - 2);
    d += ` L${(mid - 3).toFixed(1)} ${base} L${(mid - 1).toFixed(1)} ${(base - h).toFixed(1)} L${(mid + 1).toFixed(1)} ${(base + h * 0.35).toFixed(1)} L${(mid + 3).toFixed(1)} ${base}`;
  }
  const flatFrom = x(Date.parse(vitals.lastRelease));
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={`${d} L${flatFrom.toFixed(1)} ${base}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1={flatFrom} x2={width} y1={base} y2={base} stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
    </svg>
  );
}

export function describe(v: Vitals, total: number): string {
  const ys = v.releasesByYear ?? [];
  if (!ys.length) return 'Release history unknown';
  const first = ys[0]!.year;
  const last = ys[ys.length - 1]!.year;
  return `${total} ${total === 1 ? 'release' : 'releases'} from ${first} to ${last}, none since ${monthYear(v.lastRelease)}`;
}

/** Weekly downloads over the last year, under the heartbeat: still busy after the flatline. */
export function DownloadsLine({ weeks, width = 420, height = 48 }: { weeks: { week: string; downloads: number }[]; width?: number; height?: number }) {
  if (!weeks.length) return null;
  const max = Math.max(...weeks.map((w) => w.downloads), 1);
  const pts = weeks.map((w, i) => `${((i / Math.max(weeks.length - 1, 1)) * (width - 4) + 2).toFixed(1)},${(height - 2 - (w.downloads / max) * (height - 6)).toFixed(1)}`);
  const total = weeks.reduce((a, w) => a + w.downloads, 0);
  return (
    <svg className="downloads-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${total.toLocaleString('en-US')} downloads over the last ${weeks.length} weeks, peaking at ${max.toLocaleString('en-US')} in a week`}>
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
