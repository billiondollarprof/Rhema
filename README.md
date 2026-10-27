# RHEMA Hospital Operations System

The hospital workspace for RHEMA Medical Center. A patient is registered once
at the front desk, and from there the system carries their details to the
doctor, the laboratory and the pharmacy. Staff message each other, call for
attention, and print or email the patient's documents from the same app.

Built by StellaXafe Technologies Limited. Owned by RHEMA Medical Center. See
[LICENSE](LICENSE).

## What it is built with

| Part | Tool |
|---|---|
| Screens | Next.js and React, in TypeScript, built as a static app |
| Server jobs | One Cloudflare Worker |
| Database, sign in, live updates | Supabase (Postgres) |
| Email | Resend |
| Hosting and files | Cloudflare (Workers and R2) |
| Checks and deploys | GitHub Actions |
| Checkers and the uptime watcher | Python, with AWS Lambda |

The reasons for each choice, and the free limits that were checked, are in
[PLAN.md](PLAN.md).

## Folders

| Folder | What is in it |
|---|---|
| `web/` | The screens. Each part of the app is its own folder under `web/app/`. |
| `worker/` | The Cloudflare Worker that serves the screens and answers `/api/`. |
| `checks/` | Python checks that run on every push. |
| `docs/` | Notes, including `PYTHON-NOTES.md`. |
| `.claude/skills/` | Checked open source skills for the agents. |

## Running it on your computer

You need Node.js 22 and Python 3.

```
npm install
npm run dev        # the screens, at http://localhost:3000
npm run verify     # every check, the same ones CI runs
```

To run it exactly as Cloudflare does, with the Worker:

```
npm run build
npx wrangler dev
```

## Branches

- `main` is the live hospital system. Every push to it goes live.
- `testing` is where every change is checked first.
- Work happens on its own branch, goes into `testing` by pull request, and
  reaches `main` only after it has been looked at on the testing address.

## For anyone working on this code

Read [CLAUDE.md](CLAUDE.md) first. It holds the working rules for people and
for AI agents. Then read [CURRENT.md](CURRENT.md), which says where the work
stands now.

No real patient data ever goes into this repository, a test or a log.
