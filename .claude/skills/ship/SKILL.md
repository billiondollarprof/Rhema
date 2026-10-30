---
name: ship
description: Take finished, checked work from the feature branch to the testing site, wait for every check, then go live by Anthony's rule (CLAUDE.md section 9) and report. Use when a change is ready to go to testing or live, or when he says "push it", "send it to testing" or "go live".
---

# ship

Anthony's standing rule (2026-10-28): once everything on testing is green,
it goes live without asking again. This skill is that rule as steps.

## Before you start

- `npm run verify` is green.
- The change has been used by hand (CLAUDE.md section 5).
- Any SQL that writes in this change has Anthony's yes (CLAUDE.md
  section 2). If not, stop and ask first.

## Steps

1. **Commit and push the feature branch, then testing.**
   ```
   git push -u origin <feature-branch>
   git push origin <feature-branch>:testing
   ```
2. **Wait for every check on that commit.**
   ```
   scripts/wait-runs.sh testing $(git rev-parse HEAD)
   ```
   It prints each run and job, then ALL GREEN or SOMETHING IS RED.
3. **If there was a migration, read the testing security line.** Open the
   log of the `Database (testing)` job (job id printed in step 2) with the
   GitHub tool `get_job_logs` (`return_content: true`, `tail_lines: 40`).
   It must say `Security warnings: 0` and `All five checks passed.`
4. **Red anywhere: stop.** Read the failed job's log, find the cause, fix
   it, and go back to step 1. Never switch a check off or skip a test. If
   the cause is outside this change, tell Anthony.
5. **All green: go live.**
   ```
   git fetch origin main testing
   git checkout -B main-merge origin/main
   git merge --no-ff origin/testing -m "Merge testing into main: <what>"
   git push origin main-merge:main
   git push origin main-merge:testing
   git checkout <feature-branch> && git merge --ff-only main-merge
   git push origin <feature-branch> && git branch -D main-merge
   ```
   The second push is the "merge main back into testing" rule.
6. **Wait for the live checks.**
   ```
   scripts/wait-runs.sh main $(git rev-parse HEAD)
   ```
   For a migration, read the `Database (live)` log the same way as step 3.
7. **Report to Anthony in a few lines:** what went live, CI, the deploy and
   smoke test, and the security warnings on testing and live.
8. Move the request to `docs/DONE.md`, and note it in `SESSIONS.md`.

## If the skill itself goes wrong

It stops at the step that failed. If `scripts/wait-runs.sh` is the fault,
fix the script in the same change and say so. Never skip a step to finish.
