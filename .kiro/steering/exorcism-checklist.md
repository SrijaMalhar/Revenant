---
inclusion: manual
---

# Exorcism checklist

Use this when fixing a known security bug in a revived package.

1. Find the advisory (GHSA and CVE) and read it.
2. Write a timing test that builds the bad input in code. Never save a ready-made attack string.
3. Add one EXORCISED requirement to the spec: the fix runs in linear time, and normal inputs still get the same answer.
4. Keep slow inputs out of cases.ts.
5. Make the smallest fix. For a slow regex, replace it with simple code that reads the input once.
6. Run `npm run redos`. Our version must have 0 slow regexes.
7. Run Soul Match on 100,000 inputs, with seed 42 and one random seed. Both must say same soul.
8. Run `npm run exorcism` and commit the new numbers.