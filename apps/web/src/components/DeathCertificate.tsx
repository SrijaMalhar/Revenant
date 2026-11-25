import { useRef } from 'react';
import type { GraveNode } from '@revenant/core/types';
import { yearsSince } from '@revenant/core/zombie';
import { causeOfDeath } from '../lib/graveyard.ts';
import { compact, date } from '../lib/format.ts';
import { palette } from '../lib/tokens.ts';

/** A printable certificate for a dead package. Every line comes from the report. */
export function DeathCertificate({ node, scannedAt, onClose }: { node: GraveNode; scannedAt: string; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  // A printed certificate is ink on paper: the light text color becomes the paper.
  const c = palette();
  const ink = { paper: c.strong, ink: c.bg, soft: c.lineStrong, rule: c.muted };
  const v = node.vitals;
  const { cause, factors } = causeOfDeath(node, scannedAt);
  const active = v.firstRelease ? yearsSince(v.firstRelease, v.lastRelease) : null;
  const rows: [string, string][] = [
    ['Name', `${node.name}`],
    ['Born', v.firstRelease ? date(v.firstRelease) : 'unknown'],
    ['Last seen', date(v.lastRelease)],
    ['Years active', active === null ? 'unknown' : active.toFixed(1)],
    ['Weekly downloads now', compact(v.weeklyDownloads)],
  ];

  const svgText = () => new XMLSerializer().serializeToString(svgRef.current!);
  const download = (blob: Blob, ext: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `death-certificate-${node.name.replace(/[^a-z0-9.-]+/gi, '_')}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const asPng = async () => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText());
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => b && download(b, 'png'));
  };

  return (
    <dialog open className="modal" aria-labelledby="cert-title">
      <div className="stack">
        <svg ref={svgRef} className="certificate" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="100%" role="img" aria-labelledby="cert-title">
          <rect width="600" height="800" fill={ink.paper} />
          <rect x="22" y="22" width="556" height="756" fill="none" stroke={ink.soft} strokeWidth="2" />
          <rect x="32" y="32" width="536" height="736" fill="none" stroke={ink.soft} strokeWidth="0.75" />
          <text id="cert-title" x="300" y="112" textAnchor="middle" fontFamily="IM Fell English, Georgia, serif" fontSize="40" fill={ink.ink}>
            Certificate of Death
          </text>
          <text x="300" y="148" textAnchor="middle" fontFamily="IBM Plex Sans, system-ui, sans-serif" fontStyle="italic" fontSize="16" fill={ink.soft}>
            of an npm package
          </text>
          {rows.map(([k, val], i) => (
            <g key={k}>
              <text x="70" y={232 + i * 54} fontFamily="IBM Plex Sans, system-ui, sans-serif" fontSize="15" fill={ink.soft}>
                {k}
              </text>
              <text x="530" y={232 + i * 54} textAnchor="end" fontFamily="IM Fell English, Georgia, serif" fontSize="24" fill={ink.ink}>
                {val}
              </text>
              <line x1="70" x2="530" y1={244 + i * 54} y2={244 + i * 54} stroke={ink.rule} strokeWidth="0.75" />
            </g>
          ))}
          <text x="70" y="540" fontFamily="IBM Plex Sans, system-ui, sans-serif" fontSize="15" fill={ink.soft}>
            Cause of death
          </text>
          <text x="70" y="574" fontFamily="IM Fell English, Georgia, serif" fontSize="28" fill={ink.ink}>
            {cause}
          </text>
          {factors.length ? (
            <text x="70" y="612" fontFamily="IBM Plex Sans, system-ui, sans-serif" fontSize="14" fill={ink.soft}>
              Contributing: {factors.join('; ')}
            </text>
          ) : null}
          <text x="300" y="720" textAnchor="middle" fontFamily="IBM Plex Sans, system-ui, sans-serif" fontSize="12" fill={ink.soft}>
            Issued by Revenant on {date(scannedAt)}. Sources: deps.dev and the npm registry.
          </text>
        </svg>
        <p className="actions">
          <button type="button" className="primary" onClick={() => download(new Blob([svgText()], { type: 'image/svg+xml' }), 'svg')}>
            Download SVG
          </button>
          <button type="button" className="secondary" onClick={asPng}>
            Download PNG
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </p>
      </div>
    </dialog>
  );
}
