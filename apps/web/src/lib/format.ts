const nf = new Intl.NumberFormat('en-US');
export const num = (n: number) => nf.format(n);

/** 199,418,512 -> "199M"; small numbers stay exact. */
export function compact(n: number | null): string {
  if (n === null) return 'unknown';
  if (n < 10_000) return nf.format(n);
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: n < 1e6 ? 0 : 1 }).format(n);
}

export function date(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function monthYear(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });
}

export function years(n: number): string {
  return `${n.toFixed(n < 10 ? 1 : 0)} ${n === 1 ? 'year' : 'years'}`;
}

export const short = (hash: string) => `${hash.slice(0, 4)}…${hash.slice(-2)}`;
