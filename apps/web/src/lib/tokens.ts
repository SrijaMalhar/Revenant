/**
 * Reads design tokens from tokens.css at runtime. Canvas drawings and
 * downloadable SVGs need literal colors, and this keeps tokens.css the only
 * place they're written down.
 */
export function token(name: `--${string}`): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function palette() {
  return {
    bg: token('--bg'),
    raised: token('--bg-raised'),
    line: token('--line'),
    lineStrong: token('--line-strong'),
    strong: token('--text-strong'),
    text: token('--text'),
    muted: token('--text-muted'),
    alive: token('--alive'),
    warn: token('--warn'),
    dead: token('--dead'),
  };
}
