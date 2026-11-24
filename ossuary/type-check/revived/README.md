# type-check (revived)

A zero-dependency TypeScript reimplementation of [type-check](https://github.com/gkz/type-check) 0.4.0 by George Zahariev. The three [prelude-ls](https://github.com/gkz/prelude-ls) helpers it used are inlined, so this package replaces both.

Same API as the original: `typeCheck`, `parsedTypeCheck`, `parseType` and `VERSION`, as named exports, as a default export, and through `require`.

It is checked against the unmodified original with differential testing: Revenant runs both on generated type strings and values and compares every result. That is strong evidence over the inputs tried, not a proof. See `../manifest.json` for the Soulprint and measured coverage.

The original is MIT licensed; its notice is kept in `LICENSE`.
