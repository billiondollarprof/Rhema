# SESSIONS.md

Log of each work session. Newest at the top. Keep entries short.

---

- 2026-11-24: request 244, full check of this branch's work (19 to 24
  Nov): database (75 migrations, 371 PASS, undo and redo), verify, audit 0,
  75 screens at every width, click-through, every walk, CI and live health
  all green. Fixed on screen: the stay's lines on a bill could be removed or
  left out while the bill still settled them; paid-on-their-own items left
  out of the preview's paid. Handover: docs/HANDOVER-2026-11-24-front-desk-228.md.
  Moved 235, 236, 237, 239, 241 to DONE. Next in line: 240h (lab results one
  test at a time), then his answers on the three follow-ups.

- 2026-11-23 (night): 240/242 inpatient bill LIVE (admit, deposits, chart
  doses and dose price, Pharmacy dispense from the chart, the stay's bill
  with Preview and balance, the bill receipt). 0 security warnings. Three
  follow-ups to ask him (inpatient expiry, deposit covering a bill, editing
  doses). 243 (Other in blue) saved for later.

- 2026-11-23 (later): bill Other fault fixed and a back arrow on phones
  LIVE; 241 LIVE (anybody with medical access in a consulting room
  prescribes, prices and bills; 0 security warnings). Bill and inpatient
  batch shown, waiting for his yes.

- 2026-11-23: 239 LIVE: a set price is a suggestion; the Front Desk can
  change the doctor's price on drugs, tests and bills (0 security warnings).
  Next: 238, the lab sets a test price.

- 2026-11-22 (evening): 235 part 2 (doctor's prices), 237 (Completed as a
  reason), 236 standard prices and the clearer Other vital sign all LIVE.
  0 security warnings on each database change; click-through none broke.
  235 part 3, Add a bill, LIVE the same evening (0 security warnings;
  everyone sees bills, his choice). Next: 238, the lab sets a test price and
  the doctor approves; two questions open.

- 2026-11-22: request 235 part 1 LIVE: blood glucose first (Fasting or
  Random, mmol/L or mg/dL, shown in both), pain score, BMI worked out (also
  before saving on Take vitals; rounding fixed); sheet has Glucose and Pain
  columns. 0 security warnings. Next: part 2, the doctor's prices.

- 2026-11-21: request 234 LIVE: the style checker updated (typescript-eslint
  8.73.0, minimatch 11.0.9); npm audit 0 problems. Nothing the app uses moved.

- 2026-11-20 and 21: requests 230 to 233 LIVE, each with 0 security
  warnings. 230: full review (all checks; first load 871 KB before, 873 KB
  after); fixes: payment lists load alongside the expiry, families details
  only (no direct insert, date and author locked); a: app files kept a year;
  b: Messages and History load in the background (memory only); c: device
  record copy is own room, last 7 days, at most 50 (Privacy Policy updated);
  d: a new family waits on the device with no network (drafts unchanged, his
  choice). 231: Pharmacy list showed only 60 names (all there); every name
  now, Add another strength or size, read 1,000 rows at a time. 232: the
  Pharmacy and Lab give and test before payment. 233: Front Desk only, or
  Front Desk and Pharmacy or Lab; Drugs to give on the patient's page.
  Slip: a broken test file made mutate.sh call every break caught; CI on
  testing caught it; mutate.sh now refuses to run on failing tests.

- 2026-11-20 (afternoon): 228b LIVE: category drop down first on both
  registration screens; a family registered with its own name, phone and
  address, saved with its first member in one step; no card fee for later
  members; Edit family details; families found by name. 0 security warnings
  on testing and live. All screen checks now pick drop down options
  (mock.cjs pressFirst). 228 and 229 moved to docs/DONE.md. Nothing of
  228/229 left open.

- 2026-11-20 (morning): 229 own notes only, his yes. Slip: a stray "do $$
  begin" in test 059 broke the file; mutate.sh then called every break
  CAUGHT, and my grep hid its "tests fail on the restored file" line. CI on
  testing caught it (database job red); nothing reached live. Fixed the test,
  re-proved 4 breaks with real FAIL lines, and mutate.sh now refuses to run
  when the tests already fail.

- 2026-11-20: 228a LIVE: unpaid drugs and lab tests never given or tested
  expire after 72 hours (his change from 24), grey in the record, owed ones
  stay; 0 security warnings on testing and live. Recorded 229 (consultants
  sharing patients, matron as midwife), advice given. Next: 228b family file.

- 2026-11-19 (afternoon, new session): request 228 recorded and said back;
  his yes to all. 228c LIVE: Take vitals for the Front Desk (readings go into
  the record; Front Desk adds in its own name, reads back only its own,
  cannot void). 0 security warnings on testing and live. Next: 228a payments
  that expire after 24 hours, then 228b family file first.

- 2026-11-19: request 227 finished and LIVE: drafts with Continue or
  Discard, Correct for 15 minutes, antenatal details into the booking (the 8
  copied columns removed), consent signature upload, old file antenatal and
  family, the Pharmacy drug list, and two new checks (contrast in both
  looks; every button and section can be seen). Next: the security review.

- 2026-11-18: request 227 started. LIVE: install guide back button, stuck
  screens open in full, Prescription and Request lab inside the consultation,
  Waiting for payment for the Front Desk, readable in both looks (new
  contrast check). Next: drafts and Correct, then the rest of 227.

- 2026-11-17 (late): request 226b built and LIVE: monthly copy to the
  hospital's own Google Drive. The testing check refused a signed out door
  with the owner's rights, so a second migration made the admin's own page
  hand in the key. Waits on Anthony's Google app and secrets. Next:
  registration in one trip; then remind him of 223.

- 2026-11-17 (evening): request 225 LIVE: automatic sign and time, running
  sheets, tidy form buttons. Next: registration in one trip; then 223.

- 2026-11-17 (afternoon): request 224 LIVE. Records for no network, the
  ward's sheets, the full-page consultation, route and signed by. Fixed:
  no-network sign out, unsent entries wiped at sign out. Next: registration
  in one trip; then 223 (eye comfort research) when he asks.

- 2026-11-17 (morning): request 221 LIVE: the record page reworked so nothing
  scrolls away. Backup token saved as a Secret; first timer run due 07:17 UTC.

- 2026-11-17 (night): requests 219c and 220 LIVE. SQL went live before the
  screens that read it. Searches are starts-with only; note words are drop
  downs; medicines save without a note.

- 2026-11-17 (early): request 219. Backup timer LIVE on the hospital Worker
  (needs his token). Doctor's note save bug fixed and LIVE. All 6 flow
  additions built and tested; SQL waits for his yes, then SQL goes live
  before the screens.

- 2026-11-16 (late night): request 218. LIVE: the doctor's note with the
  director's four boxes, the medication chart, the summary, the plan banner,
  each role's work first, Visits by day (no SQL); Next.js 16.4.5; the backup
  proves nothing is lost. Found: GitHub starts scheduled backups hours late;
  a Worker timer is proposed. The whole-flow plan waits for his yes.

- 2026-11-16 (night): request 217a LIVE: Download our data (Admin, Data
  tab, PIN again, one ZIP of spreadsheets and files, logged). 217b review:
  every migration of the day on both databases; the emailed record now shows
  note titles. 217c: research done, restructure proposal waits for his yes.

- 2026-11-16 (evening): requests 202 to 216 LIVE. Lab menu from the
  Laboratory's own reports; lab prices with admin approval (72 hours); Other
  saved for everybody; payment kinds with pickers; First registered and the old
  file month; vital sign lists; send paid work to the Lab and Pharmacy;
  pharmacy stock; note titles; lab corrections; History (the Front Desk sees
  its own shift from its last email sign in, the admin everybody or one person,
  the Lab and Pharmacy counts, consultants their own work); three card fees.
  The 8 live test patients and their 2 files deleted with his yes. Backups
  every 2 hours. Open: Download our data (plan waits), page by page tidy,
  Google Drive import, pharmacy prices with approval (not asked).

- 2026-11-16 (later): request 196, first half LIVE. Antenatal visit table and
  client details (189) and the registration pick lists. Home has 4 big
  buttons; Announce sits in Messages. Search on pick lists longer than 12.
  Register from old file has a folded More details. About 400 more starter
  medicines with strengths and 42 more doses (migration 20261116060435, test
  039, six breaks caught). Lab menu of 103 tests with search, sections and
  result boxes (code only, no SQL). CI caught two clashes in the sign-in test
  from the new search box and the bigger list; both fixed. Next: 196d page
  review, 196g dark mode, 196f Google Drive import design.

- 2026-11-06: the 6 November day. Domain moved to the hospital's
  Cloudflare (accepted by email), zone Active. Resend on the hospital's
  own account, verified; SMTP and the branded sign-in code templates on
  testing and live (both tested). Supabase redirect list has the new
  addresses (check updated first, 13 tests). Email Routing set up; tests
  forwarded but land in Gmail spam (new domain), filter made, still
  spam, waiting 24 hours. Found and fixed my backup fault (151: the
  housekeeping steps failed 4 nights; backup itself fine). AWS watcher on
  main, waiting for his DeployRoleArn. Late: testing now answers on
  https://testing.rhemamedical.app (deploy checks it each time); merged
  to main. Then, on his word, live on https://rhemamedical.app (152a).
  Next, 7 Nov: admin@rhemamedical.app as the first admin on live.

- 2026-11-04 night: testing back to Rhema; the brand switch stays (one
  line in ops/pitch.json, skill pitch-client). Automations is in the menu
  on every build, live included, by his word. Layout check now covers 26
  screens.

- 2026-11-04 evening: chat and visit SQL live (his yes); the security
  check found 1 warning on testing (message_edits had no written rule),
  fixed with a small follow-up migration before live; 0 warnings live.
  150: the hospital's name and mark now come from lib/brand/brand.ts;
  testing shows LANA Medical Centre (he left MASCAP), letters LA, with
  Automations (coming soon) in the menu. Live stays Rhema (checked in the
  deploy log). New skill: pitch-client.

- 2026-11-04 afternoon: his answers recorded. 141 (card fee) live, 146
  visit history ran on testing. 140, 142, 144 and 147 built and tested
  locally (two migrations, 17 deliberate breaks all caught), waiting for
  his yes on the SQL before they go to testing.

- 2026-11-04 later: 138 (profile saves), 148 (notifications fold open),
  143 (instant messages) and 145 (screens keep their last data) live.
  Slip: once more a push ran after a failed verify, because the command
  used ";" after verify. Testing caught it (formatting only) and live was
  not touched. From now on every ship line is one && chain, verify first.
  Waiting on him: 146 visit history SQL, and the say backs for 140, 141,
  142, 144, 147.

- 2026-11-04: he began his own walk (137), as Front Desk. Testing top up
  ran (pharmacy, messages, a family, records, an announcement), checked on
  the local database first. The top up found a real fault (138): saving a
  Profile (blood group, genotype) fails on testing and live. Fix waits for
  his yes. Find patient on Register made a real button (139), live.

- 2026-11-03: 136 live (robots.txt Disallow and a no-index header on
  every answer; the live smoke test now checks both). Keys stay, order
  for the 6th recorded. Next: the AWS uptime watcher today, once his
  phone code arrives.

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

- 2026-10-31: Pharmacy with drug payments live (123a). Price per drug and
  per lab test, total worked out by the app and the database. Testing and
  live both took the migration with 0 security warnings. Next: other
  payments with printable receipts.

- 2026-10-31: on the client's computer the site showed "Not secure": the
  address was typed without https://. Menu button now icon only, and the
  desktop top bar lines up with the page column (124).

- 2026-10-31: lock screen fixed for desktops (125): a click while loading is kept, and any key opens the PIN card.

- 2026-10-31: idle lock now 1 hour (126). Live CI database job stalled on the tool install before any test; one re-run passed.

- 2026-11-02: request 128 mapped with him (OCR and migration later;
  messages with ticks stay in this build). Step 1 live: files on the
  record, Register from old file, Download. Slip: one push to testing went
  out while my local verify was red (a formatting line), because the
  command joined steps with ";". Testing CI caught it; fixed in minutes,
  live never touched. Join ship steps with "&&" only.

- 2026-11-02: 128 adjustments and 130 live (two SQL batches, his yes):
  file preview and uploader delete, old file mark, raised old file button,
  lab picker fixed (the initials circle stretched on iPad), Send also,
  attachment chooser with zip, history and zip named after the patient,
  exact status tags on Find patient. Recorded 129 (call in alert).

- 2026-11-02: 129 live (Call patient card, chime, name on the phone
  alert; the CI walkthrough caught the Call attention guard counting the
  Call patient card, fixed before testing). 131 built: one shared double
  tap guard for registration and every record entry; waiting for his yes.

- 2026-11-02: 131 live (shared double tap guard). Recorded 132 (unread
  bubble on the menu button, with notifications). Next: family profile.

- 2026-11-02: family profile live (128 step 2). Next: poor network.

- 2026-11-02: poor network live (128 step 3). Slip caught before it
  mattered: a run where verify failed still reached the push line (the
  commit had not happened, so testing only got the old version again).
  The ship command now runs the push only after a successful commit.

- 2026-11-02 evening: 133 (full sentences) and receipts (123 part 2)
  live, on his standing yes for the rest of the day. Review pass, first
  round: every screen as every role (front desk, doctor, nurse, lab,
  pharmacy, admin) at 390 and 1280 wide, with made up data: no browser
  errors, no overflow at 320 and 375. Next: messages with ticks (needs his
  say-back yes), then 132.

- 2026-11-02 night: receipt fit checked at every size and tightened at
  320; the screens skill now runs a thorough layout check (phone, tablet
  portrait and landscape, desktop: spill, cut off, squeezed headings,
  overlapping text, small buttons) and a click-through of every button;
  they found and fixed 6 faults. Messages and announcements live (his
  evening yes, SQL shown in the chat before it ran). Next: notifications
  (132), the review pass, the 6 November handover.

- 2026-11-02 late: clickthrough is its own skill; notifications (132)
  live; review pass round two (Home for every role, 25 screens at 6 sizes,
  clean); one 6 November checklist written, with 12 items that were on no
  list before (the address in the deploy, push, sign in links, install
  pictures; staff reinstalling; keys; the project name; NDPA papers).
