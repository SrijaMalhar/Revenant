import { useEffect, useRef, useState } from 'react';
import type { GraveNode, GraveyardReport, ZombieScore } from '@revenant/core/types';
import { date, monthYear } from '../lib/format.ts';
import { band } from '../lib/graveyard.ts';
import { palette } from '../lib/tokens.ts';

/**
 * A card made in the browser after a scan: repo, dead count, the top three
 * with their flatlines, the scan date and the link. Plus a README badge.
 * The badge is a snapshot; its link re-runs the scan, so it can't go stale silently.
 */
export function ShareCard({ report, ranked, permalink, onClose }: { report: GraveyardReport; ranked: { node: GraveNode; score: ZombieScore }[]; permalink: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const label = report.input.kind === 'github' ? `${report.input.owner}/${report.input.repo}` : report.root.name;
  const dead = ranked.length;
  const badge = `[![Revenant: ${dead} dead dependencies](https://img.shields.io/badge/revenant-${dead}%20dead%20dependencies-7fb069)](${permalink})`;

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const W = (c.width = 1200);
    const H = (c.height = 630);
    const p = palette();
    const bandColor = (total: number) => ({ low: p.strong, medium: p.warn, high: p.dead })[band(total)];
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = p.strong;
    ctx.font = '56px "IM Fell English", Georgia, serif';
    ctx.fillText(label, 64, 110);
    ctx.font = '28px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillStyle = p.text;
    ctx.fillText(`${dead} dead ${dead === 1 ? 'dependency' : 'dependencies'} of ${report.nodes.length} scanned, ${date(report.scannedAt)}`, 64, 160);
    ranked.slice(0, 3).forEach(({ node, score }, i) => {
      const y = 250 + i * 110;
      ctx.fillStyle = bandColor(score.total);
      ctx.font = '500 44px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText(String(score.total), 64, y + 18);
      ctx.fillStyle = p.strong;
      ctx.font = '34px "IM Fell English", Georgia, serif';
      ctx.fillText(node.name, 170, y);
      ctx.font = '22px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = p.muted;
      ctx.fillText(`no release since ${monthYear(node.vitals.lastRelease)}`, 170, y + 32);
      // flatline: spikes for release years, then flat to the scan date
      const years = node.vitals.releasesByYear ?? [];
      if (years.length) {
        const x0 = 720;
        const x1 = 1136;
        const start = Date.UTC(years[0]!.year, 0, 1);
        const end = Date.parse(report.scannedAt);
        const X = (t: number) => x0 + ((t - start) / (end - start)) * (x1 - x0);
        const base = y + 6;
        ctx.strokeStyle = p.text;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, base);
        const max = Math.max(...years.map((yy) => yy.count));
        for (const yy of years) {
          const m = X(Date.UTC(yy.year, 6, 1));
          const h = (0.35 + 0.65 * Math.sqrt(yy.count / max)) * 34;
          ctx.lineTo(m - 4, base);
          ctx.lineTo(m - 1, base - h);
          ctx.lineTo(m + 2, base + h * 0.35);
          ctx.lineTo(m + 5, base);
        }
        ctx.lineTo(x1, base);
        ctx.stroke();
      }
    });
    ctx.fillStyle = p.muted;
    ctx.font = '22px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText(permalink, 64, H - 48);
  }, [label, dead, ranked, report, permalink]);

  const downloadPng = () => {
    canvasRef.current!.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `graveyard-${label.replace(/[^a-z0-9.-]+/gi, '_')}.png`;
      a.click();
    });
  };

  return (
    <dialog open className="modal" aria-labelledby="share-title">
      <div className="stack">
        <h2 id="share-title">Share this graveyard</h2>
        <canvas ref={canvasRef} className="share-canvas" aria-label={`Share card: ${label}, ${dead} dead dependencies`} />
        <p className="actions">
          <button type="button" className="primary" onClick={downloadPng}>
            Download PNG
          </button>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(badge);
              setCopied(true);
            }}
          >
            {copied ? 'Badge copied' : 'Copy README badge'}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </p>
        <p className="caption">The badge shows today's count. Its link re-runs the scan, so anyone who clicks it sees the current graveyard.</p>
      </div>
    </dialog>
  );
}
