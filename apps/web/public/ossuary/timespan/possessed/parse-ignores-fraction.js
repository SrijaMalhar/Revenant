var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// ossuary/timespan/revived/src/possessed-parse-ignores-fraction.ts
var msecPerSecond = 1e3;
var msecPerMinute = 6e4;
var msecPerHour = 36e5;
var msecPerDay = 864e5;
var timeSpanWithDays = /^(\d+):(\d+):(\d+):(\d+)(\.\d+)?/;
var timeSpanNoDays = /^(\d+):(\d+):(\d+)(\.\d+)?/;
function isNumeric(input) {
  return input && !isNaN(parseFloat(input)) && isFinite(input);
}
var TimeSpan = class _TimeSpan {
  constructor(milliseconds, seconds, minutes, hours, days) {
    // `any` on purpose: the original adds raw arguments with +=, so a numeric
    // string passed as milliseconds is concatenated, not added. Callers that
    // relied on that still get the same value.
    __publicField(this, "msecs");
    this.msecs = 0;
    if (isNumeric(days)) this.msecs += days * msecPerDay;
    if (isNumeric(hours)) this.msecs += hours * msecPerHour;
    if (isNumeric(minutes)) this.msecs += minutes * msecPerMinute;
    if (isNumeric(seconds)) this.msecs += seconds * msecPerSecond;
    if (isNumeric(milliseconds)) this.msecs += milliseconds;
  }
  add(timeSpan) {
    if (!(timeSpan instanceof _TimeSpan)) return;
    this.msecs += timeSpan.totalMilliseconds();
  }
  addMilliseconds(milliseconds) {
    if (!isNumeric(milliseconds)) return;
    this.msecs += milliseconds;
  }
  addSeconds(seconds) {
    if (!isNumeric(seconds)) return;
    this.msecs += seconds * msecPerSecond;
  }
  addMinutes(minutes) {
    if (!isNumeric(minutes)) return;
    this.msecs += minutes * msecPerMinute;
  }
  addHours(hours) {
    if (!isNumeric(hours)) return;
    this.msecs += hours * msecPerHour;
  }
  addDays(days) {
    if (!isNumeric(days)) return;
    this.msecs += days * msecPerDay;
  }
  subtract(timeSpan) {
    if (!(timeSpan instanceof _TimeSpan)) return;
    this.msecs -= timeSpan.totalMilliseconds();
  }
  subtractMilliseconds(milliseconds) {
    if (!isNumeric(milliseconds)) return;
    this.msecs -= milliseconds;
  }
  subtractSeconds(seconds) {
    if (!isNumeric(seconds)) return;
    this.msecs -= seconds * msecPerSecond;
  }
  subtractMinutes(minutes) {
    if (!isNumeric(minutes)) return;
    this.msecs -= minutes * msecPerMinute;
  }
  subtractHours(hours) {
    if (!isNumeric(hours)) return;
    this.msecs -= hours * msecPerHour;
  }
  subtractDays(days) {
    if (!isNumeric(days)) return;
    this.msecs -= days * msecPerDay;
  }
  totalMilliseconds(roundDown) {
    let result = this.msecs;
    if (roundDown === true) result = Math.floor(result);
    return result;
  }
  totalSeconds(roundDown) {
    let result = this.msecs / msecPerSecond;
    if (roundDown === true) result = Math.floor(result);
    return result;
  }
  totalMinutes(roundDown) {
    let result = this.msecs / msecPerMinute;
    if (roundDown === true) result = Math.floor(result);
    return result;
  }
  totalHours(roundDown) {
    let result = this.msecs / msecPerHour;
    if (roundDown === true) result = Math.floor(result);
    return result;
  }
  totalDays(roundDown) {
    let result = this.msecs / msecPerDay;
    if (roundDown === true) result = Math.floor(result);
    return result;
  }
  get milliseconds() {
    return this.msecs % 1e3;
  }
  get seconds() {
    return Math.floor(this.msecs / msecPerSecond) % 60;
  }
  get minutes() {
    return Math.floor(this.msecs / msecPerMinute) % 60;
  }
  get hours() {
    return Math.floor(this.msecs / msecPerHour) % 24;
  }
  get days() {
    return Math.floor(this.msecs / msecPerDay);
  }
  equals(timeSpan) {
    if (!(timeSpan instanceof _TimeSpan)) return void 0;
    return this.msecs === timeSpan.totalMilliseconds();
  }
  toString() {
    if (!this.format) return this._format();
    return this.format(this);
  }
  _format() {
    return [this.days, this.hours, this.minutes, this.seconds + "." + this.milliseconds].join(":");
  }
};
function fromMilliseconds(milliseconds) {
  if (!isNumeric(milliseconds)) return void 0;
  return new TimeSpan(milliseconds, 0, 0, 0, 0);
}
function fromSeconds(seconds) {
  if (!isNumeric(seconds)) return void 0;
  return new TimeSpan(0, seconds, 0, 0, 0);
}
function fromMinutes(minutes) {
  if (!isNumeric(minutes)) return void 0;
  return new TimeSpan(0, 0, minutes, 0, 0);
}
function fromHours(hours) {
  if (!isNumeric(hours)) return void 0;
  return new TimeSpan(0, 0, 0, hours, 0);
}
function fromDays(days) {
  if (!isNumeric(days)) return void 0;
  return new TimeSpan(0, 0, 0, 0, days);
}
function parse(str) {
  const fractionMs = (_value) => 0;
  let match = str.match(timeSpanWithDays);
  if (match) return new TimeSpan(fractionMs(match[5]), match[4], match[3], match[2], match[1]);
  match = str.match(timeSpanNoDays);
  if (match) return new TimeSpan(fractionMs(match[4]), match[3], match[2], match[1], 0);
  return null;
}
function test(str) {
  return timeSpanWithDays.test(str) || timeSpanNoDays.test(str);
}
function instanceOf(timeSpan) {
  return timeSpan instanceof TimeSpan;
}
function clone(timeSpan) {
  if (!(timeSpan instanceof TimeSpan)) return void 0;
  return fromMilliseconds(timeSpan.totalMilliseconds());
}
function fromDates(start, end, abs) {
  if (typeof start === "string") start = parseDate(start);
  if (typeof end === "string") end = parseDate(end);
  if (!(start instanceof Date && end instanceof Date)) return null;
  let difference = end.valueOf() - start.valueOf();
  if (abs) difference = Math.abs(difference);
  return new TimeSpan(difference, 0, 0, 0, 0);
}
var UNITS = [
  ["milliseconds", "milli"],
  ["seconds", "second"],
  ["minutes", "minute"],
  ["hours", "hour"],
  ["days", "day"],
  ["months", "month"],
  ["years", "year"]
];
var monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function monthDays(month, year) {
  if ((year % 100 !== 0 && year % 4 === 0 || year % 400 === 0) && month === 1) return 29;
  return monthLengths[month];
}
function carry(delta, c, current, next, max) {
  const round = delta > 0 ? Math.floor : Math.ceil;
  if (delta) {
    c[next] += round(delta / max);
    c[current] += delta % max;
  }
  if (Math.abs(c[current]) >= max) {
    c[next] += round(c[current] / max);
    c[current] = c[current] % max;
  }
}
var CYCLE_DAYS = 146097;
var CYCLE_YEARS = 400;
function addDays(delta, c) {
  let days = monthDays(c.months, c.years);
  const sign = delta >= 0 ? 1 : -1;
  const opsign = delta >= 0 ? -1 : 1;
  const wrap = (months) => {
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
  else if (c.days > monthLengths[c.months]) clean = 1;
  if (clean !== 0) {
    c.months = wrap(c.months + clean);
    c.days = monthLengths[c.months] + c.days;
  }
}
function addMonths(delta, c) {
  const round = delta > 0 ? Math.floor : Math.ceil;
  if (delta) {
    c.years += round(delta / 12);
    c.months += delta % 12;
  }
  if (c.months > 11) {
    c.years += Math.floor((c.months + 1) / 12);
    c.months = (c.months + 1) % 12 - 1;
  }
}
function addYears(delta, c) {
  if (delta) c.years += delta;
}
var isDigit = (code) => code >= 48 && code <= 57;
var isLetter = (code) => code >= 65 && code <= 90 || code >= 97 && code <= 122;
function scanModifiers(str, at) {
  let i = at;
  let sign;
  const ch = str[i];
  if (ch === "+" || ch === "-" || ch === "|") {
    sign = ch;
    i++;
  }
  const mods = [];
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
function parseDate(str) {
  let dateTime = Date.parse(str);
  if (!isNaN(dateTime)) return new Date(dateTime);
  let at;
  if (/^NOW/i.test(str)) {
    dateTime = Date.now();
    at = 3;
  } else if (/^-/.test(str) || /^\+/.test(str)) {
    dateTime = Date.now();
    at = 0;
  } else {
    const iso = str.match(/^([^Z]+)/i);
    dateTime = Date.parse(iso[1]);
    at = -1;
  }
  if (!dateTime) return null;
  const text = typeof str === "string" ? str : str.match(/^[\s\S]*/)[0];
  if (at === -1) {
    const z = text.search(/z/i);
    if (z === -1) return null;
    at = z + 1;
  }
  const { sign: signChar, mods } = scanModifiers(text, at);
  const base = new Date(dateTime);
  const sign = signChar === "+" ? 1 : -1;
  const c = {
    milliseconds: base.getMilliseconds(),
    seconds: base.getSeconds(),
    minutes: base.getMinutes(),
    hours: base.getHours(),
    days: base.getDate(),
    months: base.getMonth(),
    years: base.getFullYear()
  };
  const diff = {};
  for (const { digits, letters } of mods) {
    const lower = letters.toLowerCase();
    for (const [unit, prefix] of UNITS) {
      if (lower.startsWith(prefix)) diff[unit] = sign * parseInt(digits, 10);
    }
  }
  carry(diff.milliseconds, c, "milliseconds", "seconds", 1e3);
  carry(diff.seconds, c, "seconds", "minutes", 60);
  carry(diff.minutes, c, "minutes", "hours", 60);
  carry(diff.hours, c, "hours", "days", 24);
  addDays(diff.days, c);
  addMonths(diff.months, c);
  addYears(diff.years, c);
  return new Date(c.years, c.months, c.days, c.hours, c.minutes, c.seconds, c.milliseconds);
}
var timespanModule = {
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
  clone
};
var possessed_parse_ignores_fraction_default = timespanModule;
export {
  TimeSpan,
  clone,
  possessed_parse_ignores_fraction_default as default,
  fromDates,
  fromDays,
  fromHours,
  fromMilliseconds,
  fromMinutes,
  fromSeconds,
  instanceOf,
  parse,
  parseDate,
  test
};
