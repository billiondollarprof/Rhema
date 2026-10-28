# CURRENT

Where the RHEMA Hospital Operations System stands. Read this first.
`SESSIONS.md` is the log behind it, and `PLAN.md` is the plan.

---

## ANTHONY'S OPEN REQUESTS

**Read this before anything else in this file, and add to it the moment he
asks for something.** A request comes off this list when it is built and
checked, not when it is planned. (Rule from `CLAUDE.md`.)

### From 2026-10-27 (session 1)

1. **Check the demo is the updated one by comparing it with Lana.**
   Done: the Rema demo is the newer one, Lana is an older copy. See
   `PLAN.md` section 1. *Can come off once he confirms.*
2. **Plan the stack: Next.js front and back end, Neon instead of Supabase,
   Resend for email.** Planned in `PLAN.md`. Waiting for his yes.
3. **Verify Neon can do this without a monthly fee.** Answered: yes, with
   live alerts kept off the database and a nightly backup. `PLAN.md` 3.
4. **Verify Neon works with Resend.** Answered: yes. `PLAN.md` 3.
5. **Is Cloudflare's free 10 GB per account or per project? If per
   account, move the domain to a new Cloudflare account for the hospital.**
   Answered: per account, so yes, new account, and the move is supported.
   The move itself is still to do. `PLAN.md` 3.
6. **Decide public or private repo; write the README and licence "to
   protect our work".** Recommendation: private (`PLAN.md` 5). README and
   licence not written yet, waiting on the decision, because the licence
   wording depends on who owns the code.
7. **Carry over the rules from the StellaXafe repo (CLAUDE.md, AGENTS.md,
   deploy rules).** Done in `CLAUDE.md`, with the signposts.
8. **Apply StellaXafe's instant click to this app.** Written into
   `CLAUDE.md` (project structure). To be built with the first screens.
9. **PWA first; later maybe a very light desktop app, with a free place to
   download it from.** Planned in `PLAN.md` 9.
10. **Two branches, testing and main, and CI and CD this time.** Rules in
    `CLAUDE.md`, pipeline in `PLAN.md` 6. Not built yet.
11. **Connect Google Drive to read his notes.** Already connected; notes
    read. `PLAN.md` 11.
12. **Use a little AWS, something free, to add a cloud stack.** Proposed:
    a Python uptime watcher on Lambda. `PLAN.md` 7. Waiting for his yes.
13. **Use Node.js somewhere visible.** Next.js server code is Node.js. The
    check scripts and CI tooling are Node.js too.
14. **Automate how the agent checks its own code.** Rule in `CLAUDE.md`
    ("Agents check their own work"), `npm run verify`. Not built yet.
15. **Work as experts in DevOps, cloud and cybersecurity, using every free
    resource.** Standing instruction.
16. **Find free open skills on GitHub, save copies in his own GitHub, and
    create our own skills, including ones learned from StellaXafe.**
    Planned in `PLAN.md` 10. Not done yet.
17. **Teach him Python line by line as we build; add Python where it
    fits (validators, tracing).** Rule in `CLAUDE.md`, places in
    `PLAN.md` 8. First Python file not written yet.
18. **Plan the scroll effect.** The app does not need one. Scrollcraft is
    noted for a public hospital website if they order one. `PLAN.md` 10.
19. **He is opening the Neon account.** Steps in the session 1 reply.

### From 2026-10-27, second message

20. **"We are going to actually rush this thing. So we only have about 2
    weeks."** The 8 week timeline in `PLAN.md` 12 is replaced by 2 weeks.
21. **"Create a folder in the drive and name it clients folder... each
    client will have its own credential file."** Done: "Clients Folder" in
    his Drive, with "RHEMA Medical Center Credentials" inside (blank
    template, he fills it). Can come off once he confirms.
22. **REMIND HIM: "we are probably going to create a private repo that
    will not carry code but will carry credentials. That will be later, so
    you will remind me."**
23. **He is making a temporary Gmail for the hospital** and opening every
    account for this job with it (Cloudflare, Neon, Resend).
24. **Email OTP first**, then the back end and front end, "everything that
    is important at once".
25. **Sign in:** the admin invites, the person signs in once with an email
    code, then a 4 digit PIN unlocks the screen after inactivity (as in
    the demo).
26. **Notifications on the installed app**, with vibration, and an
    emergency "call attention" alert that vibrates stronger. Calls later,
    not now.
27. **Email address admin@ on the hospital domain.** He says the domain is
    remamedical.app (no S, .app). Spelling to be confirmed against the
    hospital name RHEMA.
28. **Agents get API tokens through GitHub secrets, never through the
    chat.** Some setup he does by hand so he learns the platforms.
29. **Later, possibly: bundle as a desktop app and a mobile app** (Tauri,
    Capacitor), since the UI already fits any screen.

### From 2026-10-27, third message

30. **"Skip the email authentication now. Let's get the app working."** Email
    codes, Resend and the domain move all wait for 6 November. Everything
    else goes ahead now.
31. **"Download the humanizer into our GitHub repo"** and use it on
    everything written. Done: `.claude/skills/humanizer`, rule in
    `CLAUDE.md`. Can come off once he confirms.
32. **"Look for any open source... any skill... before we use the skill, you
    look at it and say it matches."** Done: 13 skills read and saved, with
    the list and reasons in `.claude/skills/SOURCES.md`.
33. **Files to write: README, licence, and the repo foundation.** Done
    2026-10-27: README, LICENSE, the Next.js and Worker skeleton,
    `npm run verify`, CI and deploy workflows, the first Python check. Comes
    off once he has seen it on the testing address.
34. **Aim: app built within about 10 days, test runs and small fixes after,
    then plug in email and install.** No need to wait for day 14.

### From 2026-10-28

35. **Holding screen: use his image** (blue waves, "RH" mark in a circle,
    hospital name, "HOSPITAL OPERATIONS SYSTEM"), "a little bit kind of
    animated... has some shimmer". It covers the screen when idle. Swap the
    "RH" mark for the real hospital logo when he gets it. The image as sent
    spells the name "REMA HOSPITAL", without the H. He confirmed RHEMA.
    Built 2026-10-28 in `web/components/IdleScreen.tsx`, drawn in code:
    drifting waves, glowing light ribbons, a breathing ring, a shimmer across
    the name, and no movement when the device asks for reduced motion. Shown
    at the root address for now. Checked at 320, 375 and 1440 wide. Comes off
    when he has seen it on the testing address.
36. **Question, answered 2026-10-28 and saved to Drive** as "09 - BUSINESS -
    Reselling the Hospital System to Other Nigerian Hospitals" (Discovery
    folder): how to resell or repurpose
    the system for other hospitals, and where to find Nigerian hospitals that
    have not gone digital.

### From 2026-10-28, second message

37. **Renewal reminder built into the app.** One month before the domain
    renews (and any other yearly cost), the system reminds the admin inside
    the app and emails the hospital's decision makers, telling them to
    contact StellaXafe for the renewal. "Instead of waiting for Cloudflare to
    remind them." The domain is the only yearly cost the hospital pays, about
    $14 a year. To be built with the admin module, using a scheduled job.
38. **Maintenance reminder every 3 months**, telling the admin to contact
    StellaXafe for a system check and bug fixes. It starts after the 3
    months of free support in the proposal; the paid maintenance plan after
    that is discussed separately with the hospital. Same scheduled job.
39. **"Upgrade to Team" seen in Supabase.** Answered: inviting a member
    worked on the free plan and nothing was paid. Team is an optional paid
    plan we do not need.

### Decided

- 2026-10-27: Licence. "The entire back end for this particular project
  belongs to Rhema." StellaXafe keeps its general foundation and can build
  similar systems for other clients, but never reuses this project's code as
  it is. Written into LICENSE. The proposal says the hospital owns
  everything, so the director should agree this one line.

- 2026-10-27: Repo made private (he confirmed).
- 2026-10-27: 2 weeks, not 8.
- 2026-10-27: Static Next.js front end on Cloudflare, plus a Cloudflare
  Worker for the back end.
- 2026-10-27: AWS uptime watcher: yes.
- 2026-10-27: Night use is rare (mostly nurses). Count nights as 8 hours.
- 2026-10-27: He chose Neon, then asked whether Supabase is better. The
  numbers: 720 hours minus 8 night hours x 30 = 480 daytime hours, and
  Neon free gives about 400. So Neon free runs out around day 25 every
  month. Recommended Supabase for this project, Neon for a later one.
  He said yes: **Supabase** for this project.
- 2026-10-27: Domain is spelled with an H: rhemamedical.app.
- 2026-10-27: Hospital Gmail is rhemamedical7@gmail.com. Cloudflare, Supabase
  and Resend accounts opened with it. Passwords live only in the Drive doc.
- 2026-10-27: "I'm prioritizing their job over my CV." When a choice is
  safer for the client, it wins.
- 2026-10-27: Next.js for front and back end. Neon, not Supabase. Resend
  for email. The hospital gets its own Cloudflare account. PWA first.
  Two branches, `testing` and `main`, with CI and CD.

### Waiting on Anthony

- Domain move from his Cloudflare account to the hospital's. Done so far:
  new account has the zone added (Free plan, bots blocked, Pending,
  nameservers cheryl and tim). DNSSEC is off in the old account. BLOCKED by
  Cloudflare until the domain is 10 days old ("registered within the last
  10 days"). Registered 27 October 2026, so the move opens on **6 November
  2026**. Do NOT delete the domain. Plan for the wait: add the Resend
  records in the OLD account now so email codes work today, add the same
  records to the new account's pending zone before the move, then move.
  The app runs on a workers.dev address in the hospital account until the
  move, then gets the real domain.
  Checked 2026-10-27 at his request: records do NOT move with the domain
  (Cloudflare docs), and a pending zone can hold records in advance. Cloudflare
  does not document whether DNS answers pause for a short time during the
  switch. Resend, if a record goes missing, marks a verified domain
  "temporary failure" and checks again for 72 hours before failing it. So:
  hospital staff go live only AFTER the move (6 Nov), and the move is done at
  a quiet time. Before go-live, Resend must show Verified again.
- Invite his own Supabase login into the hospital's Supabase organisation:
  DONE 2026-10-28, he accepted it. But the agent's Supabase connector was
  authorised for the StellaXafe organisation only, so it still cannot see
  "Rhema Medical Center". He must reconnect the Supabase connector at
  claude.ai/customize/connectors, tick BOTH organisations on Supabase's
  approval screen, then start a NEW session (connectors load at session
  start). First thing in that session: list_projects and confirm the
  hospital project (ref ntfvckqczpmylskusgft) and its region.
- Supabase project region and name (rename to rhema-hospital).

- Yes or no to the stack and the plan in `PLAN.md`.
- Yes or no to the AWS uptime watcher.

---

## State of the repo

2026-10-27: the foundation is in. `npm run verify` passes all six checks
(format, lint, types, tests, Python dash check, build). The holding screen
was run under `wrangler dev` and screenshotted at phone and desktop widths,
in both themes. Deploy waits for the Cloudflare secrets. First CI run on `testing`
passed on GitHub (run 40601990216).

Session 1 wrote the rules and the plan only. There is no app code yet.
The proposal PDF and the Rema demo file are not in the repo, on purpose:
the repo is public, and both are confidential. They go in once it is
private.
