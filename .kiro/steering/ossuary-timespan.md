---
inclusion: fileMatch
fileMatchPattern: "ossuary/timespan/**"
---

# timespan

timespan 2.3.0 is old (last release 2013) and has a known security bug (CVE-2017-16115). Our copy must give the same answers as the original, except for that one fix.

Rules:

- Always run with TZ=UTC. timespan uses local time, so results change from one computer to another without it.
- Freeze Date.now at 1 Jan 2026 (1767225600000) before loading either version.
- The bug: regexes like `(\d+)second[s]?` get very slow on long runs of digits. Our copy reads the input in one pass instead.
- Long digit inputs only go in exorcism.test.ts. In cases.ts, keep numbers at 10,000 or less.
- Add values in the same order as the original (days, hours, minutes, seconds, ms). A different order can change the decimals.

Odd things we keep on purpose:

- `fromMilliseconds(0)` returns undefined.
- `new TimeSpan('5')` gives `"05"`. Strings get joined, not added.
- `NOW+5days`, `NOW-5days` and `NOW5days` all go five days back.
- `NOW+40days` gives 23 Jan, not 10 Feb.

If the original does something strange, we copy it. We don't fix it.