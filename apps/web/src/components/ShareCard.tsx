import { useEffect, useRef, useState } from 'react';
import type { GraveNode, GraveyardReport, ZombieScore } from '@revenant/core/types';
import { date, monthYear } from '../lib/format.ts';

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
  const badge = `[![Revenant: ${dead} dead dependencies](https://img.shields.io/badge/revenant-${dead}%20dead%20dependencies-3b403c)](${permalink})`;

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const W = (c.width = 1200);
    const H = (c.height = 630);
    ctx.fillStyle = '#0e1210';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e9e4d4';
    ctx.font = '56px "IM Fell English", Georgia, serif';
    ctx.fillText(label, 64, 110);
    ctx.font = '30px "Atkinson Hyperlegible", sans-serif';
    ctx.fillStyle = '#a3a093';
    ctx.fillText(`${dead} dead ${dead === 1 ? 'dependency' : 'dependencies'} of ${report.nodes.length} scanned, ${date(report.scannedAt)}`, 64, 160);
    ranked.slice(0, 3).forEach(({ node, score }, i) => {
      const y = 250 + i * 110;
      ctx.fillStyle = i === 0 ? '#c6f432' : '#e9e4d4';
      ctx.font = '48px "IM Fell English", Georgia, serif';
      ctx.fillText(String(score.total), 64, y + 18);
      ctx.fillStyle = '#e9e4d4';
      ctx.font = '34px "IM Fell English", Georgia, serif';
      ctx.fillText(node.name, 170, y);
      ctx.font = '22px "Atkinson Hyperlegible", sans-serif';
      ctx.fillStyle = '#a3a093';
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
        ctx.strokeStyle = i === 0 ? '#c6f432' : '#e9e4d4';
        ctx.lineWidth = 2;
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
    ctx.fillStyle = '#a3a093';
    ctx.font = '22px "Atkinson Hyperlegible", sans-serif';
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
    <dialog open aria-labelledby="share-title" style={{ position: 'fixed', inset: 0, margin: 'auto', zIndex: 30 }}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <h2 id="share-title">Share this graveyard</h2>
        <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', border: '1px solid var(--stone-edge)' }} aria-label={`Share card: ${label}, ${dead} dead dependencies`} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={downloadPng}>
            Download PNG
          </button>
          <button
            type="button"
            className="quiet"
            onClick={async () => {
              await navigator.clipboard.writeText(badge);
              setCopied(true);
            }}
          >
            {copied ? 'Badge copied' : 'Copy README badge'}
          </button>
          <button type="button" className="quiet" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="small muted">The badge shows today's count. Its link re-runs the scan, so anyone who clicks it sees the current graveyard.</p>
      </div>
    </dialog>
  );
}
