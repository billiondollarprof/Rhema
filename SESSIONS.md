# SESSIONS.md

Log of each work session. Newest at the top. Keep entries short.

---

## Session 2: 2026-10-27, the foundation

- LICENSE written to his rule: the hospital owns this project, StellaXafe
  keeps its general foundation.
- README, `.gitignore`, the Next.js static app and the Worker, one
  `wrangler.jsonc`, `npm run verify`, CI and deploy workflows.
- First Python file, `checks/copy_check.py`, with line by line comments.
  Proved it fails on a planted em dash.
- vitest 3 had 2 critical advisories, moved to vitest 5: 0 vulnerabilities.
- `CLAUDE.md` stack and database sections changed from Neon to Supabase.

## Session 1: 2026-10-27, planning

Anthony started the project: client is RHEMA Medical Center, 8 week
build from the RHEMA demo and the proposal.

- Compared the RHEMA and Lana demos. RHEMA is the newer one (12 screens
  against 7, and it matches the proposal screenshots).
- Checked the free limits for Neon, Resend, Cloudflare R2, Workers,
  Durable Objects, Vercel and AWS, with sources, in `PLAN.md`.
- Found two things the design has to handle: Neon's 400 hours a month
  (so live alerts go through Durable Objects), and Next.js fitting the
  Cloudflare free plan's 3 MB limit (measured in CI from the first build).
- Found the proposal names Supabase in five places.
- Recommended a private repo, because the proposal gives the hospital
  full ownership of the code.
- Wrote `CLAUDE.md` (StellaXafe rules carried over, plus Rhema rules on
  patient data, Neon, CI, self checks and Python teaching), the signposts,
  `PLAN.md`, `CURRENT.md`.
- Google Drive was already connected; read his agent notes and job notes.
