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
   Done: the RHEMA demo is the newer one, Lana is an older copy. See
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

### From 2026-10-28, third message

40. **Code standard: cleaner than StellaXafe.** Modular, each section on its
    own, no section bleeding into another, short direct headers, Humanizer
    on every comment and doc, easy for a human engineer to carry on.
    Written into `CLAUDE.md` ("The standard for this code").
41. **Quick revert for any change**, **security from day one**, **checks
    before every pull request**, **skills for repeated tasks**. Rules in
    `CLAUDE.md`. Still to build: the rollback workflow, the advisor check in
    CI, the dependency audit in CI, and the first project skills.

### From 2026-10-28, fourth message

42. **Idle screen seen live on his phone: "the animation is good, almost
    unnoticed though."** Asked whether he wants it a little stronger.
43. **Later: replace "Server: Ready" with "Powered by StellaXafe
    Technologies Limited"**, as free marketing. Do it when the sign in
    screen takes over the root address (the server status then moves to
    the smoke test only).
44. **RH logo stays a stand in** until the hospital sends its real logo.
45. He cannot open the link on his tablet yet because of a VPN on it. His
    to fix.

### From 2026-10-28, fifth message

46. **"Move to the next on the list"**: the database. Plan written in
    `docs/DATABASE.md` from the RHEMA demo's fields. Waiting for his yes on
    the plan and on the five safety choices before any SQL is written.

### From 2026-10-28, sixth message

47. **"It is Rhema, R-H-E-M-A."** Every "Rema" in our files changed to
    RHEMA (the demo's file name `indexrema.html` stays as he saved it).
48. **The hospital's note**, word for word: "Medical Reports for both
    nursing mothers and other patients. Nursing Station; Comment/report.
    They note the medications given/the vital signs. They note the time the
    medication was given. Sending Lab information to to the front desk and
    to the nursing station. Also EMR where the records of their medications
    they're currently taking is; this is for the nursing station."
49. **Nursing stations (two)**: nurses message, record vitals, record
    medications given with the time, write comments and reports, and see
    each patient's current medications.
50. **Prescription flow**: doctor sends to front desk; front desk charges,
    marks paid, then sends to pharmacy. The doctor can also send straight
    to pharmacy or lab, and request from them.
51. **Patient status**: visiting, in consultation, admitted, discharged.
    Light EMR only, no scanning.
52. **Money in naira with 2 decimal places**, not kobo.
53. **Patient numbers start RMC-** (RHEMA Medical Center), assigned
    automatically.
54. **PIN lock after idle** (5 or 15 minutes, "anyone that suits"): planned
    10 minutes, changeable by the admin. **Session ends after 24 hours
    without use**, then a fresh sign in.
55. **Lock screen replaces the idle screen**: the PIN pad on the RHEMA idle
    design, with the animation.
56. **Look at simple open-source hospital systems for inspiration.** Done:
    Bahmni (admission, discharge, transfer) and Open Hospital (patients,
    visits, medicines, admissions). Ideas only, marked "(borrowed)" in
    `docs/DATABASE.md`.
57. Plan updated to version 2 in `docs/DATABASE.md`. **Approved 2026-10-28.**

### From 2026-10-28, seventh message

58. **No alert spam.** "Do not be spamming people that do not ask for
    notification." A lab result alerts only the doctor who requested it.
    Updating a record alerts nobody. Front desk never gets lab results.
    Written into `docs/DATABASE.md`. (This narrows the hospital's note that
    said lab information goes to the front desk and nursing station: the
    lab can still send a result to the nursing station on purpose.)
59. **The lab never sees the medical history.** It can add a lab report to
    the record without a request; the doctor sees it in the history later.
60. **Lab statuses**: front desk takes payment, then "Awaiting test"; the
    lab enters the result, then "Completed".
61. **Screens: minimal but complete.** Critical information shows straight
    away; everything else sits under a heading that opens like a drop down
    (lab reports, nurses' notes, vitals history and so on). For the build
    of the patient record screen.
62. **Later, not now:** scanning a paper document and the system reading
    it, once the hospital has a scanner. Propose it then.
63. **Later, maybe:** voice notes that turn into text, reusing his church
    speech to text work (the Bible display project) once it works well.
    Possibly with AI to help write the records. Undecided.

### From 2026-10-28, database step

64. **First migration built and proved**, not yet applied to the hospital's
    database: `supabase/migrations/20261028120000_foundation.sql` (staff,
    rooms, families, patients, activity log) with its undo file and 15
    security tests. Each test was proved to catch a deliberate break
    locally. CI run 40645788977 passed all 15 on a real throwaway Supabase,
    plus undo and redo. WAITING for Anthony's yes to apply it to the live
    database, and for his answer on a second Supabase project for testing.

### From 2026-10-28, keys

65. **Second Supabase project `rhema-testing` created** (meant to be Paris, came out Ireland, automatic
    RLS left off). His own account was removed from the hospital
    organisation (it blocked the second free project, and is not needed).
    That cut off the first github-ci token, which had been made in his own
    account. A new `github-ci` token was made in the hospital account,
    covering both projects. Live project re-checked with it 2026-10-28:
    passed (run 40616871905, attempt 3). Testing project ID:
    **nfrvwvqmfxudaarfuwxg**. Its password is in the GitHub secret named
    **SUPABASE_TESTING** (his name for it; the code uses that name).
    `.github/workflows/db-testing.yml` applies migrations to the testing
    project only. The live project gets migrations from main only, after his
    yes on the SQL.
    APPLIED to testing 2026-10-28 (Database (testing) run 40652458500):
    the foundation migration went on, then the check said ACTIVE_HEALTHY,
    0 security warnings, database login works. Both projects re-checked
    with their own password (Supabase check run 40652220065).
    APPLIED to LIVE 2026-10-28 (Database (live) run 40655032057), through
    `db-live.yml` after the guard confirmed testing had it. Live check:
    ACTIVE_HEALTHY, login works, 2 warnings, both about
    `public.rls_auto_enable()` (Supabase's own function from the automatic
    RLS option): anon and signed in users can call it. Not ours. Proposed
    to Anthony: revoke EXECUTE from anon and authenticated. He said yes.
    Local test showed that alone does not work (every role can run a new
    function by default), so the migration also names public. WAITING for
    his yes on that fuller line. YES given 2026-10-28 ("yes, fuller line").
    DONE 2026-10-28: Database (live) run 40668021266. Live now shows 0
    security warnings, the same as testing.
    Region note: testing reports **eu-west-1 (Ireland)**, not Paris. Live is
    eu-west-3 (Paris). He said keep it.

### From 2026-10-28, after testing passed

66. **Security against attackers, not only RLS.** "Making sure that the
    hospital's database is protected, their code is not exposed publicly,
    and every code is clean, readable." Next steps for it: npm audit in CI
    (CLAUDE.md already promises it, not built yet), security headers on
    the Worker, GitHub secret scanning, the advisor check failing CI on a
    new warning, rate limits on sign in.
67. **Docs an engineer can jump into.** "An engineer just goes to a
    particular section and they know what to do." Every file and doc keeps
    a header and numbered sections. Add a short map at the top of README.
68. **Walk him through the AWS piece when it is time.**
69. **Unstable network.** "Is it possible... when the network is poor, the
    doctor will still get the details? Then when the network is strong, the
    details can go to the server." Answered in chat with three options
    (offline queue on each device, a backup internet line, a small local
    server in the hospital). He chose 1 and 2 (see Decided). Then asked:
    "is it possible they can open any screen and type in something if the
    network is down, and also be able to find patients?... Is that really
    safe?" Answered: typing on any open screen, yes. Offline patient search
    means patient details kept on the computer, so proposed a limited, wiped
    on sign out version. He chose "limited offline" (see Decided). Build it
    with sign in and the first screens, because it needs both.
70. **Cron jobs.** He asked where the system needs one. Answered: nightly
    backup, the renewal and maintenance reminders, the AWS uptime watcher.
    Cloudflare Worker cron triggers are free. Build with those items.

71. **Supabase sign in settings.** He asked (2026-10-28) "can you set up the
    Supabase auth yourself?" No: the github-ci key has Auth Config on read
    only, on purpose (least access), and he does not want a new key. So he
    sets 4 things by hand in both projects: sign ups off, the Magic Link
    template sends a code, code expiry 600 seconds, Site URL. Steps given in
    chat 2026-10-28. Until Resend (6 Nov), Supabase's own email only sends
    to members of the hospital organisation, a few emails an hour.
    Progress 2026-10-29 (his screenshots, testing project): sign ups OFF,
    code expiry 600 s, code length 6, all saved. The email template is
    LOCKED: Supabase only lets you edit it once custom SMTP is set up. So
    the template steps wait for Resend, and until then the email carries
    Supabase's default sign in link. Still to do: Site URL on testing, and
    the same steps on live. Then CI reads the settings on every run.
    Redirect URLs: one each, `<address>/**` for the testing and live
    workers.dev addresses. On 6 Nov, after the domain move, add the
    rhemamedical.app address to Site URL and Redirect URLs on live.
    "auth done" 2026-10-29 for both projects. Check 4 added to
    `ops/supabase_check.py`: reads the sign in settings and fails if one
    moved. Staff are NOT added to the Supabase organisation to receive
    codes before Resend (members can see the database). Until Resend, only
    rhemamedical7@gmail.com can receive a code.

### From 2026-10-29

72. **Nursing station sign in.** "In the nursing station, it's not per
    person. I think there are about 4 nurses working together... if he
    invites nursing station and uses a particular email for nursing
    station, you are not able to know who did what." Same question for
    other shared desks (lab). Proposed: every nurse has their own invite;
    the station computer remembers the nurses who signed in on it; each
    nurse taps their name and types their own PIN before doing anything,
    so every line in the log carries a person's name. YES 2026-10-29:
    "that's the correct way to do it." Same for lab, pharmacy and any
    shared desk. Build it with sign in.
73. **Show him the Cloudflare side as it is built.** "As you are doing it,
    you can still be directing me to go and be looking at the backend,
    where to go to see what you've done": for each Worker function, R2
    bucket and setting, say where in the Cloudflare dashboard to see it.
74. **AWS account.** He is checking whether he already has one, then
    opening it. Guide him through the AWS piece when he says it is ready.
75. **Keep teaching the Python.** "Any new Python code you write, you help
    me so I can still know it... I really liked that one." Standing rule,
    already in CLAUDE.md; he asked for it to continue.
76. **The director's note was checked against our records 2026-10-29.**
    Every line of it is item 48 here and section 7 of docs/DATABASE.md.

77. **Inviting staff: name, email, role, and the role gives the access.**
    "When admin selects this person's role as a matron, the person
    automatically gets the matron role access... it doesn't matter how many
    doctors." Asked: consultants, and should the director have an account.
    There is no matron role yet (roles: front desk, doctor, nurse, pharmacy,
    laboratory, admin). Proposed 2026-10-29: add a matron role (starts with
    nurse access plus announcements); consultants are doctors (the title
    goes in the name, "Dr. ..."); the director is invited as admin, which
    already includes medical records. A wrong email cannot be detected, so
    the admin sees each invite as Waiting, Accepted or Expired, and can
    resend or cancel it; an invite works once and runs out after 48 hours.
    He said "yes, matron role, and director as admin" (2026-10-29), then
    asked for admin as an extra power any role can be given, "just like
    you add someone extra in WhatsApp to become an admin", changeable after
    the invite, with the admin part in the same dashboard (no log out).
    Built: migration 20261029100000_matron_and_admin_access.sql (matron
    role, can_admin column, is_admin() reads can_admin, guard so the last
    admin cannot be removed), undo file, 4 tests; every test proved to
    catch a deliberate break. "yes, admin tick" 2026-10-29: sent to
    testing, then live by his rule. DONE: testing run 40810731523, live
    run 40811029651, both 0 warnings and all four checks passed. The admin
    screens that use it come with the admin step of the build.

78. **Sign in screen, with the backend.** "Go ahead with the sign in
    screen" (2026-10-29). Built on the feature branch, not on testing yet:
    sign in page (remembered people, email, 6 digit code, first PIN twice),
    lock page (idle screen, tap for the PIN card, other people at a shared
    desk tap their own name), lock after 10 minutes, signed out of the
    device after 24 hours, 5 wrong PINs sign out. PIN migration
    20261029120000_pin_lock.sql with undo and 7 tests (each proved to catch
    a break). CI job `signin` signs two made up nurses in for real on a
    throwaway Supabase: PASSED (run 40813601733). Screens checked at phone
    and desktop, both themes; fixed the code boxes spilling at 320px and the
    cursor after a wrong PIN. Workflow first-admin.yml makes the first
    admin. "yes" to the PIN SQL and first admin 2026-10-29 (name: "Dr.
    Anthony", rhemamedical7@gmail.com, invited and accepted on testing).
79. **Dr. Evans (the director) to test.** Anthony will share the testing
    account and pass on the code himself, for testing only. Told: then the
    log shows Dr. Anthony for whatever Dr. Evans does; his own account comes
    once Resend is connected.
80. **Hospital email addresses.** Staff sign in with their own Gmail (no
    mailbox per staff). Up to 3 shared addresses on rhemamedical.app via
    Cloudflare Email Routing to the hospital Gmail. Asked which names
    hospitals use; suggested info@, records@ (patient reports), admin@.
    Sign in codes come from no-reply@ through Resend (no mailbox needed).
    He picked info@, records@, admin@ and no-reply@ (2026-10-29). Set up
    on 6 Nov: info@ and admin@ routed in Cloudflare to the hospital Gmail
    (Gmail "send as" only if they want to write from them); records@
    routed so replies arrive, but sending is done by Resend; no-reply@
    needs nothing.
81. **The testing account shows the director's name.** "Use his own name,
    so that when he logs in, he will not feel awkward." First admin on
    testing: full name "Dr. Evans", email rhemamedical7@gmail.com.
    DONE 2026-10-29 (First admin run 40825242998). Sign in and the PIN are
    on testing (Database (testing) run 40824628182). NOT moved to live yet:
    testing now shows 1 security warning, "Leaked Password Protection
    Disabled". It is about passwords (we use none), it appeared once a
    user existed, and switching it on needs the Pro plan. Live shows 0.
    He said "go live" and to record why it is ignored. Recorded in
    CLAUDE.md ("Accepted warnings") and ACCEPTED_WARNINGS in
    ops/supabase_check.py.
82. **Email inside the app for the admin.** "In the announcement section,
    they can have another place where they used to type in their email and
    send out email... and receive email as well... the admin can be seeing
    email there... and be replying from there", from the hospital's own
    address, without opening Gmail. Possible with Resend (sending and
    receiving). Build after the domain move and Resend (6 Nov).
83. **Desktop sign in until Resend.** His plan: open Gmail in Chrome on the
    desktop, so the sign in link opens right there. Once Resend sends the
    6 digit code instead, the phone and the desktop no longer need to match.

84. **Keep Supabase from pausing.** "Is it possible that you set up a cron
    ... that wakes up every 7 days or every 6 days?" Built
    `.github/workflows/keep-awake.yml`: every day, three small requests to
    each database with the public key (RLS returns nothing). A timer inside
    Supabase may not count as user activity, so it knocks from outside.
    GitHub stops timed jobs after 60 days with no pushes, so the Cloudflare
    timer takes this over before handover.

### Decided

- 2026-10-28: Sign in works the same on testing and live (real email
  codes on both). Offered a "Sign in as" list of made up staff on testing
  only; he chose "proceed with the 13 steps" on both projects instead.

- 2026-10-28: Limited offline search. Only name, RMC number and phone kept
  on the computer, scrambled, the key lost at sign out, everything wiped at
  sign out and at the 24 hour expiry. Medical records are never kept on the
  computer.

- 2026-10-28: Poor network: option 1 (offline queue, anybody already
  signed in keeps working through a drop, saves go up when the network is
  back) and option 2 (backup internet, which the hospital switches on by
  hand in under 5 minutes; they use Starlink). Staff are told the limit:
  what is typed offline reaches the doctor only when the network is back.

- 2026-10-28: Keep the testing project in Ireland. "As long as there's no
  impact... keep the Ireland like that."
- 2026-10-28: Once a change passes on testing, it goes live without asking
  again. Written into CLAUDE.md ("Once testing passes, it goes live").
  `db-live.yml` refuses any migration the testing database does not have.

- 2026-10-28: Database plan approved. Updates alert nobody; people see them
  when they open the record. Alerts only for what was requested or sent on
  purpose. Full record: doctors, nurses, matron only. Lock screen 10 minutes.

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

### Access, as it stands (2026-10-28)

- GitHub secrets set: `SUPABASE_ACCESS_TOKEN` (a scoped token from the
  hospital account, named github-ci, locked to the rhema-hospital project:
  read and write on Database and Migrations only, read on the rest, nothing
  that can delete, pause or restore the project) and `SUPABASE_DB_PASSWORD`.
- The Supabase connector stays on StellaXafe. RHEMA's database is reached
  through GitHub Actions. This environment blocks Supabase addresses, so a
  token here would not work anyway.
- `ops/supabase_check.py` and `.github/workflows/supabase-check.yml` prove
  the access. Sign in settings (email codes, Resend) are set by hand in the
  dashboard, because a token able to change them could also delete the
  project.
- At handover: delete the github-ci token and give the hospital a fresh one.
- PROVED 2026-10-28 (run 40616871905): the token reaches the project, the
  project is ACTIVE_HEALTHY in **eu-west-3 (Paris)**, and the database
  password logs in through the pooler (PostgreSQL 17.11). The project is
  still named "rhemamedical7@gmail.com's Project"; rename to rhema-hospital.
- Supabase's security advisor shows 2 warnings on a fresh project: SECURITY
  DEFINER functions that the public and signed in users can run. To be
  looked at and closed when the first migration is written.
- Cloudflare secrets added 2026-10-28: `CLOUDFLARE_API_TOKEN` (Edit
  Cloudflare Workers template on the hospital account, with Pages, Builds,
  Agents and Containers removed, User Memberships read, Workers
  Observability edit, no expiry, replaced at handover) and
  `CLOUDFLARE_ACCOUNT_ID`. No dashboard link between GitHub and Cloudflare
  is needed: the deploy workflow uses the token.
- **Testing address LIVE 2026-10-28:**
  https://rhema-hospital-testing.rhemamedical.workers.dev (Deploy run
  40623406107, attempt 3, smoke test passed). workers.dev subdomain:
  rhemamedical. This environment cannot open workers.dev, so the live
  check is GitHub's smoke test plus the local screenshots of the same build.
  Adding a Playwright screenshot of the live address to the deploy workflow
  is on the list.

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
  "Rhema Medical Center". Supabase's approval screen allows only ONE
  organisation per connection (seen 2026-10-28). So: the connector points at
  Rhema Medical Center for this build, and gets switched back to StellaXafe
  Ecosystem when StellaXafe work resumes (about a minute, at
  claude.ai/customize/connectors). Migrations do not depend on the
  connector anyway: CI applies them with the SUPABASE_ACCESS_TOKEN secret.
  After switching, start a NEW session (connectors load at session start). First thing in that session: list_projects and confirm the
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
The proposal PDF and the RHEMA demo file are not in the repo, on purpose:
the repo is public, and both are confidential. They go in once it is
private.
