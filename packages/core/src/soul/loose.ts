/**
 * Reads a value typed into the Ouija board. JSON first; otherwise a few
 * JavaScript literals that JSON can't spell: undefined, NaN, Infinity,
 * -Infinity, -0, and Date(<ISO or "invalid">).
 */
export function parseLooseValue(text: string): unknown {
  const t = text.trim();
  if (t === '' || t === 'undefined') return undefined;
  if (t === 'NaN') return NaN;
  if (t === 'Infinity') return Infinity;
  if (t === '-Infinity') return -Infinity;
  if (t === '-0') return -0;
  const date = /^Date\((.*)\)$/.exec(t);
  if (date) return new Date(date[1] === 'invalid' ? NaN : Date.parse(date[1]!.replace(/^["']|["']$/g, '')));
  return JSON.parse(t);
}
