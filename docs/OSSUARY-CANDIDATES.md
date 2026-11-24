# Ossuary candidates

Researched Nov 25, 2026 from the npm registry, npm's advisory database, the npm downloads API and e18e `module-replacements` 3.4.0. Weekly downloads are for Nov 17 to 23, 2026. Timings were measured on Node 22; re-measure on your own machine before you put any number in the video.

## The three to revive

| Package | Version | Last release | Weekly downloads | Maintainers | Size | Role |
| --- | --- | --- | --- | --- | --- | --- |
| `type-check` | 0.4.0 | 2020-04-03 | 199,418,512 | 1 | 342 lines, plus `prelude-ls` (1,333 lines, last release 2020-04-02) | Real logic: a type-string parser and checker, inside the linter's tree |
| `path-browserify` | 1.0.1 | 2020-03-03 | 72,582,972 | 1 | 529 lines | Real logic: POSIX path algebra |
| `timespan` | 2.3.0 | 2013-10-08 | 109,567 | 1 | 828 lines (`lib/time-span.js`) | The exorcism |

None of the three appears in e18e's replacement lists, so Revenant should revive them rather than recommend a replacement.

### Notes per package

**type-check.** The API is `typeCheck(type, value)`, `parsedTypeCheck(parsed, value)` and `parseType(type)`. Invalid type strings such as `"["` or `"Number |"` throw, which the both-throw rule covers. The revived version can inline the few `prelude-ls` helpers it uses, so one revival removes two abandoned packages. Generating type strings needs a grammar-based fast-check arbitrary (`fc.letrec`). That is the most work of the three, so budget time for it.

**path-browserify.** Strings are easy to generate from a small alphabet (`a`, `b`, `.`, `..`, `/`). Node's own `path.posix` is a second referee, and `parse` then `format` gives a round-trip property. `resolve()` calls `process.cwd()`, so define it as `"/"` in both builds.

**timespan.** The advisory is [GHSA-f523-2f5j-gfcg](https://github.com/advisories/GHSA-f523-2f5j-gfcg) (CVE-2017-16115, high severity, all versions up to 2.3.0, no patch). Measured with `parseDate('NOW+' + n digits + 'a')`:

| Digits (n) | Time |
| --- | --- |
| 5,000 | 77 ms |
| 10,000 | 296 ms |
| 20,000 | 1,154 ms |
| 40,000 | 4,488 ms |
| 50,000 | 8,131 ms |

Doubling the input roughly quadruples the time. The cause is the unanchored unit regexes such as `/(\d+)second[s]?/i`, which rescan a long digit run from every starting position. Inputs starting with `NOW` read `Date.now()`, so freeze the clock in every test.

## Alternates

| Package | Version | Last release | Weekly downloads | Size | Note |
| --- | --- | --- | --- | --- | --- |
| `pluralize` | 8.0.0 | 2019-05-25 | 62,257,838 | 503 lines | Rule engine; test the default rules only, because `addPluralRule` and similar functions change global state |
| `querystring-es3` | 0.2.1 | 2014-10-13 | 12,283,824 | 173 lines | `parse("%")` throws `URIError`, where Node's `querystring` returns `{"%": ""}`. fast-check found this in 4 tries |

## Can 100,000 inputs run live?

Yes. Calling the original twice per input, 100,000 inputs took 230 ms for `path.normalize`, 428 ms for `pluralize`, 723 ms for `querystring.parse` and 821 ms for `timespan.parseDate`. Browsers are usually in the same range, but check on Day 2.

## Video opener: a fresh project with one linter

The latest release of a popular linter (10.15.0) pulls in these packages through its own dependencies and through `optionator` and `ajv` 6:

| Package | Last release | Weekly downloads |
| --- | --- | --- |
| `natural-compare` | 2016-07-22 | 197,550,703 |
| `esutils` | 2019-07-31 | 219,519,738 |
| `fast-json-stable-stringify` | 2019-12-14 | 218,554,432 |
| `prelude-ls` | 2020-04-02 | 199,453,405 |
| `type-check` | 2020-04-03 | 199,418,512 |
| `levn` | 2020-04-04 | 199,431,898 |

`uri-js` (last release 2021-01-10) is also in that tree. It should show "Replace", because e18e lists `URL`, `uri-js-replace` and `fast-uri` for it. That lets the opener show both behaviours: revive one package, recommend a replacement for another.

Use a fresh demo repo you own instead of a famous project's repo. That gives the same tombstones without showing anyone's logo or blaming a real project. The package name will appear in the terminal; keep it incidental.

An optional detail to verify before using it: `file-entry-cache` 11.1.6 was published on Aug 4, 2026, the day ChainDrop started, and is no longer on npm. The linter's dependency range skips it (`11.1.5 || >11.1.6 <12`). Don't call it malicious unless you find a source that says so.

## Sources

- npm registry package documents: `https://registry.npmjs.org/<package>`
- npm bulk advisory endpoint: `https://registry.npmjs.org/-/npm/v1/security/advisories/bulk`
- npm downloads API: `https://api.npmjs.org/downloads/point/last-week/<packages>`
- [GHSA-f523-2f5j-gfcg](https://github.com/advisories/GHSA-f523-2f5j-gfcg)
- [e18e module-replacements](https://github.com/e18e/module-replacements)
