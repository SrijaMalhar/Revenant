import { useEffect, useState } from 'react';

// The 60-second tour: four coach marks across the two screens. Skippable,
// keyboard accessible, and dismissal is remembered in localStorage.
const STEPS = [
  { target: 'example', text: 'Start here: scan a project that has one popular linter installed.' },
  { target: 'revive-stone', text: 'Each tombstone is a dead package, tallest for the longest silence. Open the worst one marked Revive.' },
  { target: 'run', text: 'Run the original and the revived package side by side on 100,000 generated inputs.' },
  { target: 'exorcism', text: "timespan's original has a known ReDoS. This chart shows it, and that the revived one doesn't." },
] as const;

const KEY = 'revenant.tour';
const read = (): number | 'done' | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? null : v === 'done' ? 'done' : Number(v);
  } catch {
    return null;
  }
};
const write = (v: number | 'done') => {
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    /* storage can be unavailable; the tour still works for this visit */
  }
};

export function startTour() {
  write(0);
  window.dispatchEvent(new Event('revenant-tour'));
}

export function advanceTour(from: (typeof STEPS)[number]['target']) {
  const s = read();
  const i = STEPS.findIndex((x) => x.target === from);
  if (typeof s === 'number' && s === i) {
    write(i + 1 >= STEPS.length ? 'done' : i + 1);
    window.dispatchEvent(new Event('revenant-tour'));
  }
}

export function Tour() {
  const [step, setStep] = useState<number | 'done' | null>(read);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const sync = () => setStep(read());
    window.addEventListener('revenant-tour', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('revenant-tour', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  useEffect(() => {
    if (typeof step !== 'number') return;
    let el: Element | null = null;
    const find = () => {
      el?.classList.remove('tour-target');
      el = document.querySelector(`[data-tour="${STEPS[step]!.target}"]`);
      el?.classList.add('tour-target');
      setRect(el ? el.getBoundingClientRect() : null);
    };
    find();
    const id = window.setInterval(find, 400);
    window.addEventListener('scroll', find, { passive: true });
    return () => {
      window.clearInterval(id);
      window.removeEventListener('scroll', find);
      el?.classList.remove('tour-target');
    };
  }, [step]);

  if (typeof step !== 'number' || !rect) return null;
  const end = () => {
    write('done');
    setStep('done');
  };
  const top = Math.min(rect.bottom + 12, window.innerHeight - 160);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - 340));
  return (
    <div className="coach" role="dialog" aria-live="polite" aria-label={`Tour, step ${step + 1} of ${STEPS.length}`} style={{ top, left }}>
      <p>{STEPS[step]!.text}</p>
      <p className="small">
        Step {step + 1} of {STEPS.length}
      </p>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button type="button" className="link" onClick={end}>
          Skip the tour
        </button>
      </div>
    </div>
  );
}
