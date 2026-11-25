---
inclusion: fileMatch
fileMatchPattern: "ossuary/path-browserify/**"
---

# path-browserify

path-browserify 1.0.1 is a copy of Node 8's path module. Match Node 8, not today's Node. Example: `format([])` returns a string here, but new Node throws.

Rules:

- `process.cwd()` returns "/" in both versions.
- A path that isn't a string throws a TypeError.
- `_makeLong` must be exported. It just returns what it gets.
- `win32` is null. `posix` is the module itself.
- Keep the same function names. One test compares them.