---
name: exorcism
description: Fix a known security bug in a revived package without changing any other answer. Use when a package has an advisory.
---

# Exorcism

Follow the steps in #exorcism-checklist.

The timespan fix is the example to copy:
- The original matched units with unanchored regexes like `(\d+)second[s]?`, which get slow on long digit runs.
- The fix reads the modifiers in one pass with plain code: digits, then letters, up to 7 times.
- Its day loop stepped one month at a time. The fix skips whole 400-year cycles first (146,097 days), then loops the rest.

Same answers for every normal input, and no hang on bad ones.