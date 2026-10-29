---
name: switch-role
description: Switch Anthony's testing account (rhemamedical7@gmail.com, Dr. Evans) to another role on the TESTING site, so he can see the app as front desk, doctor, nurse, matron, pharmacy, laboratory or admin. Use when he says "make me front desk", "switch me to doctor", "put me back to admin" or similar.
---

# switch-role

Anthony gave standing permission on 2026-10-29: "Do it now, so that as I'm
testing, I should not be going to GitHub all the time."

## What it touches

Only the testing database, and only his one testing account. The workflow
`.github/workflows/testing-role.yml` has the testing project fixed inside
it and refuses the live project. The admin tick stays on, so he can always
switch back.

## Steps

1. Pick the role from his words. Allowed: `front_desk`, `doctor`, `nurse`,
   `matron`, `pharmacy`, `laboratory`, `admin`. If his words could mean two
   roles, ask which one.
2. Run it:
   ```
   gh workflow run testing-role.yml --ref main -f role=<role>
   ```
3. Wait for it to finish:
   ```
   sleep 10
   id=$(gh run list --workflow testing-role.yml --limit 1 --json databaseId -q '.[0].databaseId')
   until [ "$(gh run view $id --json status -q .status)" = completed ]; do sleep 5; done
   gh run view $id --json conclusion -q .conclusion
   ```
4. Tell him in one line: "You are now <role> on the testing site. Refresh
   the page." If it did not say `success`, say so and show the failed step.

## If it goes wrong

- `gh` not available: use the GitHub tools (`actions_run_trigger` on
  `testing-role.yml`, inputs `{"role": "<role>"}`, ref `main`).
- "The testing account was not found": the account row is missing on the
  testing database. Stop and tell him; do not create one.

Never: change the workflow to accept another project or another email.
