---
inclusion: auto
name: generators
description: Rules for writing fast-check generators. Use when writing or changing cases.ts.
---

# Writing generators

Good inputs matter more than many inputs. Three planted bugs got past 100,000 inputs until we fixed the generators. These rules come from that.

- Mostly real inputs, plus some junk (about 95 to 5), so error paths get tested too.
- Add NaN, Infinity, -Infinity and -0 on their own. fc.double() almost never makes them.
- For two inputs that go together, like relative(from, to), make half the pairs similar. Example: the same path with one letter in capitals.
- For parsers, add near misses: a valid input with one piece changed.
- If a case has no input (like VERSION), mark it `fixed: true` so it runs only once.
- Keep slow inputs out of cases.ts.

After changing a generator, run `npm run input-stats` and `npm run possessions`. Every planted bug must still be caught. Never make a generator weaker just to pass.