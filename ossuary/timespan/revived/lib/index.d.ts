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
export declare class TimeSpan {
    msecs: any;
    format?: (ts: TimeSpan) => string;
    constructor(milliseconds?: any, seconds?: any, minutes?: any, hours?: any, days?: any);
    add(timeSpan: unknown): void;
    addMilliseconds(milliseconds: any): void;
    addSeconds(seconds: any): void;
    addMinutes(minutes: any): void;
    addHours(hours: any): void;
    addDays(days: any): void;
    subtract(timeSpan: unknown): void;
    subtractMilliseconds(milliseconds: any): void;
    subtractSeconds(seconds: any): void;
    subtractMinutes(minutes: any): void;
    subtractHours(hours: any): void;
    subtractDays(days: any): void;
    totalMilliseconds(roundDown?: unknown): any;
    totalSeconds(roundDown?: unknown): number;
    totalMinutes(roundDown?: unknown): number;
    totalHours(roundDown?: unknown): number;
    totalDays(roundDown?: unknown): number;
    get milliseconds(): number;
    get seconds(): number;
    get minutes(): number;
    get hours(): number;
    get days(): number;
    equals(timeSpan: unknown): boolean | undefined;
    toString(): string;
    _format(): string;
}
export declare function fromMilliseconds(milliseconds: any): TimeSpan | undefined;
export declare function fromSeconds(seconds: any): TimeSpan | undefined;
export declare function fromMinutes(minutes: any): TimeSpan | undefined;
export declare function fromHours(hours: any): TimeSpan | undefined;
export declare function fromDays(days: any): TimeSpan | undefined;
/** "[days]:[hours]:[minutes]:[seconds].[fraction]" or "[hours]:[minutes]:[seconds].[fraction]". */
export declare function parse(str: string): TimeSpan | null;
export declare function test(str: unknown): boolean;
export declare function instanceOf(timeSpan: unknown): boolean;
export declare function clone(timeSpan: unknown): TimeSpan | undefined;
export declare function fromDates(start: unknown, end: unknown, abs?: unknown): TimeSpan | null;
/**
 * Parses an ISO 8601 date, or one with trailing modifiers:
 *   2010-04-03T12:34:15Z+12MINUTES
 *   NOW-4HOURS
 *   +3days
 */
export declare function parseDate(str: string): Date | null;
declare const timespanModule: {
    TimeSpan: typeof TimeSpan;
    fromMilliseconds: typeof fromMilliseconds;
    fromSeconds: typeof fromSeconds;
    fromMinutes: typeof fromMinutes;
    fromHours: typeof fromHours;
    fromDays: typeof fromDays;
    parse: typeof parse;
    parseDate: typeof parseDate;
    fromDates: typeof fromDates;
    test: typeof test;
    instanceOf: typeof instanceOf;
    clone: typeof clone;
};
export default timespanModule;
