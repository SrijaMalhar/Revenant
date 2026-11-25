---
name: autopsy
description: Read an old npm package and write the spec for reviving it. Use when starting a new package in the Ossuary.
---

# Autopsy

Goal: understand the original well enough to write `.kiro/specs/revive-<pkg>/requirements.md`. No code in this step.

1. Read `ossuary/<pkg>/original/`: the main file, README, tests and package.json.
2. List every export, what it takes and what it returns.
3. Try the odd inputs and write down what happens: 0, -0, NaN, empty strings, wrong types.
4. Check for security advisories (deps.dev or the GitHub advisory database). If there is one, plan an EXORCISED requirement.
5. Write each requirement in EARS style: "WHEN <input>, THE <function> SHALL <result>." One behaviour per line.
6. Always add the same-soul requirement: for every generated input, the revived version gives the same answer, and throws when the original throws.
7. List the inputs cases.ts must cover.

Never touch `original/`.