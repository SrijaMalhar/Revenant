# Start here: Revenant, Day 1

Everything in this kit goes into the root of your new repo, keeping the folders as they are. The app code itself is built in Kiro: the rules say insufficient use of Kiro can disqualify an entry, and the judges read the `.kiro` folder.

## Tonight (10 minutes, phone is fine)

- [ ] Register for Kiroween 2026 on Devpost. Have your Kiro sign-in ready; the form may ask for a Kiro user ID or an AWS account ID.
- [ ] Request the 4,000 free Kiro credits on the event's **Resources** tab. Closes Dec 1, 12:00 PM PT (Dec 2, 1:30 AM IST).

## Day 1 · Wed Nov 25 (laptop)

1. **Create the repo** on GitHub as `SrijaMalhar/revenant`: public, with the **MIT license** chosen in GitHub's license picker so it shows in the About section. Add the one-sentence description from `docs/BRIEF.md`.
2. **Clone it and set your commit email:**
   ```
   git clone https://github.com/SrijaMalhar/revenant.git
   cd revenant
   git config user.email "srijamalhar@gmail.com"
   ```
3. **Copy this kit in.** GitHub already created a LICENSE; keep either one, they're the same. Check that `.kiro/` is present and not in `.gitignore`.
4. **First commit, before any code:**
   ```
   git add -A
   git commit -m "Add brief, steering rules and Kiro log"
   git push
   ```
5. **Open the folder in Kiro IDE.** Run Prompt 1 from `KIRO-PROMPTS.md` to generate `product.md`, `tech.md` and `structure.md`. Read them; fix anything that contradicts the brief. Keep `rites.md` and `scope.md` exactly as they are.
6. **Start Spec 1** with Prompt 2. Review requirements, then design, then tasks. Approve each only when it's right. Run the tasks once they're approved.
7. **Log it.** Add rows to `KIRO_LOG.md` as you go, including anything that went wrong. Commit and push.

## Day 1 is done when

- [ ] The repo is public, and GitHub shows the MIT license in About
- [ ] `.kiro/steering/` holds 5 files
- [ ] `.kiro/specs/` holds the graveyard scanner's requirements, design and tasks
- [ ] Its tasks run, and its property tests pass against recorded fixtures
- [ ] `KIRO_LOG.md` has real entries

## Day 2 preview

Spike (Prompt 3), Zombie Index (Prompt 4), Graveyard screen (Prompt 5). The spike comes first: if a package won't bundle, you find out on Day 2, not Day 4.

## Files in this kit

| File | What it's for |
| --- | --- |
| `docs/BRIEF.md` | The single source of truth Kiro reads for steering and specs |
| `.kiro/steering/rites.md` | Non-negotiable rules for revived code and honest wording |
| `.kiro/steering/scope.md` | The Day 6 lock and cut order, so Kiro pushes back on scope creep |
| `KIRO-PROMPTS.md` | The exact prompts for Days 1 and 2 |
| `KIRO_LOG.md` | Your evidence log, which becomes the write-up |
| `docs/OSSUARY-CANDIDATES.md` | The 3 packages to revive, with data and sources |
| `LICENSE`, `.gitignore` | MIT license; ignore rules that never touch `.kiro/` |
