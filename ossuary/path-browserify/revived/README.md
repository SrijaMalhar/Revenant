# path-browserify (revived)

A zero-dependency TypeScript reimplementation of [path-browserify](https://github.com/browserify/path-browserify) 1.0.1 by James Halliday, which ports the POSIX half of Node's `path` module (Node 8.11.1).

Same API as the original: `resolve`, `normalize`, `isAbsolute`, `join`, `relative`, `dirname`, `basename`, `extname`, `format`, `parse`, `_makeLong`, `sep`, `delimiter`, `win32` and `posix`. `resolve()` uses `process.cwd()` when `process` exists and `"/"` otherwise.

It is checked against the unmodified original with differential testing: Revenant runs both on generated paths and compares every result. That is strong evidence over the inputs tried, not a proof. See `../manifest.json` for the Soulprint and measured coverage.

The original is MIT licensed; its notice, and the Node.js notice its code carries, are kept in `LICENSE`.
