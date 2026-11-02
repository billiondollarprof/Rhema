# CLAUDE.md

The rules for working on the RHEMA Medical Center Hospital Operations
System, built by StellaXafe Technologies Limited for Anthony.

**These rules are for every agent:** Claude, DeepSeek, Codex, Gemini,
Copilot, and whatever comes after them. `AGENTS.md`, `GEMINI.md` and
`.github/copilot-instructions.md` only point here. Never copy this file.

**The rules are short on purpose.** The stories and Anthony's own words
behind each rule are in `docs/RULES-HISTORY.md`. Read it when a rule looks
strange. If the two files disagree, this one wins.

---

## 1. Start and end of a session

1. Read `CURRENT.md` first. Its top section, "ANTHONY'S OPEN REQUESTS", is
   the job list. Finished work lives in `docs/DONE.md`.
2. Read `SESSIONS.md` next.
3. **Write each request down the moment Anthony makes it**, in his words,
   with the date, in "ANTHONY'S OPEN REQUESTS". A reply in chat is not a
   record. A decision he makes goes in "Decided" so nobody asks again.
4. **A request moves to `docs/DONE.md` when it is live and checked**, not
   when it is planned or pushed.
5. **One chat.** Anthony works in one long chat (his decision,
   2026-10-29: "I want to be doing my work in one chat"). Do not suggest a
   new chat. Keep `CURRENT.md` and `SESSIONS.md` up to date as you go,
   because a long chat is shortened into a summary from time to time, and
   those two files are what survives that in full.
6. At the end, update `CURRENT.md` and `SESSIONS.md`.

## 2. What an agent may do, must ask, and must never do

So the agents can work fast without guessing.

**May do without asking**
- Read any code, run any local test, build, start the local database.
- Push to the feature branch and to `testing`.
- Run read only SQL (SELECT) on the **testing** database.
- Switch Anthony's testing role when he asks (skill `switch-role`).
- Merge `testing` into `main` once everything is green (section 9), then
  merge `main` back into `testing`. Report it in a few lines.
- Re-run a CI job once, only if it died before any test ran.
- Fix a fault in its own unfinished work.
- Update `CURRENT.md`, `SESSIONS.md`, `docs/DONE.md` and other docs.
- Carry out a small, specific request straight away (section 4).

**Must ask first, then wait**
- **Any SQL that writes** (INSERT, UPDATE, DELETE, ALTER, CREATE, GRANT,
  REVOKE). Show the whole batch for the feature or fix at once: each
  statement, and one plain line on what it does. One yes covers the batch.
  It runs on testing first, is checked, then goes live by section 9.
- Anything that deletes, drops or renames, or removes data, whatever the
  checks say. Ask in plain words.
- Any read on the **live** database. Live holds real patients.
- Changing anything Anthony designed or built, even to fix a bug (section 3).
- A new service, a change to the stack, or anything that costs money.
- Adding a warning to `ACCEPTED_WARNINGS`.
- Any change to what patient data is collected, who can see it, or where
  it is stored. The hospital must answer for it under the Nigeria Data
  Protection Act 2023.
- A big feature, or one that could be read two ways (section 4).

**Never**
- Put real patient data in the repo, a test, a log, a screenshot or a chat.
- Put a secret in the code or the chat. Secrets go in GitHub secrets or
  Cloudflare secrets. A secret that reached a commit is rotated.
- Change the live database by hand, or point a testing tool at live.
- Merge to `main` with a red check, or switch a check off, narrow it, or
  skip a test to get green.
- Force push or rewrite history on `main` or `testing`.
- Delete the domain.
- Say "done" before the thing has been used (section 5).

## 3. Anthony is in charge

- **A specific request gets carried out**, at full size. Not argued with,
  not swapped for a better idea. Do it, then say it is done.
- **Opinions only when asked.** "What do you think" and "do what works
  best" are invitations. Anything else is an instruction. If something
  still looks wrong afterwards, say it in one line, after.
- **Never change what he designed without asking first.** A diagnosis is
  not permission. Tell him what you found, what it does today, what you
  would change it to, and what that costs. Then wait. If you already
  changed it, put it back, then ask.
- **Keep the change to what he asked for.** No second improvement carried
  along because you were in the file.
- **The one exception:** a request that would break the live system, lose
  data, or put a false claim in front of people. Say so plainly and wait.

## 4. How a piece of work goes

1. **Small and specific** ("use a phone icon"): do it, check it works,
   then tell him. No repeat-back.
2. **Big, or could be read two ways**: say it back in short plain words and
   wait for his yes. Then read the existing code, write a short plan, build.
3. **One task at a time.** Finish it completely before the next one:
   built, used, checked, pushed, live. Half finished work is not finished.
4. **Read the whole area before changing one line.** Write down every
   fault you find, then fix them together. One fix at a time is a round
   trip for him.
5. **Never break what works.** Read the diff before pushing. For every
   deleted line, ask: was anybody relying on this?
6. **The list is the job.** Something new that turns up goes in
   `CURRENT.md`. Do not start it.

## 5. Nothing is done until it has been used

1. Use it as the person who will use it. Click every button, type the
   wrong thing, cancel and check nothing happened, **refresh the page** and
   check it saved.
2. Look at it: screenshots at a phone width and a desktop width (skill
   `screens`). The app has one look today. If a dark look is ever added,
   check both.
3. Run the layout check at phone (320, 360, 390), tablet portrait, tablet
   landscape and desktop widths, and press every button with the
   click-through check (skills `screens` and `clickthrough`).
4. Judge it as somebody who was never told how it works. If a control
   needs explaining, the control is wrong.
5. Run `npm run verify`. Then say what you actually checked.

A control that writes nothing never reports an error, so it looks exactly
like one that works. That is why step 1 includes the refresh.

## 6. How to talk to Anthony

- **Plain, simple, direct British English.** No em dashes, ever. A hyphen
  only where the word needs one. Numbers as numbers.
- **The answer first**, in one or two lines. Then what he has to do. No
  narration of what was tried. He pays for every word.
- **Every technical term gets its plain meaning in brackets the first time
  it appears in a conversation.** Example: RLS (a database rule that
  decides who can see which rows). This is how he builds his vocabulary.
- **Anything he does himself is a numbered list**: where he is, then each
  step, with the exact thing to type or tap.
- **Say what is already done before what is left.**
- **Short sentences, one idea each**, but keep the small joining words
  (so, then, because, which means). Clipped fragments are harder to follow.
- **Write in his voice.** He asks the question, then answers it. He repeats
  the noun instead of "it". He walks through things in order. He talks to
  "you". Fix his spelling and grammar, keep his tone.
- **Cut the machine tells:** the dramatic fragment, "it is not X, it is Y",
  the wise closing line, the triple, "That" pointing at a whole idea.
- **The Humanizer** (`.claude/skills/humanizer`) runs on every reply,
  commit message, doc and screen text. His voice wins over it. It never
  adds a fact he did not give.
- **Name the model tier on the first line** before any substantial work:
  "Sonnet is enough for this" or "this one is worth Opus". Sonnet: screens
  from an agreed spec, forms, docs, screenshots, clear refactors. Opus:
  architecture, security, RLS, auth, money, hard debugging, copy that must
  land. Only he can switch, with `/model`.

## 7. Screen text

- Short, plain words. Write for the nurse or the front desk in front of it.
- A briefing from Anthony is direction, not text to paste on a screen.
- No disclaimers, no apologies, no internal status on a screen.

## 8. The code

- **One folder per part of the app.** Parts never import from inside each
  other. Shared code lives in `web/lib/`, and only what two parts really use.
- **Every file opens with a header**: what it is, why it exists, what it
  must never do. Keep the header true when the code changes.
- **Numbered, labelled sections** inside each file, one job each.
- **Written for the slowest engineer in the room.** No clever tricks. Read
  it back cold: can you tell in ten seconds what it does?
- **It behaves like a native app.** Each screen is its own folder under
  `web/app/`, but moving between them never reloads the page: prefetching,
  a cache on the device, and changes shown at once while the save happens.
- **No passwords.** Sign in is an email code, then a PIN on the device. An
  invite is a one time link. Only a client whose policy demands passwords
  gets them.

## 9. Branches, CI and going live

1. Work on the feature branch. Push it to `testing`. CI runs every check.
2. `testing` deploys to the testing address on its own. A migration on
   `testing` goes onto the testing database on its own (`db-testing.yml`).
3. **Once everything on testing is green, merge `testing` into `main`
   without asking again.** Green means: CI, the testing deploy and its
   smoke test, and for a database change, the testing database took it
   with 0 new security warnings.
4. `main` deploys live, and `db-live.yml` puts the same migrations on the
   live database. It refuses any migration the testing database does not
   already have.
5. **After anything lands on `main`, merge `main` back into `testing`.**
6. **Check the deploy after it lands.** The smoke test runs against the
   address just deployed. Upload finished is not the same as working.
7. A red check anywhere: stop and say so. A bad deploy is rolled back
   (Cloudflare keeps the old versions), then fixed through `testing`.
8. Every move to live gets a short report: what went live, what the checks
   said. Skill `ship` does steps 1 to 8.

Hotfixes straight to `main` only when the live system is broken.

## 10. Databases

- **Every change to the database shape is a migration file in the repo**,
  with its undo file beside it in `supabase/rollbacks/` and a test file in
  `supabase/tests/`. Skill `new-migration` makes all three.
- **Every new table starts with `revoke all`, RLS switched on, then only
  the grants it needs.** Supabase gives new tables full rights by default.
- **RLS on every table from the moment it is created.**
- **Access is checked in the database**, never only on the screen.
- **Every read and write of a medical record goes in the activity log.**
  Logs name the record, never the person, the diagnosis or the phone.
- **A double action is stopped in the database**: a function that refuses
  the same action by the same person within a set time, with a lock so two
  taps at the same moment cannot both pass. 30 seconds by default, at
  least 3 minutes for money.
- **The local test database behaves like Supabase.** `supabase/tests/
  local_shim.sql` copies Supabase's habits (auth.uid(), default rights on
  new tables), so a test that passes here also passes on the real one.
- **Prove the tests catch faults.** Break the migration on purpose in a few
  ways and check a test fails each time (`new-migration` does this).
- **Migrations run on a throwaway database first.** CI starts a local
  Supabase, runs every migration and every test, then throws it away.
- **Additive by default.** Dropping, renaming or deleting is asked first.
- **Backups are checked, not assumed.** A failed backup is an outage.
- **Least access for every key.** Each token gets only the rights its job
  needs, and the reason is written in `CURRENT.md`.
- **Dependencies are audited in CI.** A package with a known high or
  critical problem fails the build.

### Accepted warnings

A warning Anthony has accepted goes in `ACCEPTED_WARNINGS` in
`ops/supabase_check.py`, with the reason. Nothing goes there without his
yes. Today:
- `auth_leaked_password_protection`, accepted 2026-10-29. It checks
  passwords against stolen lists; this system has no passwords, and it
  needs the paid plan. Do not try to fix it.

## 11. One command checks everything

```
npm run verify
```

Formatter, lint, type check, unit tests, Python checks, build. CI runs the
same command. No agent says "done" before it is green. Never narrow a check
to the errors you expected. The list only ever grows.

## 12. Teaching Anthony Python

- Every line, or small group of lines, has a comment above it saying in
  plain English what it does here.
- The first time a Python idea appears in the repo, the comment explains
  it in one sentence, with its plain meaning in brackets.
- Simple over clever: a plain `for` loop, clear names, top to bottom.
- A reply that wrote or changed Python ends with "Reading the Python": the
  three or four lines worth learning, and what each means.
- `docs/PYTHON-NOTES.md` lists every idea so far, with the file it first
  appeared in.

## 13. The stack

Next.js (static, TypeScript), one Cloudflare Worker, Supabase (in the
hospital's own account), Resend for email, Cloudflare for hosting and R2
files, GitHub Actions for CI and deploys, Python for the checkers, one
small AWS piece. The reasons and free limits are in `PLAN.md`. Changing any
piece is Anthony's decision: say what it costs and wait.

## 14. Skills

Skills live in `.claude/skills/`, with sources and licences in
`.claude/skills/SOURCES.md`. A skill from outside is read whole before it
is added.

**Our own skills:** `ship`, `screens`, `clickthrough`, `new-migration`,
`switch-role`.

**Anything an agent does more than twice becomes a skill**, so the next
agent runs it instead of working it out again.

**When a skill fails:** the skill stops at the first step that goes wrong
and says which step. The agent reads the error and fixes the cause if it
is in the agent's own work, then runs the skill again. If the fault is in
the skill itself, the agent fixes the skill in the same change and says so.
A skill never skips a step to get to the end.
