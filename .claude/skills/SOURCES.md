# Skills in this repo: where they came from

Anthony asked on 2026-10-27 for free, open skills to make the work faster,
saved in our own GitHub, and checked before use. Each one below was read
on 2026-10-27 before it was added. Every one is plain written instructions.
None installs hooks (scripts that run by themselves) or calls out to the
internet on its own. Each keeps its original licence file, and none was
changed.

| Skill | Source and commit | Licence | Why it is here |
|---|---|---|---|
| humanizer | blader/humanizer @ 8c307f3 | MIT | Every piece of prose we write goes through it (rule in `CLAUDE.md`). Only SKILL.md, README and LICENSE were kept. |
| spec-driven-development | addyosmani/agent-skills @ aeac41d | MIT | Write the spec before the code. |
| planning-and-task-breakdown | same | MIT | Break the spec into small tasks that can be checked. |
| incremental-implementation | same | MIT | Build one slice at a time, checking each. |
| test-driven-development | same | MIT | Tests before code for the risky parts (access rules, patient ID). |
| security-and-hardening | same | MIT | Patient data. |
| ci-cd-and-automation | same | MIT | The GitHub Actions pipeline. |
| code-review-and-quality | same | MIT | Self review before every push. |
| supabase | supabase/agent-skills @ c9be0e9 | MIT | Supabase's own rules for auth, RLS (row level security), realtime and migrations. |
| supabase-postgres-best-practices | same | MIT | Postgres schema and query rules from Supabase. |
| react-best-practices | vercel-labs/agent-skills @ 6ec2693 | MIT | React and Next.js speed rules. The Vercel-specific deploy advice does not apply here, because we host on Cloudflare. |
| webapp-testing | anthropics/skills @ dbd4588 | Apache 2.0 | Playwright click through tests and screenshots. |
| frontend-design | same | Apache 2.0 | Screen design quality. The Rema demo design always wins over it. |

**Looked at and left out:** addyosmani's hooks (they run shell scripts at
every session start, which we do not want running unseen). Vercel's deploy
and CLI skills (we are not on Vercel). Anthropic's docx, pdf and pptx
skills (not open licence, and not needed).

To add a skill later: read it whole, check its licence, check it runs
nothing on its own, then add a row here.

## Our own skills (written for Rhema, 2026-10-29)

Built because an agent did these jobs by hand more than twice (CLAUDE.md
section 14). No outside source.

| Skill | What it does | Scripts it runs |
| --- | --- | --- |
| `ship` | feature branch to testing, wait for every check, then live, then report | `scripts/wait-runs.sh` |
| `screens` | made up data, screenshots at phone and desktop, overflow check | `scripts/screens/serve.sh`, `scripts/screens/mock.cjs`, `scripts/overflow-audit.cjs` |
| `new-migration` | migration, undo file and tests from a template; local run; deliberate break check | `scripts/new-migration.sh`, `scripts/local-db.sh`, `scripts/mutate.sh` |
| `switch-role` | switches Anthony's testing account to another role | `.github/workflows/testing-role.yml` |
