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

## Session 2, 2026-10-28 and 29

- Hospital accounts wired: Supabase (live in Paris, testing in Ireland),
  Cloudflare Workers (testing and live workers.dev addresses), GitHub
  secrets. One scoped github-ci key for both Supabase projects.
- Database, each change tested locally, then on a throwaway Supabase in
  CI, then testing, then live: foundation (rooms, staff, patients with
  RMC numbers, activity log), revoke of Supabase's rls_auto_enable, the
  matron role and the admin tick, the PIN, the queue and the chart count.
- Rule written: once testing passes, it goes live (CLAUDE.md), with a
  guard in db-live.yml that refuses anything testing has not taken.
- Sign in built from the demo: email code (link until Resend), first
  PIN, lock screen on the idle design, shared desk switching by name and
  PIN, 10 minute lock, 24 hour expiry, 5 wrong PINs sign out.
- Home screens built from the demo: quick actions, counts, chart, queue
  card per role, phone and desktop menus.
- A real sign in walk-through in CI (two made up nurses, real codes,
  the queue) on every push.
- Tools: First admin, Testing - switch my role, a daily knock to keep
  both databases awake, and the Supabase check (now also sign in
  settings, with accepted warnings written down).
- Live and testing both have the account "Dr. Evans" (admin) for
  rhemamedical7@gmail.com.

- 2026-10-29, later: medical record screens built (/patients/record/?p=ID)
  and the medical record migration went live. Testing and live both show
  0 security warnings. The sign in e2e now walks the record against the
  real database rules: allergy, medicine, suspend and resume with a
  reason, a dose, a refused reading, a void, and a refresh.

- 2026-10-29, later still: Call attention step 1 went live. A phone button
  in the top bar drops a list (groups ring at once; Consultant and Matron
  open their rooms; a small search). The card floats in and rings on the
  called room's screens, live. The double tap guard is 30 seconds, in the
  database, with a lock; this is now a rule in CLAUDE.md. CI caught a
  missing "revoke all" on the new table before live; fixed with his yes,
  and the local tests now give new tables Supabase's default rights so
  this cannot slip past again.

- 2026-10-29, rules and skills: CLAUDE.md rewritten as short rules with one
  page of "may do, must ask, never" (stories moved word for word to
  docs/RULES-HISTORY.md). Finished requests moved to docs/DONE.md (108
  requests: 40 open, 6 standing, 62 done). Four skills built and each run
  once: ship, screens (overflow-audit.cjs finally exists), new-migration
  (template with revoke all, local-db.sh, mutate.sh), switch-role.

- 2026-10-30: Call attention step 2 finished: his Android phone got the
  alert with the app closed and locked; live keys made by him. The
  security check now fails on a new warning (it only printed them
  before); pg_net moved out of public. Install and alerts onboarding live
  (install card, animated guide per device, must-do Allow card, loud ring
  step on Android, /install/ page). CI moved to newer action versions on
  Node.js 24, ubuntu-24.04 by name, and a 20 minute limit on every job.

- 2026-10-30, later: install and alerts cards paused until handover (109,
  the sign in link opens Safari, not the app). Sign in screen now has his
  5 hospital photos sliding behind the card under a blue wash (110). The
  lock page has its own idle screen, so it is unchanged.

- 2026-10-30, Admin (112) live: invitations, staff list with suspend,
  unsuspend and revoke behind the admin's PIN, rooms, activity log with
  signed in times. Option A: Supabase sign ups on, a trigger on
  auth.users refuses emails without a waiting invitation, and the
  security check now has a fifth check for that rule. The real sign in
  test in CI caught two faults before testing (link in an open tab, the
  stranger message on a bare 500). Next: 114, logo and red accents.

- 2026-10-30, logo fit (114 follow up): cleaner logo (pure whites, deep
  blacks, same letters), fills the lock screen ring, a thin divider in the
  top bar; checked at phone sharpness (3x) and the icons as iPhone,
  Android and desktop show them. Live after his "go live".

- 2026-10-30, Laboratory slice 1 live (115): payments table, lab requests
  and results, Front Desk payment in naira with Cash, POS or Transfer,
  Enter results and walk in results, the Lab results section in the
  record, an alert only to the person who asked. The real walk through
  found Request lab hidden in a folded section; it moved to the header.
  Backup choice: second Cloudflare account with a new Gmail (116). He made
  the R2 buckets rhema-files and rhema-files-testing (7 day delete rule).

- 2026-10-30, Laboratory slice 2 live (115 done): attach a photo or PDF
  per test; photos shrunk to 2000 px WebP in the phone; the Worker stores
  only for the Laboratory tick and serves only when the database lets the
  person read the result; testing and live have their own R2 buckets
  (wrangler env "testing"). He is making the backup account's R2 key.

- 2026-10-31: nightly backup live (94, 116 done). First run on live
  passed every step. Recorded 117 (menu button), 118 (storage charging),
  119 (back up lab files: needs a read only key), 120 (CI install stall).

- 2026-10-31: menu button live (117); backup now copies lab files, each
  locked (119), and fails loudly on a bad key; CI tool install has a 3
  minute limit and one retry (120). AWS account: his phone code is late.
