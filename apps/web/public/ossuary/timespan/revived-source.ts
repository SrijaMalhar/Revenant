/**
 * timespan, revived.
 *
 * A zero-dependency TypeScript reimplementation of timespan 2.3.0 by
 * Michael Stum and Charlie Robbins. It aims to behave exactly like the
 * original on every input, quirks included, with one declared exception:
 *
 * EXORCISED: parseDate runs in linear time. The original matched each unit
 * with an unanchored regex such as /(\d+)second[s]?/i, which takes quadratic
 * time on a long run of digits (CVE-2017-16115, never patched upstream).
 * Here the trailing modifiers are read by a hand-written scanner, and the
 * month-by-month day loop skips whole 400-year cycles with arithmetic. For
 * every input the original parses to a valid Date, this returns an equal Date.
 */

const msecPerSecond = 1000;
const msecPerMinute = 60000;
const msecPerHour = 3600000;
const msecPerDay = 86400000;

// Both anchored at the start, so each is tried at one position only.
const timeSpanWithDays = /^(\d+):(\d+):(\d+):(\d+)(\.\d+)?/;
const timeSpanNoDays = /^(\d+):(\d+):(\d+)(\.\d+)?/;

/**
 * The original's numeric test. It returns the input itself when the input is
 * falsy (0, '', null...), so 0 counts as "not numeric" and is skipped.
 */
function isNumeric(input: any): any {
  return input && !isNaN(parseFloat(input)) && isFinite(input);
}

export class TimeSpan {
  // `any` on purpose: the original adds raw arguments with +=, so a numeric
  // string passed as milliseconds is concatenated, not added. Callers that
  // relied on that still get the same value.
  msecs: any;
  declare format?: (ts: TimeSpan) => string;

  constructor(milliseconds?: any, seconds?: any, minutes?: any, hours?: any, days?: any) {
    this.msecs = 0;
    // Same order as the original, so floating-point sums round the same way.
    if (isNumeric(days)) this.msecs += days * msecPerDay;
    if (isNumeric(hours)) this.msecs += hours * msecPerHour;
    if (isNumeric(minutes)) this.msecs += minutes * msecPerMinute;
    if (isNumeric(seconds)) this.msecs += seconds * msecPerSecond;
    if (isNumeric(milliseconds)) this.msecs += milliseconds;
  }

  add(timeSpan: unknown): void {
    if (!(timeSpan instanceof TimeSpan)) return;
    this.msecs += timeSpan.totalMilliseconds();
  }
  addMilliseconds(milliseconds: any): void {
    if (!isNumeric(milliseconds)) return;
    this.msecs += milliseconds;
  }
  addSeconds(seconds: any): void {
    if (!isNumeric(seconds)) return;
    this.msecs += seconds * msecPerSecond;
  }
  addMinutes(minutes: any): void {
    if (!isNumeric(minutes)) return;
    this.msecs += minutes * msecPerMinute;
  }
  addHours(hours: any): void {
    if (!isNumeric(hours)) return;
    this.msecs += hours * msecPerHour;
  }
  addDays(days: any): void {
    if (!isNumeric(days)) return;
    this.msecs += days * msecPerDay;
  }

  subtract(timeSpan: unknown): void {
    if (!(timeSpan instanceof TimeSpan)) return;
    this.msecs -= timeSpan.totalMilliseconds();
  }
  subtractMilliseconds(milliseconds: any): void {
    if (!isNumeric(milliseconds)) return;
    this.msecs -= milliseconds;
  }
  subtractSeconds(seconds: any): void {
    if (!isNumeric(seconds)) return;
    this.msecs -= seconds * msecPerSecond;
  }
  subtractMinutes(minutes: any): void {
    if (!isNumeric(minutes)) return;
    this.msecs -= minutes * msecPerMinute;
  }
  subtractHours(hours: any): void {
    if (!isNumeric(hours)) return;
    this.msecs -= hours * msecPerHour;
  }
  subtractDays(days: any): void {
    if (!isNumeric(days)) return;
    this.msecs -= days * msecPerDay;
  }

  totalMilliseconds(roundDown?: unknown): any {
    let result = this.msecs;
    if (roundDown === true) result = Math.floor(result);
    return result;
  }
  totalSeconds(roundDown?: unknown): number {
    let result = this.msecs / msecPerSecond;
    if (roundDown === true) result = Math.floor(result);
    return result;
  }
  totalMinutes(roundDown?: unknown): number {
    let result = this.msecs / msecPerMinute;
    if (roundDown === true) result = Math.floor(result);
    return result;
  }
  totalHours(roundDown?: unknown): number {
    let result = this.msecs / msecPerHour;
    if (roundDown === true) result = Math.floor(result);
    return result;
  }
  totalDays(roundDown?: unknown): number {
    let result = this.msecs / msecPerDay;
    if (roundDown === true) result = Math.floor(result);
    return result;
  }

  get milliseconds(): number {
    return this.msecs % 1000;
  }
  get seconds(): number {
    return Math.floor(this.msecs / msecPerSecond) % 60;
  }
  get minutes(): number {
    return Math.floor(this.msecs / msecPerMinute) % 60;
  }
  get hours(): number {
    return Math.floor(this.msecs / msecPerHour) % 24;
  }
  get days(): number {
    return Math.floor(this.msecs / msecPerDay);
  }

  equals(timeSpan: unknown): boolean | undefined {
    if (!(timeSpan instanceof TimeSpan)) return undefined;
    return this.msecs === timeSpan.totalMilliseconds();
  }

  toString(): string {
    if (!this.format) return this._format();
    return this.format(this);
  }

  _format(): string {
    return [this.days, this.hours, this.minutes, this.seconds + '.' + this.milliseconds].join(':');
  }
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function fromMilliseconds(milliseconds: any): TimeSpan | undefined {
  if (!isNumeric(milliseconds)) return undefined;
  return new TimeSpan(milliseconds, 0, 0, 0, 0);
}
export function fromSeconds(seconds: any): TimeSpan | undefined {
  if (!isNumeric(seconds)) return undefined;
  return new TimeSpan(0, seconds, 0, 0, 0);
}
export function fromMinutes(minutes: any): TimeSpan | undefined {
  if (!isNumeric(minutes)) return undefined;
  return new TimeSpan(0, 0, minutes, 0, 0);
}
export function fromHours(hours: any): TimeSpan | undefined {
  if (!isNumeric(hours)) return undefined;
  return new TimeSpan(0, 0, 0, hours, 0);
}
export function fromDays(days: any): TimeSpan | undefined {
  if (!isNumeric(days)) return undefined;
  return new TimeSpan(0, 0, 0, 0, days);
}

/** "[days]:[hours]:[minutes]:[seconds].[fraction]" or "[hours]:[minutes]:[seconds].[fraction]". */
export function parse(str: string): TimeSpan | null {
  const fractionMs = (value: string | undefined) => (value ? parseFloat('0' + value) * 1000 : 0);
  let match = str.match(timeSpanWithDays);
  if (match) return new TimeSpan(fractionMs(match[5]), match[4], match[3], match[2], match[1]);
  match = str.match(timeSpanNoDays);
  if (match) return new TimeSpan(fractionMs(match[4]), match[3], match[2], match[1], 0);
  return null;
}

export function test(str: unknown): boolean {
  return timeSpanWithDays.test(str as string) || timeSpanNoDays.test(str as string);
}

export function instanceOf(timeSpan: unknown): boolean {
  return timeSpan instanceof TimeSpan;
}

export function clone(timeSpan: unknown): TimeSpan | undefined {
  if (!(timeSpan instanceof TimeSpan)) return undefined;
  return fromMilliseconds(timeSpan.totalMilliseconds());
}

export function fromDates(start: unknown, end: unknown, abs?: unknown): TimeSpan | null {
  if (typeof start === 'string') start = parseDate(start);
  if (typeof end === 'string') end = parseDate(end);
  if (!(start instanceof Date && end instanceof Date)) return null;
  let difference = end.valueOf() - start.valueOf();
  if (abs) difference = Math.abs(difference);
  return new TimeSpan(difference, 0, 0, 0, 0);
}

// ---------------------------------------------------------------------------
// parseDate
// ---------------------------------------------------------------------------

interface Computed {
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  months: number;
  years: number;
}
type Unit = keyof Computed;

/** Units in the order the original applies them, smallest first, with the prefix each modifier must start with. */
const UNITS: readonly (readonly [Unit, string])[] = [
  ['milliseconds', 'milli'],
  ['seconds', 'second'],
  ['minutes', 'minute'],
  ['hours', 'hour'],
  ['days', 'day'],
  ['months', 'month'],
  ['years', 'year'],
];

const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function monthDays(month: number, year: number): number {
  if (((year % 100 !== 0 && year % 4 === 0) || year % 400 === 0) && month === 1) return 29;
  return monthLengths[month] as number;
}

/** Carry-forward for one component, exactly as the original computes it. */
function carry(delta: number | undefined, c: Computed, current: Unit, next: Unit, max: number): void {
  const round = (delta as number) > 0 ? Math.floor : Math.ceil;
  if (delta) {
    c[next] += round(delta / max);
    c[current] += delta % max;
  }
  if (Math.abs(c[current]) >= max) {
    c[next] += round(c[current] / max);
    c[current] = c[current] % max;
  }
}

// Any 4,800 consecutive months span exactly 146,097 days: the Gregorian
// calendar repeats every 400 years.
const CYCLE_DAYS = 146097;
const CYCLE_YEARS = 400;

function addDays(delta: number | undefined, c: Computed): void {
  let days = monthDays(c.months, c.years);
  const sign = (delta as number) >= 0 ? 1 : -1;
  const opsign = (delta as number) >= 0 ? -1 : 1;
  const wrap = (months: number): number => {
    if (months < 0) {
      c.years -= 1;
      return 11;
    }
    if (months > 11) {
      c.years += 1;
      return 0;
    }
    return months;
  };

  if (delta) {
    // The original stepped one month at a time. While at least a full cycle
    // remains, every one of the next 4,800 steps would run, so take them in
    // one go: same month, 400 years on, 146,097 days used.
    const cycles = Math.floor(Math.abs(delta) / CYCLE_DAYS);
    if (cycles > 0) {
      c.years += sign * CYCLE_YEARS * cycles;
      delta += opsign * CYCLE_DAYS * cycles;
    }
    while (Math.abs(delta) >= days) {
      c.months = wrap(c.months + sign);
      delta += opsign * days;
      days = monthDays(c.months, c.years);
    }
    c.days += opsign * delta;
  }

  let clean = 0;
  if (c.days < 0) clean = -1;
  else if (c.days > (monthLengths[c.months] as number)) clean = 1;
  if (clean !== 0) {
    c.months = wrap(c.months + clean);
    c.days = (monthLengths[c.months] as number) + c.days;
  }
}

function addMonths(delta: number | undefined, c: Computed): void {
  const round = (delta as number) > 0 ? Math.floor : Math.ceil;
  if (delta) {
    c.years += round(delta / 12);
    c.months += delta % 12;
  }
  if (c.months > 11) {
    c.years += Math.floor((c.months + 1) / 12);
    c.months = ((c.months + 1) % 12) - 1;
  }
}

function addYears(delta: number | undefined, c: Computed): void {
  if (delta) c.years += delta;
}

const isDigit = (code: number) => code >= 48 && code <= 57;
const isLetter = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);

/**
 * Reads what the original's trailing regex captured, in one left-to-right
 * pass: an optional sign character ("+", "-" or "|"), then up to 7
 * modifiers, each a run of digits followed by a run of letters.
 */
function scanModifiers(str: string, at: number): { sign: string | undefined; mods: { digits: string; letters: string }[] } {
  let i = at;
  let sign: string | undefined;
  const ch = str[i];
  if (ch === '+' || ch === '-' || ch === '|') {
    sign = ch;
    i++;
  }
  const mods: { digits: string; letters: string }[] = [];
  while (mods.length < 7) {
    let j = i;
    while (j < str.length && isDigit(str.charCodeAt(j))) j++;
    let k = j;
    while (k < str.length && isLetter(str.charCodeAt(k))) k++;
    if (j === i || k === j) break;
    mods.push({ digits: str.slice(i, j), letters: str.slice(j, k) });
    i = k;
  }
  return { sign, mods };
}

/**
 * Parses an ISO 8601 date, or one with trailing modifiers:
 *   2010-04-03T12:34:15Z+12MINUTES
 *   NOW-4HOURS
 *   +3days
 */
export function parseDate(str: string): Date | null {
  let dateTime: number = Date.parse(str);
  if (!isNaN(dateTime)) return new Date(dateTime);

  let at: number;
  if (/^NOW/i.test(str)) {
    dateTime = Date.now();
    at = 3;
  } else if (/^-/.test(str) || /^\+/.test(str)) {
    dateTime = Date.now();
    at = 0;
  } else {
    // Throws for an empty string or one starting with "Z", like the original.
    const iso = str.match(/^([^Z]+)/i) as RegExpMatchArray;
    dateTime = Date.parse(iso[1] as string);
    at = -1;
  }
  if (!dateTime) return null;

  // The original matched its trailing regex with str.match, so anything that
  // isn't string-like fails there. Coerce the same way.
  const text: string = typeof str === 'string' ? str : (str as any).match(/^[\s\S]*/)[0];
  if (at === -1) {
    // The trailing part starts after the first "Z" (either case).
    const z = text.search(/z/i);
    if (z === -1) return null;
    at = z + 1;
  }
  const { sign: signChar, mods } = scanModifiers(text, at);

  const base = new Date(dateTime);
  const sign = signChar === '+' ? 1 : -1;
  const c: Computed = {
    milliseconds: base.getMilliseconds(),
    seconds: base.getSeconds(),
    minutes: base.getMinutes(),
    hours: base.getHours(),
    days: base.getDate(),
    months: base.getMonth(),
    years: base.getFullYear(),
  };

  // Each modifier sets the unit its letters start with; a later modifier for
  // the same unit wins.
  const diff: Partial<Record<Unit, number>> = {};
  for (const { digits, letters } of mods) {
    const lower = letters.toLowerCase();
    for (const [unit, prefix] of UNITS) {
      if (lower.startsWith(prefix)) diff[unit] = sign * parseInt(digits, 10);
    }
  }

  carry(diff.milliseconds, c, 'milliseconds', 'seconds', 1000);
  carry(diff.seconds, c, 'seconds', 'minutes', 60);
  carry(diff.minutes, c, 'minutes', 'hours', 60);
  carry(diff.hours, c, 'hours', 'days', 24);
  addDays(diff.days, c);
  addMonths(diff.months, c);
  addYears(diff.years, c);

  return new Date(c.years, c.months, c.days, c.hours, c.minutes, c.seconds, c.milliseconds);
}

const timespanModule = {
  TimeSpan,
  fromMilliseconds,
  fromSeconds,
  fromMinutes,
  fromHours,
  fromDays,
  parse,
  parseDate,
  fromDates,
  test,
  instanceOf,
  clone,
};
export default timespanModule;
