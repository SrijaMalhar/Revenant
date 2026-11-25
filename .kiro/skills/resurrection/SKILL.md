---
name: resurrection
description: Build the revived package from its spec until Soul Match says same soul. Use after the autopsy spec is approved.
---

# Resurrection

1. Read the spec, `cases.ts` and the package's steering file.
2. Write `ossuary/<pkg>/revived/src/index.ts` in strict TypeScript. Same exports, same names, and a default export with the same shape.
3. No dependencies and no install scripts. If the original used a small helper package, copy the helpers in.
4. After each change, run `npm run soul -- <pkg> --runs 2000`. Read the shrunk input and fix the revived code.
5. When that passes, run the full 100,000: `npm run soul -- <pkg>`.
6. Then run `npm run soulprint` and `npm run rules:check`.

Rules:
- Never edit `original/`.
- Never make a test or generator weaker to pass. If a generator looks wrong, stop and tell me.
- Keep the original license and author credit.