# SESSIONS.md

Log of each work session. Newest at the top. Keep entries short.

---

## Session 1: 2026-10-27, planning

Anthony started the project: client is RHEMA Medical Center, 8 week
build from the Rema demo and the proposal.

- Compared the Rema and Lana demos. Rema is the newer one (12 screens
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
