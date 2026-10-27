# PLAN.md

The plan for building the RHEMA Medical Center Hospital Operations System.
Written 2026-10-27, in the first planning session. Nothing here is built
yet. Every free limit below was checked on 2026-10-27, with the source next
to it, because free plans change and a number from memory is a guess.

Read `CLAUDE.md` first for how we work. Read `CURRENT.md` for what is open.

---

## 1. Which demo is the real one

**The Rema demo is the updated one. It is not the same as the Lana demo.**

How we know: the two files were compared line by line.

- The Lana file is 189 lines and has 7 screens: call attention, documents,
  find, invite, lab, register, send to room.
- The Rema file is 420 lines and has 12 screens. It has all 7 of those, and
  adds medical record, payments, edit patient, activity logs and a patient
  picker. It also has the email code sign in, the Week / Month / Year /
  5 years chart, "Show more" on phones, and the Plus Jakarta Sans font.
- The proposal PDF screenshots (dashboard, register with next of kin and
  payment, medical record, send with a note, messages with groups,
  documents) match the Rema file, not the Lana one.
- The one thing Lana has that Rema does not is the "office view" (the app
  drawn on a monitor on a desk). That was a demo effect, so losing it is
  expected.

So the Lana file Anthony has is an older copy. The Rema file is the
reference we build from.

---

## 2. The stack

| Part | Choice | What it does here |
|---|---|---|
| Screens and server | **Next.js** (React and Node.js underneath), TypeScript | Every screen, plus the server code that talks to the database and sends email |
| Database | **Neon** (serverless Postgres, a database that switches itself off when nobody is using it) | Patients, records, queue, messages, logs |
| Sign in | **Better Auth** (open source sign in library) with email codes | No passwords, same rule as StellaXafe |
| Email | **Resend** | Sign in codes and patient documents |
| Hosting and domain | **Cloudflare Workers** (runs the app close to the user) | The live and testing addresses |
| File storage | **Cloudflare R2** | Printed documents, lab result files, backups |
| Live alerts | **Cloudflare Durable Objects** (a tiny always on room that pushes a message to everyone connected) | Call attention, new patient alerts, chat |
| Checks and deploys | **GitHub Actions** | CI and CD |
| Checkers and the AWS piece | **Python** | Validators, backup check, uptime watcher |
| Cloud extra | **AWS Lambda + EventBridge + SNS** | Uptime watcher in Python, always free |

### Why Next.js is fine for "instant click"

StellaXafe feels instant because clicking never reloads the page. Next.js
does the same thing when it is built that way: it loads the next screen
before you click (prefetch), keeps data you already saw on the device, and
shows a change on screen before the save finishes. The Rema demo already
behaves like this, so the build keeps that feel.

---

## 3. What was verified, and the answers

### Can Neon do this project for free? Yes, with two things designed in.

Neon free plan, per project (source: [Neon plans](https://neon.com/docs/introduction/plans), [Neon pricing](https://neon.com/pricing), [Neon free plan FAQ](https://neon.com/faqs/free-plan-limits-and-quotas), [Neon changelog 2026-10-02](https://neon.com/docs/changelog/2026-10-02)):

- 1 GB of storage per project (raised from 0.5 GB on 2026-10-02). Text
  records for a hospital this size fit for years. Files go to R2, not here.
- 100 CU-hours a month. That is about 400 hours of the smallest database
  size. A month has 720 hours.
- It switches off after 5 minutes with nobody using it, and that time costs
  nothing. On the free plan this cannot be turned off.
- 10 branches (free copies of the database for testing).
- Restore window: only 6 hours back.
- Sign in (Neon Auth, built on Better Auth) is included up to 60,000 users.
- When a limit is hit, the database stops until next month or an upgrade.

**Thing 1: the 400 hours.** If the app asks the database "anything new?"
every few seconds all day, the database never switches off, and 400 hours
runs out around day 17. The hospital would then be locked out. So:

- Live alerts and chat go through Durable Objects, not the database.
  Durable Objects are on the Cloudflare free plan with 5 GB per account
  (source: [Cloudflare changelog, 2025-04-07](https://developers.cloudflare.com/changelog/2025-04-07-durable-objects-free-tier/), [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits)).
- The database is only touched when somebody actually does something.
- CI tracks the monthly hours, and an alert goes out at 70%.
- If the hospital runs a night shift and the hours still get close, the
  fallback is Neon's pay as you go plan, which for this size is a few
  dollars a month. That is quoted to the hospital first, as the proposal
  already says.

**Thing 2: the 6 hour restore window.** That is too short for medical
records. So a backup runs every night from GitHub Actions: it copies the
whole database, encrypts it, and stores it in R2. A Python script checks
that the backup really opens. Neon also keeps 1 free manual snapshot.

### Neon with Resend: yes, they work together.

They never talk to each other directly. The Next.js server reads from Neon
and calls Resend to send the email, so any database works with Resend.

Resend free plan (source: [Resend account quotas](https://www.resend.com/docs/knowledge-base/account-quotas-and-limits.md), [Resend new free tier](https://resend.com/blog/new-free-tier)):

- 3,000 emails a month, but **no more than 100 a day**.
- 1 domain.
- Every person in To, CC and BCC counts as one email.
- When the limit is hit, sending stops. Nothing is charged.

About 15 staff signing in plus patient documents fits. A busy day of
emailing documents could reach 100. So the app counts emails sent each day,
warns the admin at 80, and when sign in codes and documents compete, sign
in codes go first.

### Is the Cloudflare free 10 GB per account or per project? Per account.

The 10 GB is R2 storage: 10 GB a month of standard storage, plus 1 million
writes and 10 million reads a month (source: [R2 pricing](https://developers.cloudflare.com/r2/pricing/)).
Cloudflare bills per account, and its pages give these as one monthly
amount with no split per bucket. Durable Objects storage is stated outright
as "per account". So two projects in one account share one 10 GB.

**So yes, the hospital needs its own Cloudflare account.** The proposal
already promises this anyway: "Cloudflare, in the hospital's own account".

### Moving the domain to the new account: possible, and Cloudflare supports it.

Cloudflare can move a domain registered with it from one Cloudflare
account to another (source: [Move a Registrar domain between accounts](https://developers.cloudflare.com/registrar/account-options/inter-account-transfer/), [Move a domain between accounts](https://developers.cloudflare.com/fundamentals/manage-domains/move-domain/)). What to know before doing it:

- Both accounts have to confirm the move.
- The DNS records do not move with it. Copy them down first.
- DNSSEC (a lock on the DNS records) has to be off before the move.
- After the move, the domain cannot be transferred again for 30 days.
- The new account pays the renewals from then on.

Right now there is nothing live on it, so this is the cheapest moment to
move it.

### The one real risk: Next.js on the Cloudflare free plan

Next.js runs on Cloudflare through the OpenNext adapter. The free plan has
two limits that can bite (source: [OpenNext Cloudflare](https://opennext.js.org/cloudflare), [OpenNext troubleshooting](https://opennext.js.org/cloudflare/troubleshooting), [Workers limits](https://developers.cloudflare.com/workers/platform/limits)):

- **The app bundle must be under 3 MB** (compressed). Next.js apps can go
  over this.
- **10 ms of computer time per request.** Waiting for the database does not
  count, only actual work. A simple screen fits. Making a PDF on the server
  may not.

What we do about it:

1. The very first build is measured. CI fails the build if the bundle goes
   over 3 MB, so we find out on day one, not on launch day.
2. PDFs are made in the browser, not on the server. The demo already prints
   from the browser.
3. If it still does not fit, the choices are Anthony's: keep Next.js and
   pay Cloudflare $5 a month, or build Next.js as a static app (no server
   bundle at all) with the server code in a small separate Worker.

**Vercel is not an option here.** Its free plan is for non commercial use
only, and a paid client project is commercial (source: [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines)).

---

## 4. The proposal names Supabase, and we are moving to Neon

The proposal says Supabase in five places: the architecture page, the
technical foundation table, "Included in the price", running costs, and
"Patient data: stored in the hospital's own Supabase project".

The change is fine for the hospital: still their own account, still no
monthly fee to start, still row level rules in the database. But the
document they read says Supabase. **How and when to tell the director is
Anthony's call.** One line in the kick off meeting covers it: "we are using
Neon instead of Supabase for the database; it is the same Postgres, in your
own account, and it has no monthly fee to start."

---

## 5. Public or private repo

**Recommendation: private.** The repo is public right now.

Why:

1. **The code is not ours to publish.** The proposal says "RHEMA Medical
   Center owns the system completely: code, designs, database content and
   all accounts". Once they pay, publishing their system needs their
   written yes.
2. **A licence cannot protect what the client owns.** The licence file will
   say all rights reserved, owned by the hospital. That is a statement, not
   a lock. Private is the lock.
3. **Hospital systems are a target.** Good security does not depend on the
   code being secret, but nobody gains from handing attackers the map.
4. **The proposal and demo are marked confidential**, and the proposal has
   the bank account and the price in it.

How Anthony still gets it in front of employers:

- A separate **public case study repo**: architecture diagram, screenshots
  with made up patients, the CI pipeline, the Python checkers, and a write
  up of the decisions. That is what a reviewer actually reads.
- Ask the director in writing for permission to show the work. Many say
  yes when patient data is clearly not involved.
- The CI badges, the pipeline and the skills can live in the case study.

GitHub Actions on a private repo gets 2,000 free minutes a month. Our CI is
sized to stay well under that.

**The proposal PDF and the demo file go into the repo only after it is
private.** That is why they are not in this commit.

---

## 6. CI and CD

CI (continuous integration: checks that run by themselves on every push).
CD (continuous deployment: the checked code goes live by itself).

On every pull request:

1. Install, then `npm run verify`: format, lint, type check, unit tests,
   Python validators, build.
2. Bundle size check: fail over 3 MB.
3. Create a Neon branch, run the migrations and the database tests on it,
   delete the branch.
4. Playwright (a robot browser) opens the main screens at a phone width and
   a desktop width and takes screenshots, which are attached to the run.
5. A secret scan, so a key never reaches a commit.

On merge to `testing`: deploy to the testing address, then run the smoke
test against it.

On merge to `main`: run the migrations on the real database, deploy, run
the smoke test against the live address. If the smoke test fails, the
previous version is put back automatically.

Every night: the backup, and the backup check.

---

## 7. The AWS piece

The one small, always free thing that is genuinely useful: **an uptime
watcher, written in Python.**

- **AWS Lambda** (a function that runs only when called) runs a Python
  script every 5 minutes.
- **EventBridge Scheduler** is the clock that calls it.
- The script opens the live site and the health check address. If either
  fails twice in a row, **SNS** (AWS's notification service) emails
  Anthony.

Why this one: it watches the hospital system from outside Cloudflare, so if
Cloudflare itself has a bad day, we still find out. It is real DevOps, it is
Python, and it fits the free allowance (1 million Lambda calls a month; we
use about 9,000).

What to know about AWS accounts now (source: [AWS free tier changes](https://dev.to/ushpal/new-aws-free-tier-updates-after-july-15-2025-what-you-need-to-know-3m36), [Rackspace guide](https://spot.rackspace.com/blog/aws-free-tier)):

- New accounts since 15 July 2025 start on a credit plan ($100, up to $200)
  that lasts 6 months. Lambda's 1 million free calls a month is "always
  free" and continues after that on the paid plan.
- AWS needs a card. Set a budget alarm at $1 on day one, so any charge is
  seen at once.
- This AWS account is StellaXafe's, not the hospital's. It only watches
  the site from outside and holds no patient data.

---

## 8. Where Python goes

Every one of these is written line by line for Anthony to learn from (see
the Python rule in `CLAUDE.md`).

1. `checks/copy_check.py`: reads every screen's text and fails if it finds
   an em dash, a technical word in a staff screen, or American spelling.
   Small, and a good first file to learn from.
2. `checks/migration_check.py`: reads each migration and fails if it drops
   or renames something without being marked as approved.
3. `checks/fake_data_check.py`: makes sure test and demo data are made up
   (no real looking phone numbers or emails outside the test domain).
4. `ops/backup_check.py`: opens last night's backup and counts the rows,
   so a backup is proven, not assumed.
5. `aws/uptime_watcher.py`: the Lambda function.

---

## 9. PWA now, desktop app later

1. **PWA first** (a website that installs like an app). On Windows, Chrome
   and Edge show an "Install" button. It gets its own icon and window, and
   it updates by itself. If they change computers, they open the address
   and press Install again. Nothing to download or host.
2. **Desktop app later, if they want one: Tauri.** Tauri installers are
   usually a few MB, against 80 MB or more for Electron (source: [Tauri](https://tauri.app)).
   Since it would only wrap the live site, it adds little over the PWA,
   which is why it waits.
3. **Where the download would live:** GitHub Releases on a small public
   repo that holds only the installer, not the code, or a public R2 link on
   the hospital's own domain. Both are free.

---

## 10. Skills

Free, open skills worth using (each is read before installing, the same
way any third party code is):

- **addyosmani/agent-skills**: spec, plan, build, test, review, ship. It is
  already in Anthony's Drive notes as the build process to follow.
- **anthropics/skills**: Anthropic's own public skills.
- **Neon's agent skills** (published on neon.com, including a Neon Auth
  skill).
- **A Cloudflare and Next.js skill** for OpenNext, if a trustworthy one is
  found. The ones seen so far are from individuals, so read first.
- **Scrollcraft** (nateherkai/scroll-craft): only for a public hospital
  website, if they order one. The app itself does not need scroll effects.

Skills we make ourselves, from how StellaXafe was built, in
`.claude/skills/`:

- `verify`: run every check and report plainly before saying done.
- `sql-change`: the show, explain, dry run, wait routine.
- `ship`: the testing then main routine, with the smoke test.
- `teach-python`: the line by line comment style and the "Reading the
  Python" section.
- `walkthrough`: use the screen as the user, screenshot both widths and
  both themes.

Copies of the open skills we adopt are saved in a StellaXafe skills repo on
GitHub, so they stay available even if the original is deleted.

---

## 11. Google Drive

**Already connected.** This session can read Anthony's Drive
(stellaxafe@gmail.com). Nothing more to do. Read so far, and used in this
plan:

- "00 - Agents start here: standing instructions" (folded into `CLAUDE.md`)
- "03 - Agent Skills (Addy Osmani)" (section 10)
- "02 - Scrollcraft" (section 10)
- "01 - JOBS - Remote AI-Native Work" and the Full Stack Engineer (React and
  Python) application record: employers ask for React, TypeScript, Python,
  Postgres, CI/CD and cloud, and for public proof. That is why this plan
  adds Python, AWS and a public case study.

For a future agent that is not connected: in claude.ai, Settings, then
Connectors, then Google Drive, then Connect.

---

## 12. Timeline against the proposal

The proposal promises 8 weeks.

| Weeks | Phase | What we build |
|---|---|---|
| 0 (now) | Setup | Accounts, repo private, CI skeleton, rules |
| 1 to 2 | Foundations | Next.js app from the demo design, sign in with email codes, roles, database and RLS, testing and live addresses |
| 3 to 5 | Core build | Registration, patient ID, search, queue, medical record, lab, pharmacy, payments, chat, alerts, announcements, documents, activity logs |
| 6 to 7 | Testing and training | Staff try it with made up patients, fixes, quick guides |
| 8 | Go live | Live address, handover pack |
