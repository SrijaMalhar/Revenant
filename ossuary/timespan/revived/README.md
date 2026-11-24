# timespan (revived)

A zero-dependency TypeScript reimplementation of [timespan](https://github.com/indexzero/TimeSpan.js) 2.3.0 by Michael Stum and Charlie Robbins.

Same API as the original: the `TimeSpan` class with its add, subtract, total and getter methods, plus `fromMilliseconds`, `fromSeconds`, `fromMinutes`, `fromHours`, `fromDays`, `parse`, `parseDate`, `fromDates`, `test`, `instanceOf` and `clone`. The original's quirks are kept on purpose, so existing callers see the same results.

## One declared difference

`parseDate` in the original takes quadratic time on a long run of digits in its trailing modifiers ([CVE-2017-16115](https://github.com/advisories/GHSA-f523-2f5j-gfcg), never patched). This version reads the modifiers with a linear scanner and replaces the month-by-month day loop with cycle arithmetic. For every input the original parses to a valid Date, it returns an equal Date; it just doesn't hang on malformed ones.

That claim is checked two ways: differential testing on well-formed date strings (strong evidence over the inputs tried, not a proof), and a timing test that shows the original's time quadrupling as the input doubles while this one stays flat.

The original is MIT licensed; its notice is kept in `LICENSE`.
