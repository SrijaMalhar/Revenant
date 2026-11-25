---
inclusion: fileMatch
fileMatchPattern: "ossuary/type-check/**"
---

# type-check

type-check 0.4.0 uses prelude-ls 1.2.1 for only three small functions: `any`, `all` and `isItNaN`. We copy those three into our version. So one revival removes two old packages.

Rules:

- Use plain objects, not Maps. Names like `constructor` must behave the same as in the original. Example: `parseType('constructor')` gives an empty list.
- Use the same tokenizer as the original.
- Field checks use for...in, like the original.
- If options is a number or a string, it must fail in the same place as the original.
- We only check whether a call throws. We don't compare error messages.