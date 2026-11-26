# DONE.md

Anthony's requests that are finished: built, checked and live, or answered.
They moved here from `CURRENT.md` on 2026-10-29 so the open list reads in
one minute (Anthony: "Let's have a done.md"). Word for word, numbers kept.

When a request in `CURRENT.md` is live and checked, move it to the end of
this file.

---

1. **Check the demo is the updated one by comparing it with Lana.**
   Done: the RHEMA demo is the newer one, Lana is an older copy. See
   `PLAN.md` section 1. *Can come off once he confirms.*
2. **Plan the stack: Next.js front and back end, Neon instead of Supabase,
   Resend for email.** Planned in `PLAN.md`. Waiting for his yes.
3. **Verify Neon can do this without a monthly fee.** Answered: yes, with
   live alerts kept off the database and a nightly backup. `PLAN.md` 3.
4. **Verify Neon works with Resend.** Answered: yes. `PLAN.md` 3.
6. **Decide public or private repo; write the README and licence "to
   protect our work".** Recommendation: private (`PLAN.md` 5). README and
   licence not written yet, waiting on the decision, because the licence
   wording depends on who owns the code.
7. **Carry over the rules from the StellaXafe repo (CLAUDE.md, AGENTS.md,
   deploy rules).** Done in `CLAUDE.md`, with the signposts.
8. **Apply StellaXafe's instant click to this app.** Written into
   `CLAUDE.md` (project structure). To be built with the first screens.
10. **Two branches, testing and main, and CI and CD this time.** Rules in
    `CLAUDE.md`, pipeline in `PLAN.md` 6. Not built yet.
11. **Connect Google Drive to read his notes.** Already connected; notes
    read. `PLAN.md` 11.
13. **Use Node.js somewhere visible.** Next.js server code is Node.js. The
    check scripts and CI tooling are Node.js too.
14. **Automate how the agent checks its own code.** Rule in `CLAUDE.md`
    ("Agents check their own work"), `npm run verify`. Not built yet.
17. **Teach him Python line by line as we build; add Python where it
    fits (validators, tracing).** Rule in `CLAUDE.md`, places in
    `PLAN.md` 8. First Python file not written yet.
18. **Plan the scroll effect.** The app does not need one. Scrollcraft is
    noted for a public hospital website if they order one. `PLAN.md` 10.
19. **He is opening the Neon account.** Steps in the session 1 reply.
21. **"Create a folder in the drive and name it clients folder... each
    client will have its own credential file."** Done: "Clients Folder" in
    his Drive, with "RHEMA Medical Center Credentials" inside (blank
    template, he fills it). Can come off once he confirms.
23. **He is making a temporary Gmail for the hospital** and opening every
    account for this job with it (Cloudflare, Neon, Resend).
24. **Email OTP first**, then the back end and front end, "everything that
    is important at once".
25. **Sign in:** the admin invites, the person signs in once with an email
    code, then a 4 digit PIN unlocks the screen after inactivity (as in
    the demo).
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
39. **"Upgrade to Team" seen in Supabase.** Answered: inviting a member
    worked on the free plan and nothing was paid. Team is an optional paid
    plan we do not need.
40. **Code standard: cleaner than StellaXafe.** Modular, each section on its
    own, no section bleeding into another, short direct headers, Humanizer
    on every comment and doc, easy for a human engineer to carry on.
    Written into `CLAUDE.md` ("The standard for this code").
45. He cannot open the link on his tablet yet because of a VPN on it. His
    to fix.
46. **"Move to the next on the list"**: the database. Plan written in
    `docs/DATABASE.md` from the RHEMA demo's fields. Waiting for his yes on
    the plan and on the five safety choices before any SQL is written.
47. **"It is Rhema, R-H-E-M-A."** Every "Rema" in our files changed to
    RHEMA (the demo's file name `indexrema.html` stays as he saved it).
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
61. **Screens: minimal but complete.** Critical information shows straight
    away; everything else sits under a heading that opens like a drop down
    (lab reports, nurses' notes, vitals history and so on). For the build
    of the patient record screen.
64. **First migration built and proved**, not yet applied to the hospital's
    database: `supabase/migrations/20261028120000_foundation.sql` (staff,
    rooms, families, patients, activity log) with its undo file and 15
    security tests. Each test was proved to catch a deliberate break
    locally. CI run 40645788977 passed all 15 on a real throwaway Supabase,
    plus undo and redo. WAITING for Anthony's yes to apply it to the live
    database, and for his answer on a second Supabase project for testing.
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
83. **Desktop sign in until Resend.** His plan: open Gmail in Chrome on the
    desktop, so the sign in link opens right there. Once Resend sends the
    6 digit code instead, the phone and the desktop no longer need to match.
84. **Keep Supabase from pausing.** "Is it possible that you set up a cron
    ... that wakes up every 7 days or every 6 days?" Built
    `.github/workflows/keep-awake.yml`: every day, three small requests to
    each database with the public key (RLS returns nothing). A timer inside
    Supabase may not count as user activity, so it knocks from outside.
    Correction 2026-10-29: GitHub's 60 day switch-off is for public repos
    only; this repo is private, so it keeps running. A Cloudflare timer in
    the hospital's account is still added before handover, because this
    one lives in Anthony's GitHub. Proved 2026-10-29 (run
    40827203000): both databases answered, refusing with Postgres's own
    42501, which shows the knock reached them and no data left.
    Sign in, the PIN and the accepted warning went LIVE 2026-10-29
    (Database (live) run 40826794056, Deploy run 40826794027).
85. **See the app as each role before Resend.** "How do I log in as a
    normal doctor or a front desk, since the email only sends for an
    admin? Can we run an SQL code... on the testing branch." Built
    `.github/workflows/testing-role.yml`: Anthony picks a role in GitHub
    Actions, it changes the testing account (rhemamedical7@gmail.com) to
    that role on the TESTING database only, admin tick kept on. He keeps
    Dr. Evans as plain admin ("just leave it like that").
    Proved 2026-10-29 (run 40828938982, role admin, so nothing visible
    changed). Also for him to look at each module and send corrections
    before 6 Nov.
86. **Home screens.** "Go ahead with the home screens" (2026-10-29). Plan
    shown to him, from the demo's home(): greeting with role and room;
    4 quick actions per role (demo ACT list; ones whose page is not built
    yet shown as "Soon", never as dead buttons); tiles (registered today,
    in queue, in consultation, completed; lab pending once lab exists);
    the queue card per role; patients seen chart; front desk closing time
    banner; bottom bar on phone, side bar on desktop. Needs a new table,
    queue_entries. "Online now" waits for messages (live presence).
    "yes" to the queue SQL 2026-10-29 ("you can carry on with the SQL").
    Migration 20261029140000_queue.sql with undo and 7 tests, each break
    caught (one test was fixed after it passed for the wrong reason).
    Home screens built on the feature branch 2026-10-29: frame (top bar,
    bottom or side menu, Soon items), greeting, quick actions, count
    tiles, Patients seen chart, queue card per role. Real walk-through on
    GitHub passed (run 40832854613): a nurse sees only her room, calls a
    patient in, refresh keeps it, finishes, Completed today shows 1.
    Screens checked for three roles, both themes, phone and desktop, no
    overflow at 320 to 390px. Added a read-only function patients_seen()
    for the chart. "yes, chart function" 2026-10-29. LIVE 2026-10-29
    (Database (live) run 40838983605, Deploy run 40838983622). Live staff
    row for Dr. Evans made (First admin run 40838481441).
90. **Tell him what was borrowed from other hospital systems, and any
    small detail that would help, if it does not complicate the flow.**
    (2026-10-29.) Borrowed so far (ideas only, from Bahmni and Open
    Hospital, marked "(borrowed)" in docs/DATABASE.md): one clear patient
    status (Visiting, In consultation, Admitted, Discharged); an
    admissions history, so every stay is kept; a medication record with
    the exact time each dose was given and who gave it; mistakes voided
    with a reason, never deleted. Small extras offered for his yes or no:
    (a) how long each patient has been waiting, on the queue card;
    (b) a warning at registration when a patient with the same name, date
    of birth and phone already exists; (c) age worked out from the date of
    birth; (d) allergies shown in red at the top of the record; (e) "last
    seen" date in patient search. He picked all five, "a, b, c, d and e"
    (2026-10-29). For (b): "should come with reuse this patient's
    information since it's already there... you can open a new record"
    (offer to open the existing patient instead of a duplicate).
91. **Medications in the record: active, suspended, stopped.** (2026-10-29)
    "Nurses... can suspend a particular drug, they can stop giving
    somebody a particular medication... edit or update the medication...
    suspended medicine... orange... stopped permanently, maybe red... still
    giving it, maybe green or blue." Plus the record of each dose given,
    with the exact time and who gave it. History kept: a change of status
    never deletes the line. Build with the medical record (Patients
    stage 2).
95. **Staff profile page with a photo.** (2026-10-29) "A staff has a short
    profile... they can upload their image." Also a selling point. Note:
    the demo's invite screen says "Staff cannot change their own name or
    photo. The administrator manages this." DECIDED 2026-10-29: dropped.
    "No need... it's not a social media platform... everybody in the staff
    know each other." Only the admin sets names; no photos.
96. **Future features, kept separate.** Birthday wishes, wellness check-in
    3 days after discharge, check-up reminder 1 month after, appointment
    reminder the day before (WhatsApp then SMS), weekly digest for
    consultants, print or send to email, staff VoIP calls, automatic
    payment recording, voice typing. All written in
    docs/FUTURE-FEATURES.md, in his words. Voice notes in chat stay in the
    RHEMA plan (messages module), no special integration needed.
97b. **Call attention: two taps, by role or room, from the top bar.**
    (2026-10-29) "That call attention button, it should not be something
    that opens a new page... it's more like a drop down overlay that
    doesn't shift anything on the interface. It just drop down like a
    rolling paper... once they click on front desk immediately, it sends
    the ring immediately... it doesn't call attention by name. It calls
    attention by role... front desk is always at the top." So: a bell
    button in the top bar (and the Call attention quick action) opens a
    list that drops over the page without moving anything; Front Desk
    first, then Matron, the other rooms and departments, never the
    caller's own room; one tap sends the ring to everyone on duty there.
    No form, no typing. Replaces the demo's Call attention page (which
    had department, person and note).
97c. **Call attention: how the list works, decided.** (2026-10-29) "yes
    to both, go ahead with step 1". The call goes to a ROOM, never a
    person: "it doesn't matter which person specifically is in that room
    as long as that's the room they are calling." Front Desk, Nursing
    Station, Laboratory and Pharmacy are groups on one shared computer:
    one tap rings everyone on duty there ("It doesn't matter whether it's
    Kichi or Amaka or Queen or Adora or Aminat"). Consultant opens a
    second list of the consultant rooms registered (Room 1, 2, 3), and the
    call goes to that room. Matron opens a list of the matron offices
    registered. "If you want to call a particular person, you could have
    just used a phone or use the chatting system." Step 1 (now): card and
    bell for anyone with the app open. Step 2 (next): push when the app
    is closed. Migration 20261029180000_attention_calls.sql: "yes, call
    attention" 2026-10-29. He then asked for the double tap guard at 30
    seconds, kept in the database ("15 seconds can even be 30 seconds"),
    so it is 30 seconds plus a lock (two taps at the same moment: proven
    locally, 1 call saved). Now a standing rule in CLAUDE.md.
97d. **Call attention list: a small search, and a sent mark.** (2026-10-29)
    "a little search bar should be on that attention drop-down... in case
    they just know the room number... or they just type the matron's
    name." Front Desk, Lab and the other groups stay as one tap. When a
    call is sent: "a bell icon... it animates somewhat and then marks
    good... very minimal, to know that, oh, I've called their attention."
97e. **Call attention uses a phone icon, the bell is for notifications.**
    (2026-10-29) "having the bell icon to represent call attention and also
    represent notification... in three different places... If the top bar
    is to call attention, then maybe we use call icon." Done 2026-10-29:
    phone icon on the top bar button, the list, the floating card and the
    Home tile. Rights fix: "yes, rights fix" 2026-10-29.
    **97, 97b, 97c, 97d, 97e: step 1 LIVE 2026-10-29.** Testing and live
    both 0 security warnings. CI proves it with two real screens: Nurse
    One rings Front Desk, the desk screen gets the card live, a second tap
    says Already sent, X keeps it closed after a refresh. Step 2 (push
    when the app is closed) is next on this item.
97f. **The Home "Call attention" tile: maybe replace it.** (2026-10-29)
    "if it is there [in the top bar], then that tab that is on the
    dashboard that says call attention, maybe you look for something more
    common with every other person and replace and put it there." Asked
    him which job. Decided 2026-10-29: "just leave the call attention at
    the home screen tile. Just leave it." Done.
97g. **Later: the call button gives two choices.** (2026-10-29) "by the
    time we start putting voice call, then when you click on it, it gives
    you two options: instant call attention or dial." Goes with VoIP in
    docs/FUTURE-FEATURES.md.
99. **Patients, stage 1, built 2026-10-29** (no new SQL): Find (name,
    number or phone; age, last seen, in hospital now), Register (demo
    form, age from date of birth, phone tidied, possible duplicate shown
    with "Use this patient"), Edit, Send to room; Home quick actions and
    the Patients menu switched on; waiting time on the queue card. Real
    walk-through passed (run 40844700405). Screens checked at phone and
    desktop, both themes, no overflow. Extras done: (a) waiting time,
    (b) duplicate check with reuse, (c) age, (e) last seen. (d) allergies
    comes with the medical record (stage 2, needs SQL).
100. **Medical record, database.** "Go ahead with the medical record"
    (2026-10-29). Migration 20261029160000_medical_record.sql written and
    tested locally, feature branch only: record openings (logged, 12 hour
    window), medical profile, allergies, conditions, medications with
    active, suspended, stopped and a status log, doses given with exact
    time and giver, vital signs, nursing notes, consultation notes. 12
    tests, every deliberate break caught. Test 8 found a real fault in the
    foundation: "a void needs a reason" let an empty reason through on
    patients; the same file fixes it (drop and re-add that one rule).
    "yes, medical record" 2026-10-29, after he asked how opening and
    voiding work (explained: staff can open any record any time; the app
    logs the opening first; Void asks for a short reason, the line stays
    greyed and crossed out). LIVE 2026-10-29: testing then live, 0
    security warnings on both. Done.
101. **Record screens: simple and seamless, and tidy the alignment.**
    (2026-10-29) "Even though... they are complex information... the user
    interface is laid out in a very seamless and simple way. Just the way
    we started the dashboard." Also: "the way the thing displays on in
    desktop... some that are not well aligned properly. So I need you to
    align those." Improve, do not change: "Not changing it. No, don't
    change it. What I just want is improvement to look even simpler."
    Built 2026-10-29: /patients/record/?p=ID. Allergy banner first,
    folding cards, one line shape everywhere, two columns on desktop.
    The patient card's facts are grouped (Patient, Contact, Next of kin)
    so they line up, and a Medical record button shows for medical staff.
    Walked through with made up data: every control wrote the right row,
    an empty reason and a bad number are refused, no overflow 320 to 390.
    The real e2e now walks the record too. LIVE 2026-10-29. Done.
97h. **Review the agent rules and suggest skills.** (2026-10-29) "Is the
    rules that I gave, are they too tight? Are there some rules that if
    they are not there, it will allow Opus 5.5 to work better... rules
    that I might not have included... things I've been repeating... that
    could have been built as a skill." Review given in chat 2026-10-29. He said
    "your suggestions are right" (2026-10-29). Done 2026-10-29: CLAUDE.md
    rewritten as short rules (278 lines) with one page of may, must ask,
    never; the stories moved to docs/RULES-HISTORY.md word for word; the
    StellaXafe only lines dropped; read only SQL on testing is free; writes
    are shown as one batch with one yes; small asks done without a
    repeat-back; push straight to testing; one feature per session;
    finished requests moved to docs/DONE.md. Skills built and each run
    once: ship, screens (with scripts/overflow-audit.cjs at last),
    new-migration, switch-role.
97. **Call attention: a floating alert with a bell, now, not later.**
    (2026-10-29) "Once that attention is needed, even if they are doing
    something on the computer, it can float immediately... with the X to
    remove it... it doesn't affect what they are doing. If they were
    typing, it just floats in." Sound: "the ringing bell sound. Kring!",
    on the phone and on the computer. "This one is not a future feature.
    This one is part of what we are doing now." Build with notifications:
    a card that floats in a corner without taking the cursor, a bell
    sound in the app, a phone or computer notification (push) when the
    app is in the background. Told him: a push notification uses the
    device's own notification sound, the custom bell plays when the app
    is open; and a browser only plays sound after the person has touched
    the page once (signing in counts).
    **Step 1 LIVE 2026-10-29** (see docs/DONE.md, 97b to 97f).
    **Step 2, push when the app is closed:** "yes" 2026-10-29. Built:
    migration 20261029200000_push_devices.sql (device table; add and
    remove your own device; a trigger sends through pg_net to the Worker,
    with a secret from Vault), 8 tests on a real Supabase, deliberate
    breaks all caught; the Worker encrypts and signs each push (10 tests);
    sw.js, manifest and icons; a "Turn on" line in the Call attention list;
    signing out removes you from the device; push-keys.yml makes the keys.
    "Should run them and validate them" 2026-10-29: applied to testing,
    but the advisor shows 1 new warning (pg_net in the public schema). The
    check printed it and still said passed: fixed, a new warning now fails
    the run. Fix migration 20261029210000_pg_net_schema.sql (switch pg_net
    off and on again inside "extensions") is ready, CI green on the
    feature branch. "yes" 2026-10-29: pg_net moved; testing and live both
    0 warnings. LIVE 2026-10-29 (database and screens); the live site has
    no keys yet, so it sends nothing until push-keys runs for live.
    Testing keys made 2026-10-29 (push-keys run 40975381246; the Worker
    refuses a wrong secret). Tool testing-ring.yml made, to ring his phone
    from a made up "Test Caller". PHONE TEST PASSED 2026-10-30 on his
    Android, app closed and screen locked (testing-ring run 40992134202:
    Worker "sent 1, gone 0, failed 0"; he got the alert). His note: "it
    used my own phone's default notification tone... not really that loud...
    I even thought it would have one kind serious ring" (see 105).
    Live keys: Anthony ran push-keys for live himself 2026-10-30 (run
    40995882870; the Worker check passed: key served, wrong secret
    refused). DONE 2026-10-30.
102. **Installation guide: install the app on phone and desktop.** (2026-10-29)
    "We are going to put installation guide on a section... how to install
    it on phone or on your desktop." On a desktop that has not installed
    it: an Install button "somewhere... at the corner" (a banner is
    optional: "or we forget about banner"); once installed it no longer
    shows, and it comes back if they uninstall. For iOS and Mac Safari: real
    screenshots of the real browser, with circles and arrows, "step one,
    this, step two, the other one": tap Share, then Add to Home Screen. Cover
    iPhone, iPad, macOS and Android/desktop. Heading catchy, for example
    "Lightning fast download" or a progressive web app line: "for best
    performance, you need to download it", because of notifications and
    chat. Also useful when reselling to other hospitals. Not started.

    Built 2026-10-30: /install/ page, "Get RHEMA on every device", animated
    steps for Android, iPhone, iPad, Windows and Mac. LIVE 2026-10-30.
103. **A must-do "Allow alerts" card the first time on each device.**
    (2026-10-30) "At the first time the person is logging into that new
    computer, to that new phone, once the system knows it's new... it asks
    that question... a very good, well-designed card... floats... we have
    to make it not to be a choice... there is no X, it's only the allow
    button... write it in a way that they know that it's a mandatory
    requirement." Not started. Note: the phone's own "Allow?" question
    still has a Block choice; if Block is picked, the card stays and shows
    how to allow it in the settings.

    Built 2026-10-30: the Allow card, middle of the screen, no X, only
    Allow; Block shows how to switch it on, and Check again. LIVE 2026-10-30.
104. **iPhone, iPad and Mac: install first, then the alerts card.**
    (2026-10-30) "If it is a Mac system, an iPad, the system forces them to
    download. So what now floats... will be the download instruction to
    install... You can even animate the process... click on the share
    button, then click on the home screen... it's only when they have
    downloaded it and open it will they allow for notification floating."
    Same for Android: install first, then the Allow card inside the
    installed app ("just the same way for the iPhone"). No website can
    install itself on iPhone or Safari, so the animation guides them.
    Goes with 102 and 103. Not started.
    Built 2026-10-30: install card first on every device; one tap Install
    where the browser allows it, the animated guide where it does not;
    the Allow card only inside the installed app. LIVE 2026-10-30.
105. **The alert should ring loud, not sound like a message.** (2026-10-30)
    "It just did tokotom as if one message pops in. So it didn't force
    serious ring." A web app cannot choose its own notification sound; the
    phone uses its notification tone. Options given to him 2026-10-30:
    (a) after install on Android, the app gets its own notification
    setting, so each phone sets a loud ring tone for RHEMA once (a step in
    the install guide); (b) later, a small native app wrapper (item 29)
    can play a real alarm sound. DECIDED 2026-10-30: option (a). Built as
    part of 102 to 104.

    LIVE 2026-10-30. Done.
106. **Fix the GitHub notes: Node.js 20 and ubuntu-latest.** (2026-10-30)
    "Fix the fixes for the notification on the Node.js and the Ubuntu
    latest, apply them so that nothing takes us by surprise. Use newer
    version and name the name." Done 2026-10-30: checkout v6, setup-node
    v6, setup-python v6, upload-artifact v6, supabase/setup-cli v2 (all
    checked to run on Node.js 24), and every job runs on ubuntu-24.04 by
    name. Green on testing and live 2026-10-30; the Node.js note is gone
    from the logs. Done.
107. **Install and alerts cards, second round.** (2026-10-30, with photos of
    his iPad's real Share menu) In his words:
    - "All of those notifications that pop up, everything has to be
      humanized. They don't have to read AI-ish."
    - The animation must match the real screens: on iPad the Share button
      is at the top right; the menu shows people and apps first, then
      Copy, Add to Reading List, Add Bookmark; "you have to scroll to see"
      Add to Home Screen. Same on iPhone. Carry it through to the app
      installed and opened.
    - The Install button "takes the person to that section because it's a
      full page on its own... clean and bigger", with the animation and
      written steps: "the first step, second step, third step".
    - Android: "just click the install button and it installs."
    - Once installed on a device it must not ask again, even in the
      browser; if they uninstall, ask again.
    - The install card gets a faint way out: "ignore button, but make it
      faint at the top left corner", or "If you have already installed,
      click here to ignore" inside the explanation. The Install button is
      what the eye sees first.
    - Alerts: still required, and only inside the installed app (keep as
      built). If they tap Block, "just leave it, let it not be like all
      those annoying ads"; ask again the next time a call comes for them.
    - The /install/ page that opens before sign in: "I like it."
    "yes, 107" 2026-10-30, adding: "if a person has already clicked ignore
    the first time, don't prompt them again", "do not show install more
    than 3 times", and the skip line "a little bit legible", on its own
    line, "the same copy... on Android and Mac OS".
    Built 2026-10-30: skip line ("Already installed RHEMA on this phone?
    Tap here to skip this.") never asks again; at most 3 showings per
    browser; Android, Chrome and Edge remember an install and ask again
    only after it is removed; Install on iPhone, iPad and Mac Safari (or
    when the browser has not offered one tap install) opens /install/ with
    the animation and the numbered steps; the iPhone and iPad animation
    follows his photos (Share, people and apps, scroll down, Add to Home
    Screen, Add, icon, app open); Block closes the card and the call card
    later says how to switch alerts on; all card text rewritten through
    the Humanizer. Walked through: every rule checked, no overflow.
    LIVE 2026-10-30. Done.
108. **Install guide: only ring what they tap, and make it easy for a
    beginner.** (2026-10-30) "You only circle and highlight what they
    actually need to click... so nobody gets confused" and "check your
    animation and understand that at least it's something that can easily
    guide someone who is not tech savvy." Done 2026-10-30: the scroll step
    has no ring, only a grey Scroll sign beside the menu; one red ring per
    step, on the words to tap; bigger menu words; Safari's real bars
    (iPhone: back, forward, Share, bookmarks, tabs; iPad: Share, +, tabs);
    "Step 2 of 6" written under the picture; 5 seconds per step, and it
    stays on a step once tapped; arrows never cover words. Checked every
    step on iPhone, iPad, Android and Mac at phone width. LIVE. Done.
110. **A livelier sign in screen with hospital pictures.** (2026-10-30)
    "When it has downloaded, the interface does not really look that fine"
    ... images "of doctors in hospital... smiley, healthy people, doctor
    attending to patients... sliding in animated... the blue splash of the
    color of the hospital on it", WebP, small but good quality, fitting
    phone and desktop. Options he gave: ChatGPT images (one collage of 5
    for desktop, one of 5 for phone, he generates, agent crops), a short
    looping video, Unsplash pictures used online (as in Amara), or an
    animation drawn in code. He asked for the agent's opinion and the
    prompts. Unsplash and Pexels are blocked from the agent's machine.
    He chose ChatGPT and sent both collages. Built 2026-10-30: 5 photos
    per collage cut into web/public/signin/ (WebP, 24 to 44 KB each), a
    slideshow behind the sign in card (components/auth/SignInPhotos.tsx),
    blue wash, slow drift and zoom, 6 seconds each, cross-fade. Live
    2026-10-30 (commit 58348d3), all checks green, smoke test passed.
111. **Photos on the lock screen too, and a real float, not a switch.**
    (2026-10-30) "Before the admin, I think you should do it for the lock
    screen because that's where they will also see it all the time... the
    image is not really animated. It's not floating... slight zoom in, zoom
    out... It's just switching instantly. It should be soft... not just a
    slideshow, but just animating and changing." Then: "yes, start number
    2, admin". Built 2026-10-30: photos behind the lock screen's waves and
    name; each photo zooms and drifts the whole 9.5 seconds it is seen,
    fades over 2.5 seconds. Live 2026-10-30, all checks green, smoke test
    passed.
112. **Admin (build step 7): invite staff, staff list, rooms, activity
    log.** (2026-10-30) His words, in order:
    - Invite: "they get a one-time link by email. But whether or not they
      click through the link, as long as they log in using that same email
      that was invited... if they click through the link... the email is
      already pasted there... some sort of like a deep link... if they do
      not click the link, they can still type in the email as long as the
      email has been activated."
    - "72 hours instead of 48 hours for expiry... otherwise it expires and
      the admin will see that this invitation has expired." An expired
      invite can be sent again.
    - "An admin can revoke... If admin revoke somebody, he can still add
      that same person back."
    - "The admin can change anybody's room or access and can switch a
      person off. A switched off person can't sign in."
    - Suspend and revoke are two things: "suspend does not mean the person
      will have to get a new invitation." Unsuspended: "they might get an
      email... that their account has been unsuspended." Suspended or
      revoked: no email. Revoked: "can be re-added, and if they are
      re-added, it means they are coming in again to start the account
      again."
    - "Those actions will always go with the pin, the admin's pin... the
      same pin they are using to log in."
    - Rooms: add and rename. Activity log: as the demo (per staff member,
      signed in, signed out, time online, what they did).
    - "Super simple system to use... easy flow."
    - Asked: does the admin enter the server key? Answer: no, never.
    - Asked to confirm the code is modular and healthy.
    Done 2026-10-30, live (commit on main after "Merge testing into main:
    Admin"): Admin menu for admins, tabs Staff, Invite, Rooms, Activity;
    invitations 72 hours, Copy link until Resend; suspend, unsuspend,
    revoke and cancel with the admin's PIN, checked in the database; the
    database refuses sign ups without an invitation. Live and testing
    security checks: all five passed, 0 warnings. Sign ups switched on in
    both projects by Anthony.
114. **The hospital's logo and real name, blue kept, a few red accents.**
    (2026-10-30, sent the letterhead.) Name: RHEMA MEDICAL CENTRE, Former
    License Office by Ojolu Junction, Sapele, Delta State, Nigeria. "Crop
    out the logo and use the logo for where we have the... RH", in the
    top bar, the app icon "when you download the app". "Keep blue. Blue
    looks good... let the red be the accent... just a few places... maybe
    at the top bar... red line as a divider." "Save my context window and
    time. Focus our energy on something more important than color." To do
    right after Admin (112). Letterhead kept in the chat uploads.
    Done 2026-10-30: logo cut from the letterhead (web/public/logo.webp) in
    the sign in card, the lock screen ring, the top bar, the install cards
    and the install guide pictures; new app icons (192, 512, a maskable
    512 for Android, Apple 180); name "Rhema Medical Centre" in the tab,
    the installed app and the lock screen; red (#d9232d) only as a thin
    line under the top bar and under the name on the lock screen. The
    logo is cut from a 160 pixel copy, so it is slightly soft; a clean
    file from the hospital would make it sharp.
115. **Laboratory (build step 5).** (2026-10-30) "do the laboratory."
    Follows docs/DATABASE.md section 9 and requests 58 to 60. His answers
    to the say back (2026-10-30):
    - "Front desk usually add amount paid in naira not just tap paid and
      they also add mode of payment just like during registration."
    - "We can build the attach result infra now, also make sure that the
      attached files is usually compressed without affecting the quality
      of the document. PDF for a few pages is usually a few KBs."
    - "The results should just be part of the patient's record/med
      history, you only send a copy when a person requested for it so you
      send to the person/notify the person while recording it into the
      patients record simultaneously."
    Slice 1 built 2026-10-30 (request, payment, results, alert); all
    checks green on a throwaway Supabase. "Yes, run the lab SQL"
    (2026-10-30). Buckets rhema-files and rhema-files-testing made by him,
    the testing one deletes files after 7 days.
    Slice 1 LIVE 2026-10-30 (merge 2a5fdaa): testing and live databases
    took it, 0 warnings, all five checks passed; the real walk through
    passed on testing. Slice 2 (attached files) built 2026-10-30: photos
    shrunk in the phone to 2000 px WebP (a 3 MB printout photo became
    192 KB and stays readable), PDFs as they are, 10 MB at most; the
    Worker checks the Laboratory tick to store and the database to open.
    "Go on the slides too" (2026-10-30) read as "go on slice two". Slice 2 next: attached result files, compressed.
    Slice 2 LIVE 2026-10-30: all checks green on testing (one database
    start failure before any test, re-run once) and live.
94. **Backup to a second Cloudflare account.** "Use a second Cloudflare
    account for backup of the data they are putting in." Nightly copy of
    the database export and the files to R2 in a separate account.
    Done 2026-10-31: the first nightly backup ran on live and passed every
    step (copy, lock, upload, download, unlock, key tables present).
116. **Backup: second Cloudflare or encrypted Google Drive?** (2026-10-30)
    "Is it better we use an encrypted Google drive since it's 15gb... Or
    we can use GCP... I think we should just use Cloudflare now. That means
    I open another... Gmail account... so that I can open Cloudflare. Yeah?"
    Answered: second Cloudflare, with a new Gmail. Done 2026-10-31: bucket
    rhema-backup, an R2 key limited to that bucket (Object Read & Write
    only), and the four GitHub secrets. The nightly backup workflow
    (.github/workflows/backup.yml) is built.
    Done 2026-10-31: the first nightly backup ran on live and passed every
    step (copy, lock, upload, download, unlock, key tables present).
119. **Back up the lab result files too.** (Found 2026-10-31.) The
    nightly backup copies the database; the attached lab files in
    rhema-files are not copied yet. Needs one more key from the MAIN
    Cloudflare account: R2, Object Read only, bucket rhema-files. He is
    making it (2026-10-31). Only two secrets: FILES_R2_ACCESS_KEY_ID and
    FILES_R2_SECRET_ACCESS_KEY; the account ID is CLOUDFLARE_ACCOUNT_ID,
    already in GitHub (his point: "why do I have to submit it again").
    Done and live 2026-10-31.
120. **CI: the Supabase tool install stalls now and then** (3 times so
    far, 2026-10-30 and 31), always before any test runs. Fix the cause:
    a short time limit and one automatic retry on that step, so a stall
    fails in minutes, not 20. Built 2026-10-31: 3 minutes, then a second
    try, in ci.yml, db-testing.yml and db-live.yml.
    Done and live 2026-10-31.
117. **Top bar: only Call attention, then a menu button (three lines).**
    (2026-10-31) "On the home screen there at the top bar, we already have
    three buttons there. So why not only the call attention will be there,
    then by the right of it, hamburger menu icon." Behind the menu: Lock
    screen, Notifications, the installation guide ("call it guide or
    installation guide... later... inside that same installation guide,
    we'll put a manual... about each of the modules"), Sign out, and later
    the automations ("those messaging"). "Keeps it clean." Recorded; to be
    built after the backup. The manual comes when the modules are done.
    Done and live 2026-10-31. Notifications moved from the bottom bar into
    the menu. The user manual goes inside the installation guide later.
123a. **Pharmacy with drug payments.** (2026-10-31) "do pharmacy with drug
    payments now." "Let the app always work out the total... they should
    be able to type in their price." "It's a hospital, so the doctor
    prescribes." A doctor prescribes from the record and sends it to the
    Front Desk or straight to the Pharmacy; the Front Desk types a price
    per drug (and per lab test), the app and the database add them up;
    the Pharmacy taps Dispensed and the drugs join current medications.
    No stock counting. Done and live 2026-10-31.
124. **Menu button without the word "Menu", and a balanced desktop.**
    (2026-10-31, from the client's computer) "I don't think you really
    needed to write a menu on the iBurger menu... the interface is not well
    balanced on the desktop... Balance the interface for desktop properly."
    The menu button is the three lines only. On a desktop the logo sits
    above the left menu, and the name and the buttons line up with the
    page's own left and right edges; the page column is 1280px wide (was
    1100px), shared through --page-width. The drop down panels open under
    their buttons. Done and live 2026-10-31.
125. **Lock screen did not respond to a mouse click on a desktop.**
    (2026-10-31, on the client's computer) "after locking the screen, I
    tapped on the covered screen so I can enter the PIN but it's not
    responding... I thought clicking enter solves or just clicking the
    mouse." Cause: a click while the lock page was still loading was used
    up and the cover went away with no card. Now the cover stays until the
    card shows, and any key (Enter, a digit) opens the card too. Done and
    live 2026-10-31.
126. **Idle lock after 1 hour, not 10 minutes.** (2026-10-31) "extend the
    idle lock screen time to 1hr because of network connections, so they
    don't get locked unnecessarily when network is loading slowly." Done
    and live 2026-10-31. Lock screen from the menu still locks at once.
128a. **Files on the record, Register from old file, Download.**
    (2026-11-02) Scans, ultrasound results and documents on every record
    (Add scan or photo, Add PDF file; photos shrunk to WebP); Register from
    old file with name, phone, optional date of birth and sex, and the old
    file; Download asks Full medical history (print or Save as PDF) or
    Attachments only. Done and live 2026-11-02.
128b. **File preview, uploader delete, old file mark, raised button.**
    (2026-11-02) Preview inside the app; files on Edit patient for everybody
    who may see the patient; Delete only for the person who attached it, on
    old file patients, after a red warning; every opening logged; "From old
    file" mark; Register from old file as a raised 3D button. Live
    2026-11-02.
130. **Lab picker, Send also, attachment chooser, named downloads, exact
    status tags.** (2026-11-02) Live 2026-11-02.
129. **Call in tells the Front Desk.** (2026-11-02) A green Call patient
    card with a chime at every Front Desk, "Adaeze Okafor to Consultant
    Room 1", closes with X; the phone alert names the patient too; each
    kind of call has its own duplicate guard. Live 2026-11-02.
131. **Duplicate guard on every action.** (2026-11-02) One shared database
    guard: registration and every medical record entry, tapped twice, save
    once; a refused double registration shows the first patient. Live
    2026-11-02.
128c. **Family profile.** (2026-11-02) Family number (FAM-000012) given by
    the database; Add family member after saving a Family patient; find
    by FAM number; the profile shows the family and its members. Live
    2026-11-02.
128d. **Poor network.** (2026-11-02) Registration drafts, record entries
    that wait and send by themselves, a waiting-to-send pill, and a device
    copy of recent patients for Find patient. Live 2026-11-02.
123b. **Other payments with printable receipts.** (2026-11-02) Receipt
    numbers on every payment; Take payment on the profile; a printable
    receipt with the letterhead; today's receipt that grows; Print receipt
    after paying on Home. Live 2026-11-02. Email waits for Resend.
123c. **Messages and announcements.** (2026-11-02) Room to room and to
    groups, ticks like WhatsApp, a clock while waiting for the network, an
    unread bubble on Messages; announcements on Home until Got it; kept 1
    year, deleted nightly after the backup. Live 2026-11-02.
134-135. **Thorough layout check and click-through check.** (2026-11-02)
    In the screens skill; live fixes for what they found.
132. **Notifications with an unread bubble on the menu button.**
    (2026-11-02) Messages, announcements, lab results ready, and work
    waiting for each role, in whole sentences that open their place; a red
    bubble with the total on the menu button. Live 2026-11-02.

136. **Not findable online.** (2026-11-03) "this is an internal tool...
    It's not supposed to be a public internet... it's not something that
    you just discover online. Google doesn't need to discover it online.
    Crawlers are not supposed to be able to discover it." Live and checked 2026-11-03:
    robots.txt says Disallow for every crawler, and every page and answer
    carries "X-Robots-Tag: noindex, nofollow, noarchive, nosnippet".
    Keys (2026-11-03): no need to change the Supabase key at handover;
    "Is it not the same key you have been using? Why change it?" (Decided.)
    AWS uptime watcher: today, if his phone code arrives.

139. **Find patient on Register did not look like a button.** (2026-11-04)
    "It's almost not looking like a button. Somebody can mistake it and not
    know that that's a button." Live and checked 2026-11-04: now the same
    raised button as Register from old file, in the app's blue. Screenshots
    at 390, 820 and 1440; it opens Find patient; layout check passed on 25
    screens.

138. **FAULT, found 2026-11-04 by the top up: saving blood group,
    genotype or the antenatal details (Profile, in the record) fails, on
    testing and on live.** The activity log needs an id column, and
    medical_profiles has none (its key is patient_id), so every save is
    refused. No test ever saved a profile. Fix: one migration that makes
    private.write_activity() use patient_id when there is no id, plus a
    test. Waiting for his yes, because it is SQL on live.
    Live and checked 2026-11-04: migration 20261104043601_profile_activity_log on testing and live, 0 security warnings, test 019, 5 deliberate breaks all caught.

143. **A message appears at once when sent, and keeps trying without
    network.** (2026-11-04) "When you type message and you send, you should
    send immediately... Let it just at least appear in the chat before...
    it is being sent."
    Live and checked 2026-11-04: a sent message shows in about 160 ms with "Sending", the box empties at once, it gets its tick when saved; with no network it stays with the clock and sends by itself.

145. **Switching pages is slow to show data.** (2026-11-04) "switching from
    one of those page to another page, sometimes it's like there's a little
    bit of delay in loading data." Notifications took a few seconds to open.
    Live and checked 2026-11-04: Home, Messages, the Lab and Pharmacy cards, the chart and Notifications keep their last data in memory (lib/cache/memory.ts, emptied at sign out). With a 1.5 second network, a second visit showed in about 70 ms instead of about 1.9 seconds.

148. **FAULT: opening a notification goes to Home.** (2026-11-04) "I saw a
    notification, I clicked open. It took me back to the home page... you're
    not even supposed to be clicking open... just be clicking a maybe a drop
    down to review all the notification... fold it back, open the next
    one."
    Live and checked 2026-11-04: each notice is a fold; messages show with Reply, announcements with Got it, and the Lab and Pharmacy cards open inside the notice, so payment and dispensing happen there. Checked at 390 and 1280: nothing goes to Home.

141. **Payment at registration.** (2026-11-04) "Why is it that during
    registration there's no place where payment was mentioned? In the demo
    I gave you, I had payment... registration is like they are buying
    card... they used to pay some amount of money... even if they can still
    add payment later for something, but there's payments during
    registration."
    Live and checked 2026-11-04: an optional card fee and Cash, POS or Transfer at the end of Register patient; saved as a Registration card payment with its receipt; a failed fee can be saved again; Payments shows on Edit patient too. Checked with a fee, no fee, a wrong fee and a failed fee, at 390 wide.

146. **Patients seen chart on Home shows nothing.** (2026-11-04) "check it
    that it's working, because even now that we have demo data, the demo
    data does not even make it work." Checked 2026-11-04: the chart works;
    it counts finished visits, and the demo data has none. ops/testing-
    visits.sql adds a year of made up finished visits (tested locally:
    27 this week, 121 this month). Waiting for his yes to run it.
    Done 2026-11-04: the chart works; ops/testing-visits.sql ran on testing with his yes ("Visit history added: 540 finished visits").

140. **Moving a patient who is already in a room, and marking that they
    left.** (2026-11-04) "When a patient is also already in a room, you
    can't send the patient data to another room... a patient is in a
    laboratory, but doctor calls... there's no way for somebody to know
    that the patient left a particular room. Is there a way, like, okay,
    person has left, it marks the time the patient left? Or a patient who
    have been sent to consultant room 1 since 48 hours ago, it will still
    be showing consultant room 1. There has to be a way." He also settled:
    a doctor does not need the record sent; a doctor finds any registered
    patient and sees the updated record. Proposal sent 2026-11-04, waiting
    for his yes and his pick on old visits.
    Also 2026-11-04: show the SQL and wait before running it (the profile
    fix, 138).

142. **Chats scoped to departments, plus one general chat.** (2026-11-04)
    "people should see chats that is in their own department... it did not
    even put front desk... there should be a general chat that everybody in
    the hospital sees... if Matron started chatting nursing station, then
    the particular matron that was chatting nursing station is the only
    matron that sees that chat, apart from the nurses in the nursing
    stations... If it's all nursing station, then it's all. If it's nursing
    station one, then it's nursing station one... if you are not in that
    department, but you started a chat for that department... only you see
    what you are sending to that department with the department... If I
    click all consultants rooms, I will not see the chat [sent to
    Consultant Room 1]. I can only start a new chat."

144. **Edit a sent message.** (2026-11-04) "When you send a message and you
    want to edit it... in case you made a mistake... You hold on to the
    message and edit it."

147. **How a visit ends, at every room.** (2026-11-04) "can the consultant
    check the person out?... how do you know that consultant is done with a
    particular person? Is it when he calls the second person in?... Then
    what about pharmacy? What about laboratory?... Also check how others do
    it." Goes with 140.
    140, 142, 144, 147: Live and checked 2026-11-04: migrations 20261104061628_messages_general_tags_edits, 20261104061952_visit_endings and 20261104110430_message_edits_closed on testing and live, 0 security warnings, tests 020 to 022, 18 deliberate breaks all caught. Walked through at 390 and 1280: General first, Reply with its quote, @ offers the people of that room, Edit only on your own message, For you; Move to another room, Has left, Today on the patient. The nightly job ends open visits (backup.yml step 6c).

150. **Pitch a new client on the testing site: MASCAP.** (2026-11-04) "I
    want to use the same remote testing platform to pitch the client...
    the name of the hospital... is MASCAP... we hide the logo of Rema and
    the name, and just change it to MASCAP Medical Center... hide the logo
    and just put MA as the logo, just like we had ROH or Rema before...
    at the back of the hamburger menu, put automations there... the
    WhatsApp messaging stuff that we are going to automate, the birthday,
    happy birthday... put them as coming soon... it's just on the testing
    branch, so we can hide it later... anytime we want to pitch a new
    client, you hide the Rema stuff and put the name of the client."
    He will confirm "Medical Center" when he gets there.
    Later the same day: "Change name to LANA Medical Center. I have left
    mascap." So testing shows LANA Medical Centre, letters LA.
    Live and checked 2026-11-04: lib/brand/brand.ts holds the name and mark,
    ops/pitch.json picks the hospital shown on testing (live is always
    Rhema), scripts/brand-icons.cjs and pitch-brand.mjs make and place the
    icons, skill pitch-client. Shown as MASCAP, then LANA, then back to
    Rhema. Automations (11 coming soon) is in the menu on every build.

151. **FAULT (mine), found 2026-11-06: the nightly backup's housekeeping
    steps failed on 4 nights in a row (3, 4, 5 and 6 November).** The
    backup itself was saved and checked each night (copy, lock, upload,
    open, clear old copies all passed). The step "Delete messages older
    than a year", added 2026-11-02, passed the database address wrongly
    (`psql "$URL"` outside `sh -c`, so $URL was empty on the runner), so it
    failed in 0 seconds and the steps after it were skipped: "End
    yesterday's open visits" (added 2026-11-04, same mistake) and "Copy new
    lab result files". No data was lost: the lab files are still in the live
    store, and the copy is incremental, so the next good run catches up.
    Nobody noticed because I only watched push runs, never scheduled ones.
    Fix: both steps use `sh -c '...'` like the working backup step; proved
    with a pretend docker (before: exit 2, after: exit 0, and still fails
    loudly with no address). Ship skill step 9 now says to read the
    scheduled runs. Closes when a nightly run passes every step (next:
    2026-11-07). He may also say "run the backup now" to prove it sooner;
    that run would also close yesterday's open visits on live for the
    first time.
    DONE 2026-11-07: the nightly run of 7 November (run 42350271340)
    passed every step: backup checked, old messages, yesterday's open
    visits, lab files (0 live, all locked).

153. **Invitation email.** (2026-11-07) "You have to first of all work it.
    Let's do it that when you invite someone, the person needs to receive an
    invitation email. Fix that one first." (Item 13 of the 6 November list.)
    Built: Send invitation saves it, then the Worker (worker/src/invites.ts)
    checks as that admin that the invitation is waiting and emails it
    through Resend from no-reply@rhemamedical.app, with the sign in link.
    Needs: two sending-only Resend keys (his question 2026-11-07: one key
    or two? Two, like the SMTP keys): GitHub secrets RESEND_KEY_TESTING
    (Resend name rhema-worker-testing) and RESEND_KEY_LIVE
    (rhema-worker-live). The deploy hands each Worker its own.
    DONE 2026-11-07: he invited admin@ on testing, the email arrived in the
    inbox, admin@ signed in and invited a Front Desk. Live has its own key
    (deploy: "The Worker has its email key"). Also found and fixed with him:
    the Confirm signup email on testing and live still sent a link; he
    pasted the code wording; the daily check now guards both emails.

- 189, 196b, 196c, 196e, 196h, LIVE 2026-11-16: antenatal visits and client
  details; more starter medicines and mg doses; folded More details on Register
  from old file; four Home buttons with Announce in Messages; search on long
  pick lists. Checked on testing and live (CI, deploy smoke test, database).

- 205, LIVE 2026-11-16: the 8 test patients on live deleted with every record
  pointing at them, after a read only look and his confirmation. Checked after:
  0 patients, payments, visits and families on live.

- 208 to 214, LIVE 2026-11-16: lab prices with admin approval and 72 hours;
  Other saved for everybody; Widal significant titre heading; payment kinds
  with pickers; First registered and the old file month; vital sign lists;
  medicine box arrow; Medical record from the queue; Take payment only for the
  Front Desk; send paid work to the Lab and Pharmacy; pharmacy stock; note
  titles; lab corrections. Checked on testing and live each time.
- **217a, 217b (2026-11-16): Download our data, and the review of the day.**
  Admin, Data tab: PIN again, one ZIP with a spreadsheet for every table and
  every uploaded file, written in Activity. Every migration of the day is on
  both databases with 0 new warnings; the emailed record now shows note
  titles. Checked on testing and live.
- **217c, 218a to 218d (2026-11-16): the doctor's note and the medication
  chart, Next.js, and the backup check.** The four boxes with words to tap,
  medicines straight onto the chart, Send to the nurses; the chart with Given,
  last dose and next due; the summary and the plan banner; each role's work
  first. Next.js 16.4.5. The backup counts rows and files and fails if any is
  missing. Checked on testing and live.
- **219 and 220 (2026-11-17): the flow from other systems, and simpler picking.**
  Emergency, Urgent or Normal when sending a patient, emergencies first in the
  queue; Not given with a reason on the chart; lab values marked High or Low;
  Sample taken; Request lab beside the saved note; expiry dates, Running low
  and Expiring soon in the Pharmacy; medicines without a note; searches find
  only names that start with the letters. The backup timer on the hospital
  Worker. Checked on testing and live.
- **221 (2026-11-17): the medical record page.** The chart opens its lists in
  place, nothing scrolls away after a pick, every medicine is listed, Other is
  always in view, clearer fold arrows, compact summary. Light and dark checked.
- **222 (2026-11-17): bubbles clear once seen.** Work waiting still counts until
  done. Also confirmed: the backup timer starts the backup on time.
- **224 (2026-11-17): records with no network, ward sheets, consultation page.**
  Open visits kept scrambled on clinical devices and logged; the treatment and
  vital signs sheets like the ward's paper; the full-page consultation with Seen
  by; route; signed by; fewer background requests. Checked on testing and live.
- **225 (2026-11-17): sheets sign and time themselves.** Name and room from the
  person signed in, internet time, one running table per sheet, tidy Save and
  Cancel on every record form. Checked on testing and live.

229. **Consultants share patients; the matron as midwife.** (2026-11-20)
    "consultants in room one have started seeing a patient... if they come
    back for follow-up, consultants in room one is not around. Then
    consultant in room two continues the consultation... but cannot delete,
    cancel, or edit what consultant in room one has already done... is that
    okay? Or... consultant in room two will not be able to attend to that
    patient? What's your advice? I believe the first is better though...
    Same with consultant in room two, room three, or room four." And: "the
    consultant in room two tends to be the matron, who is also a midwife...
    we did not even put any column for midwife in the system, but I believe
    the database already trying to contain whatever the midwife needs as per
    pregnancy, antenatal patients." ASKED FOR ADVICE; answered in chat
    2026-11-20. Found in the code: any consultant in a consultation room can
    open the record and write (good), but can also Void another consultant's
    note, and Correct it in its first 15 minutes (consultation_update has no
    written_by check). Proposed: Void and Correct own notes only. The matron
    writes consultation notes only if her room is a consultation room;
    prescribing is doctors only (is_doctor); antenatal booking, visits,
    tests and consent are open to every clinical role. Waiting for his
    answer.
    DECIDED 2026-11-20: "let each consultant only be able to cancel or void
    their own consultation... they'll be able to continue consultation,
    they'll be able to read the conversation, but they cannot edit, cancel,
    correct, or void another. They can only void their own or correct their
    own." Matron: "Except she's a doctor, she normally cannot prescribe drug.
    But I'll ask them... in the computer, she's not supposed to be allowed to
    prescribe drugs." So no change for the matron; he will ask the hospital.
    BUILT 2026-11-20: migration 20261120040440 (consultation_update: the
    writer or the signer only), test 059, 4 breaks caught; Void and Correct
    show only on the consultant's own notes. HIS YES ON THE SQL, 2026-11-20.
    LIVE 2026-11-20: 0 security warnings on testing and live; smoke tests
    green. (CI on testing first caught a broken test file, fixed.)

228. **Front desk: payments that expire, the family file first, Take vitals;
    Given fills the nursing sheet.** (2026-11-19, in a new session; "I don't
    want you to do any tasks that the other agent was doing before.")
    a. Expiry: "a payment that has not been taken maybe after 24 hours. I
       want it to expire and clean off by itself, since front desk did not
       take that payment, because the person who was in session have left."
    b. Family file first: "when you choose a family, you just fill in the
       first details of that family... their family name, which is the
       surname only... the system will automatically enter the date that
       family was created... Then the family's own address... which include
       the state and whatever. Then below it, you now see add family
       member. So the system must insist, after you create that family...
       that you add at least one family member... the full name of the
       person. Let's say Lillian James... date of birth, all those stuff...
       family would keep its category just the way it is, but the
       information that is entered at first is shorter and it's not a
       personal individual information." (This replaces "No family last
       name needed", 2026-11-02.)
    c. Take vitals for the Front Desk: "front desk used to enter vital signs
       too... front desk will only see edit details button and sometimes
       take payments. I want you to add a button where it says take vitals.
       That take vitals is the same vital that will populate the vitals that
       is inside of the medical record... so doctor can see the vitals that
       the front desk has taken."
    d. Given fills the nursing sheet: "once the nurse click on given... it
       automatically populates that nursing chart there. So the nurse does
       not have to manually come and type in the treatment... Same thing
       with vitals." Checked in the code 2026-11-19: already so. Given on the
       medication chart and the dose form write medications_given, which the
       treatment sheet lists; vital signs on the record write vital_signs,
       which the vital signs sheet lists. Asked him to check on testing.
    Said back 2026-11-19. HIS YES TO ALL, 2026-11-19: "yes to all, start
    with take vitals". Order: c, then a, then b.
    a DECIDED: "If the drug is already given, show it as a payment that is
       owed. If it is not given, expire it and grey it out. That they did
       not pay, that's why they were not given." 24 hours. Not deleted.
    b DECIDED: Register from old file works the same way. "restructure the
       category... at the top left corner, show a drop down of category...
       before they even start filling anything... individual followed by
       family followed by antenatal." Family: the surname is compulsory, the
       address is important, the time is marked by the system on save; a
       phone number under the address, not compulsory; only fields that can
       belong to a family. "personal information like birthday and next of
       kin and other stuff only shows when they click add family member."
    c DECIDED: Take vitals as said back: the Front Desk adds vital signs
       only, into the same vital signs in the record, and never opens the
       medical record.
    c BUILT 2026-11-19: Take vitals on the patient's details (TakeVitals.tsx),
       migration 20261119132802 (Front Desk adds readings in its own name,
       reads back only its own, cannot void), test 057, 6 breaks caught.
       HIS YES ON THE SQL, 2026-11-19. LIVE 2026-11-19: CI, deploy and smoke
       test green on testing and live; 0 security warnings on both.
    a BUILT 2026-11-19: migration 20261119211756 (expire_unpaid, run by the
       lists as they load; the database refuses to pay, dispense, take a
       sample or record a result for one due to expire), test 058, 9 breaks
       tried (2 conditions that only repeated the status check removed; the
       anon grant break is still refused by the inner function). Record
       shows "Expired, not paid" in grey; cards say "Owed: already given, not
       paid yet."
    a DECIDED 2026-11-20: 72 hours, not 24 ("what in case the person now said
       they don't have money... they come back 2 days later?"). Migration
       renamed 20261119211756_unpaid_expire_after_72_hours (never run
       anywhere before). HIS YES ON THE SQL, 2026-11-20: "you can now go ahead
       and run the SQL".
       LIVE 2026-11-20: CI, deploy and smoke test green on testing and live;
       0 security warnings on both.
    NEXT: b (family file first).
    b PLAN SAID BACK 2026-11-20 (category drop down first; Family details
       card: surname compulsory, phone optional, address, town, LGA, state,
       date by the system; Add family member opens the member form with the
       family address filled in; family and first member saved together;
       old file the same). HIS ANSWER 2026-11-20: "There should be a way to
       edit the family address... a family carries its family number.
       Individuals from that family carries fam, then individual number as
       designed today already. Then the family name on its own carries only
       family number. So when somebody types family, the family name, they
       can click on the family name and they will see all the members of the
       family lined up... if somebody is added to a family, the person does
       not need to pay for card again. The card for the family covers
       everybody in that family. That's how they run today."
    b BUILT 2026-11-20: migration 20261120072145 (families get phone and
       address; register_family saves the family and its first member in
       one step, Front Desk only, with its own 30 second double tap guard;
       families insert and update narrowed to the Front Desk), test 060, 8
       breaks caught. Screens: category drop down first on Register and
       Register from old file; Family details card then Add family member;
       "Family registered" with the FAM number and date; no card fee for a
       member added later; Family card shows the family's details with Edit
       family details; Find patient shows families by name, tap to line up
       the members. Screen checks now pick a drop down option too
       (mock.cjs pressFirst, used by all four checks). HIS YES ON THE SQL,
       2026-11-20.
    b DECIDED 2026-11-20: a member who changes category keeps the family
       link (their own card and card fee, still listed in the family): "someone
       who is part of the family can come and change their category to
       antenatal... they are still part of that family... I think you should
       confirm that and leave it that way." Numbers stay: FAM for the family,
       RMC for each member.
    "do not take any job that the other agent was doing before... make sure
    the security of the platform is kept intact." Repository stays public
    for now (GitHub cost); private at the end.
    228b LIVE 2026-11-20: CI (with the new family steps in the real
    walk-through), deploy and smoke test green on testing and live; 0
    security warnings on both. ALL OF 228 AND 229 LIVE AND CHECKED.

233. **Where prescriptions and lab requests go.** (2026-11-20) "you can
    either send a medicine straight to the front desk only, or you send both
    to the front desk and the pharmacist. When it comes to lab tests, you
    either send to the front desk only, or you send both to the lab and the
    front desk... There's no time you will send to lab or pharmacy, straight
    to lab or straight to pharmacy without it sending to front desk... What
    is sent to only the front desk, the pharmacist will not get any
    notification. But if they search the patient and see, they will see...
    something that is waiting... to be dispensed or carried out as a test.
    But if it was sent to them, they will see the notification... if it's
    sent to only front desk... Once the front desk click take payment...
    The system automatically just sends it to lab... Same with pharmacy. But
    if it was sent to both sides, then the system only updates the pharmacy
    of the payment as well as lab of the payment." CHECKED 2026-11-20: today the choices are "Pharmacy and
    Front Desk (payment)" and "Straight to the pharmacy" (lab the same), plus
    "Also send to..." after sending. Pharmacy: front-desk-only already
    reaches the Pharmacy's list on payment (status awaiting_dispense).
    Lab: every request shows on the Lab's list at once, paid or not (no
    front-desk-only for the lab yet). Notifications count unpaid work for
    neither. The Pharmacy has no patient search for drugs; the Lab's Find a
    patient's tests shows paid ones only. Said back.
    HIS YES 2026-11-20: "Straight to the pharmacy or straight to lab goes
    away... Front desk only. The test will reach the lab when front desk has
    taken money... front desk and pharmacy, let it be the default."
    BUILT: migration 20261120143627 (lab_requests.sent_to_lab; request_lab
    takes front_desk or both, an older screen's laboratory counts as both;
    every new request waits for payment), test 063, test 009 section 8 now
    checks the new rule, 3 breaks caught. Screens: Front Desk and Pharmacy /
    Front Desk only (and the same for the Lab), default both; the Lab's list
    and notices hold what was sent to it or is paid; the Pharmacy's notices
    the same; Drugs to give on the patient's page for the Pharmacy; Find a
    patient's tests shows unpaid ones. HIS YES ON THE SQL, 2026-11-20.

232. **Dispense and test before payment; the options; drafts never lost.**
    (2026-11-20) Yes to the families SQL and the Pharmacy fix. "I want to
    confirm that the lab and the pharmacy can dispense medicine or take a
    lab test, even if someone has not paid... it is showing waiting for
    payment to them, but there's the button to dispense... can still be
    clicked... the lab, the same thing... finished the test, even if
    payment has not been made... for emergency case... already an
    inpatient that was admitted, so that there will be no obstruction as
    to payment... money that has not been paid... will always remind the
    front desk... It's only the one that has not been paid that disappears
    after 24 hours. The one that has not been dispensed or carried out."
    (The limit is 72 hours since his choice of 2026-11-20.) "So I just want
    to confirm that that's how it is now currently."
    On 230 a to d: "all of them are good... the device they are using, the
    CPU is 2 gig RAM, the desktop... do it in a way that... their system is
    still able to carry it... let's not keep so many drafts, because what
    if that person's system crashes and network never came online and some
    things just wipe, or the person logs out?... if it's possible that even
    if the person logs out, they didn't lose those drafts... what about if
    the computer they are using, something happens to it? So the drafts...
    should load into the system within the next 5 minutes or something like
    that. The system should try it until it's uploaded to the database."
    LIVE 2026-11-20: families details only and the full Pharmacy list (0
    security warnings on testing and live).
    CHECKED 2026-11-20: NOT as he thought. One sent to the Front Desk first
    (waiting for payment) could not be dispensed, sampled or tested until
    paid (dispense_prescription, mark_sample_taken, record_lab_results,
    add_lab_result answered not_paid; the buttons were hidden). Only one sent
    straight to the Pharmacy or Lab could. The owed and 72 hour parts were
    already as he says. BUILT: migration 20261120130854 (all four allow
    waiting for payment; cancelled still refused), test 062, tests 009, 010,
    013 and 047 now check the new rule (each in a block that undoes itself),
    6 breaks caught; screens show "Not paid yet" with Dispensed, Sample taken
    and Enter results. HIS YES ON THE SQL, 2026-11-20.
    DECIDED 2026-11-20 on 230: (a) and (b) yes. (d): only what was SAVED with
    no network must never be lost and must keep trying until it reaches the
    database (already so; add a new family). Drafts typed but not saved stay
    as they are: 30 minutes, wiped at sign out, never into the record ("let
    it expire... if the computer turns off... no problem, since they didn't
    save it"). No server copy of drafts. (c) yes: "7 days for both doctors
    and nurses, and it should be their own room... light, scrambled, and
    then it should wipe out as they log out."
    232 LIVE 2026-11-20 (0 security warnings on testing and live).
    230a BUILT 2026-11-20: web/public/_headers keeps /_next/static for a year
    (immutable; the names carry fingerprints). No SQL.
    230a LIVE 2026-11-20.
    230b BUILT 2026-11-20 (no SQL): lib/warm/warm.ts loads Messages (6 s after
    the app opens) and History for the period it opens on (6 s later), in
    memory only, once per person; Notifications were already loaded by the
    menu bubble. Measured: Messages opened in 0.1 s after.
    230d BUILT 2026-11-20 (no SQL): a new family saved with no network waits on
    the device (outbox kind family) and is sent by itself, checked first so
    it is never saved twice. Register from old file still asks to try again
    (its files need the network). Drafts unchanged, as he decided.
    230b and 230d LIVE 2026-11-20.
    230c BUILT 2026-11-20: migration 20261120162058 (copy_room_visits: the
    patients seen in my own room in the last 7 days or still open there,
    newest first, at most 50, logged as before), test 064, 9 breaks tried (1
    repeat check removed); recordCopy.ts calls it; Privacy Policy section 6
    says so (LEGAL_UPDATED 20 November). HIS YES ON THE SQL, 2026-11-21. LIVE 2026-11-21.

231. **The Pharmacy sees only a few medicines; add a strength or a size.**
    (2026-11-20, with 4 photos of the hospital's handwritten drug lists, the
    same ones given to the other agent for 227i) "the pharmacy is saying
    that the drugs, they are not enough, they are not complete... There is
    not enough medicine to choose from in the medicine list for the
    pharmacist... I want the pharmacist to be able to see the list of all
    the medicine that has been added into the system. But there are just a
    few they are seeing, the supplies and all of those. So I'll need you to
    check that." And: "on that row for a medicine that has been added
    already, put a row that says add strength... cimetidine might have 400
    milligram, 200 milligram... add another strength... Same thing with
    supplies too... there may be like 5 sizes in the system currently, and
    they want to add an additional size. They should be able to add."
    (Earlier platforms he named for the lists: Swift Practice, Bama in
    India, Epic in the United States, open repositories.)
    FOUND 2026-11-20: every medicine on his 4 photos is already on the list
    (some under another name: Augmentin, Cotrimoxazole for Septrin,
    Cafergot, Vitamin C, Chlorpheniramine; cimetidine 200 and 400 mg;
    syringes in 6 sizes). The cause: the Pharmacy's list showed only the
    first 60 names until something was typed. BUILT (no SQL): every name
    shows, with the count; "+ Add another strength" (supplies: "+ Add
    another size") under each name, using add_medicine; the list is read
    1,000 rows at a time (Supabase answers at most 1,000), so it never stops
    short as it grows. His yes 2026-11-20; shipping with the families SQL.

230. **Run through everything; instant loading; drafts with no network.**
    (2026-11-20) "run through everything that you did. Ensure that nothing
    got broken... the app loads well. There's no lagging, and all the
    security is intact. There are no loopholes... they align very well on
    the screen... tablets, portrait tablet, portrait mobile phone, landscape
    tablet, desktop... The app still loads really fast, even with the
    smallest amount of network. And once it loads, data of the previous 7
    days or people actively being attended to for the past 7 days are
    loaded, including medical records, including history section... before
    a person opens any button, at the background, many of the next sections
    loads down. So once they click find patient... all the category of
    patients that have been active in the past 7 days... are already
    loaded. When they click on messages, any recent messages... from the
    past 7 days... history... majority of the things still saves as draft
    and loads underneath when there is no network, when they click save
    button... doctor is typing a medicine, but he did not save. It goes back,
    it saves as draft, and after a while it shows it to him. So either
    continue or delete."
    REVIEW DONE 2026-11-20: all 61 database tests, verify, layout (55
    screens at 320 to 1440), readability (light and dark), can-be-seen (88),
    click-through (no button broke a page), npm audit (0 high; 1 moderate in
    the lint tools only, never shipped: left for the other agent's list).
    Code size: first visit 871 KB at the start of the session, 873 KB now.
    Fixed: the payment lists waited for the expiry (now together, withExpiry).
    Found and fixed (SQL waiting for his yes): a signed in person could
    change any column of a family or add an empty family directly
    (20261120082841_families_details_only, test 061; test 016 accepts the
    stronger refusal). HIS YES ON THE SQL, 2026-11-20.
    FOUND, PROPOSED, WAITING: (a) app files are not kept by the browser
    between opens (no long cache header on /_next/static), so every open
    asks again; poor 3G: sign in screen ready in about 20 s; (b) warm up
    messages, notifications, history and the role's lists in memory after
    Home; (c) records of patients seen in the last 7 days on the device for
    doctors and nurses (today: open visits only; NDPA decision); (d) drafts
    on Take vitals, the registration forms, Edit details and antenatal
    forms; a new family waiting on the device with no network.
    ALL OF 230 TO 233 LIVE AND CHECKED (2026-11-20 and 21): 0 security
    warnings on testing and live each time. Left for later, not asked: the
    moderate npm audit warning in the lint tools (never shipped).

234. **Update the style checker (moderate npm audit warning).** (2026-11-21)
    "update it". The warning: minimatch, inside typescript-eslint (the lint
    tools), can be slowed by a crafted pattern. Never shipped to devices.
    DONE 2026-11-21: npm audit fix moved only the lint packages
    (typescript-eslint 8.72.1 to 8.73.0, its minimatch 10.2.6 to 11.0.9 and
    3 small helpers); npm audit 0 problems, worker 0; verify green, the same
    9 old lint notes.
    LIVE 2026-11-21: CI, deploy and smoke test green on testing and live.

235. **The director's voice note: blood glucose in vital signs; bills from the
    consulting room.** (2026-11-21, transcribed voice note from the director,
    then Anthony's reading of it.) Director: "the vital sign... there's no
    blood glucose... especially for emergency patient. Blood glucose... can be
    fasting or random... when you click it, it should show whether... fasting
    when the patient has not eaten or random. And the result, write the
    result... that place where they calculate B[ill]... has to be available in
    my computer, my consulting... the B[ill] for each of the drug... That is
    not in my computer... there should be some place for additional B[ill]...
    a patient will be charged even though they did not buy drugs... when they
    do a procedure... to pass catheter... including surgery. Sometimes
    including consultation fee... bed fee, all those things." Anthony: check
    for other missing vital signs too, so nurses pick, not type; the doctor
    (and the matron) decide prices: in the prescription and the lab request,
    a price per drug or test, the total worked out, and the Front Desk
    collects that amount; a bill for procedures and other things (operation,
    catheter, bed fee); consultation and card fees are standard and could be
    set by the admin in Settings; "even the nurses can also write a bill...
    for this particular hospital, it's usually the matron and the doctor,
    the director, that decide price." "just let me know if you understand
    this whole thing." Said back 2026-11-21 ("BMI" and "B" in the transcript
    read as "bill"): 1 blood glucose (Fasting or Random, then the result),
    BMI worked out, pain score; 2 a price per drug and per test in the
    prescription and lab request, total shown, the Front Desk collects it;
    3 Add a bill (procedure, operation, bed fee...) to the Front Desk as
    Bills to pay, never expires. Asked: glucose unit, more vital signs, who
    sets prices (doctors and matron, nurses?), may the Front Desk change a
    doctor's price, drugs on the price list.
    HIS ANSWERS 2026-11-21 ("I like your suggestions so far. They are all
    good."): blood glucose "is supposed to be like one of the first things";
    units: "offer both... check what many... used in Nigeria. And we always
    use the UK standard"; BMI and pain score yes, "it can't be too much...
    they are not compulsory... they don't block submission". Prices: "only
    doctors and matron that sets prices"; if anybody else, "the pharmacy and
    the lab, the people that actually carry out this test and dispense the
    drugs"; "The front desk cannot change the price... can go and ask the
    doctor". Standard prices fill in, "doctor can still clear it and put
    their own price... the system should probably record that price in case
    of next time... so that particular consultant can use it again."
    Order: 1 vital signs, 2 prices in prescription and lab, 3 bills.
    1 BUILT 2026-11-21: migration 20261121222211 (vital_signs blood_glucose,
    glucose_unit mmol/L or mg/dL, glucose_when fasting or random, pain_score
    0 to 10; all optional; a glucose needs both), test 065, 7 breaks caught.
    Screens: Blood glucose first on the record form and Take vitals (Fasting
    or Random, mmol/L first, then the result), Pain, BMI worked out; shown in
    both units; the sheet has Glucose and Pain columns; the summary shows
    glucose first. HIS YES ON THE SQL, 2026-11-22 ("bumpy [BMI] please double
    check... the button is well fitted"): BMI checked at 320 to 1440, also
    live on Take vitals, rounding fixed (31.25 to 31.3); buttons 36 px, inside.
    1 LIVE 2026-11-22: 0 security warnings on testing and live; click-through
    960 buttons, none broke. NEXT: 2 prices in the prescription and lab.
    2026-11-22 "go on with part 2". And, to do LAST: "for the weight and height,
    if possible you can add Unit conversion... some people put their units in
    feet for the height... what about people who measure in pounds?... easy
    conversion... not with clutter... choose this type of unit, that type of
    unit... still getting the exact conversion in centimeter and in kilogram
    as well. And you're still getting your BMI correct... take it gradually."
    BMI made easy to see 2026-11-22 (he could not find it): right under Weight
    and Height, bold on light blue. LIVE.
    2 BUILT 2026-11-22: migration 20261122051713 (prescription_items.price,
    lab_requests.prices, my_prices for each person's last price, sets_prices
    doctor or matron, check_set_prices: the Front Desk pays the doctor's
    price or the payment is refused; the one-total lab payment refuses a
    priced request), test 066, 11 breaks caught. Screens: Price per drug and
    per test (doctor; matron for tests), the last price fills in, the total
    shows; the Front Desk sees it locked, "Set by the doctor". NOT SHIPPED:
    waiting for his yes on the SQL, and his answer on standard prices (236).
    HIS YES 2026-11-22: "run the SQL"; "your suggestion on standard pricing is
    good" (after Send, "Make these the standard prices?" with a tick per
    line, Make standard / Not now; drugs and procedures on the price list;
    doctors and the matron set standard prices). Other vital sign plan: not
    answered yet.
    Also fixed 2026-11-22: the Front Desk's payment form spilled past the edge
    at 320 and 360 wide (found by a new check that opens Take payment on Home).
    2 and 237 LIVE 2026-11-22: 0 security warnings on testing and live;
    click-through 979 buttons, none broke. NEXT: 2b standard prices.
    2b BUILT 2026-11-22: migration 20261122154048 (price_list holds drugs;
    set_price takes drugs; make_standard_prices for a doctor, the matron or
    an admin), test 067, 5 breaks caught. Screens: the standard price fills
    in first, else the person's last; after Send, "Make these the standard
    prices?" (a tick each, Make standard / Not now) for prices new or not the
    standard; the admin's Prices tab has Drug prices. HIS YES ON THE SQL,
    2026-11-22, and yes to the clearer Other vital sign (jump to the new box;
    from the second time, the numbers typed before to pick).
    2b LIVE 2026-11-22 (0 security warnings; 981 buttons pressed, none broke).
    Other vital sign BUILT 2026-11-22: "+ Other vital sign" jumps to the new
    box and puts the cursor in it; once a number has been saved for that sign,
    the box offers the numbers typed before plus "Other..." (kept on the
    device, numbers only, 30 at most). No SQL. LIVE 2026-11-22: CI, deploy
    and smoke test green on testing and live; click-through, none broke.
    NEXT: part 3, Add a bill (SQL batch shown to him, waiting for his yes).
    HIS ANSWER 2026-11-22 on who sees bills: "let everyone see the bill" (all
    staff roles, not only doctors, matron, Front Desk and admin). Batch
    updated and shown again. HIS YES 2026-11-22: "yes". Building now.
    Adding a bill uses the same rule as setting prices (sets_prices), so any
    change to who sets prices covers bills too.
    BUILT 2026-11-22: migration 20261122204301_bills (bills, bill_lines,
    add_bill, pay_bill, void_bill; "procedure" on the price list and own
    prices; payment kind "bill"), test 068, 11 breaks caught. Screens: Add a
    bill on the record (doctor, matron) opens /bills/add/; Bills to pay on
    the Front Desk's Home; Bills on every patient's page for all staff, Take
    payment (locked amounts) for the Front Desk, Cancel bill for its maker;
    admin Prices tab has "Procedure and bill prices". Note: changes are in
    the activity log; reads of bills are not logged one by one (the same as
    lab requests and prescriptions). Told him.
    LIVE 2026-11-22: 0 security warnings on testing and live; smoke tests
    passed; click-through none broke. NEXT: 238 (lab price, doctor approves),
    once he answers the two open questions.
    MOVED TO DONE 2026-11-24: live and checked again in the full review (request 244).

236. **Other vital sign needs a number; check every "Other"; prices become
    standard.** (2026-11-22, with a photo of Other vital sign) "for add vital
    sign... you can only add the name and the unit, no place to put a
    number... or is it that the system automatically understands... once
    there's a unit attached, the system can populate it with number[s]
    people can pick from while still keeping the 'other' button... confirm
    how this works and... cross check other places where the provision to
    enter other things not included like the medicine list or the test list
    if the fields provided are well calculated to take in the values." And:
    "if the doctor or matron enters a price for medicine or test or any
    procedure, once they press save, show them a dialogue button to make the
    price a standard price... the price field will have its own save
    button... it sticks. Can also decide to edit the price... put a new
    standard price... do a proper arrangement so no clutter and so it's easy
    to understand by any one."
    MOVED TO DONE 2026-11-24: live and checked again in the full review (request 244).

237. **"Completed" as a reason to stop a medicine.** (2026-11-22, the director,
    with a photo of "Why suspend Normal saline?") "All these place for drugs
    that if you want to stop or edit or suspend, I will be asking you for the
    reason. One of the reasons you should put there is completed. When the
    treatment is completed, you stop it... Doctor said so... not needed now...
    you may not change it, just put completed as one of the options."
    BUILT 2026-11-22: "Completed" first among the reasons to suspend or stop a
    medicine (Medications.tsx; Edit asks no reason). No SQL.
    MOVED TO DONE 2026-11-24: live and checked again in the full review (request 244).

239. **A set price is a suggestion; the Front Desk can change it.**
    (2026-11-22) Same words as above. This reverses 235's "The front desk
    cannot change the price" for drugs, lab tests and bills: the doctor's
    price fills in, the Front Desk can change it before taking payment.
    SQL batch shown to him. HIS YES 2026-11-23: "Yes".
    BUILT 2026-11-23: migration 20261123082024_set_price_is_a_suggestion
    (no price check when paying drugs or tests; the one-total lab payment
    takes a priced request; pay_bill takes the typed lines; the price check
    function removed), test 069, tests 066 and 068 brought to the new rule,
    7 breaks caught. Screens: "Doctor's price" under the box, the box can be
    changed, on drugs, lab tests and bills.
    LIVE 2026-11-23: 0 security warnings on testing and live; smoke tests
    passed; click-through none broke. NEXT: 238 (lab price; the Front Desk
    does not wait).
    MOVED TO DONE 2026-11-24: live and checked again in the full review (request 244).

241. **Anybody in a consulting room does everything a doctor does; the
    matron cannot prescribe today.** (2026-11-23) "I noticed that the matron
    does not have access to prescribed drugs. She needs the prescription
    access. I said that anybody with a consultant room must be able to
    prescribe, must be able to write consultant notes. Everything that the
    doctor will do, as long as they are assigned to consultant room, you
    should be able to do that... So everybody with a consultant room can do
    everything that a consultant can do, right?" (This replaces the
    2026-11-20 note "in the computer, she's not supposed to be allowed to
    prescribe drugs".) FOUND: prescribing and "also send to the Pharmacy"
    check the doctor role only (private.is_doctor); prices and bills check
    doctor or matron by role; the screens check role === 'doctor'.
    Consultation notes already go by the consulting room.
    BUILT 2026-11-23 (on claude/front-desk-228 only, not on testing):
    migration 20261123192759 (is_doctor and sets_prices also count a
    consulting room, with medical access), test 070, 7 breaks caught; the
    screens use actsAsDoctor and setsPrices (lib/auth/roles.ts). SQL batch
    shown. HIS YES 2026-11-23: "show me the SQL ba[tch], and let's run it."
    Midwife role: "there's no need to add it. Just leave it." Antenatal:
    "I don't think anything is missing... I'll let you know when I meet
    with the midwife again." 
    LIVE 2026-11-23: 0 security warnings on testing and live; smoke tests
    passed; click-through none broke (first run had no local site; run
    again).
    Also: "there are certain things that the matron is able to chart, the
    midwife is able to chart, that are not included... check it again"
    (antenatal: palpation and the rest). FOUND: request 189's visit table is
    live (fundus, presentation, position, FHR, urine, BP, pulse, breathing,
    weight, Hb, oedema, drugs given, remark, examiner, return date), and the
    booking, tests and consent; any clinical role can write them. Asked him
    which items are missing.
    And: "I'm even thinking if midwife should be a role... currently the
    midwives take the nurses role." (Asked for an opinion.)
    MOVED TO DONE 2026-11-24: live and checked again in the full review (request 244).

246. **The antenatal visit chart: pick, do not type, and nothing twice.**
    (2026-11-24, with a photo of the paper ANTI-NATAL RECORD and a
    handwritten list of antenatal drugs) "height of fundus... give them
    options to pick from and Other... between 1 to 42 or thereabout...
    foetal heart rate... between 50 to 200 or thereabout... verify that
    online." "Drugs given... when nurses click given under medication
    charts, the medications that nurses gave... they should be able to
    click on the medicine." "Something they filled inside vital signs
    should automatically appear inside the section for the antenatal
    patient, so that they don't have to repeat it." "Make sure that
    everything is represented as I sent it to you." "They gave me a list
    of drugs here, but you can also check online... and add." "Other...
    the system takes that option... standard for the next time." "Do not
    bother about what I've been working on with the other agents."
    Today (checked): the visit form exists (AntenatalVisits.tsx) with
    every column on his card, but fundus, foetal heart, BP, pulse,
    respiration, weight and Hb are typed, and drugs given are 7 fixed
    chips. His yes 2026-11-24: "the plan is okay"; drugs given "just make
    it a drop down... select the drug by typing the name... Other is also
    there"; "If any medicine is not on the pharmacy list yet, include it."
    Built: every number picked from a list (fundus 12 to 42, foetal heart
    50 to 200 starting at 140, Hb 4 to 18), today's vital signs fill BP,
    pulse, respiration and weight, doses ticked Given since the last visit
    are already chosen, drugs from the medicine list drop down with Other.
    His yes to the SQL 2026-11-24: "yes, go on... if there are others that
    were not added, you could have still added... the milligrams, don't
    guess that much... verify some of them online." Migration
    20261124172708_antenatal_drug_list_2026_11_24 adds 19 lines: the
    midwives' list plus common antenatal haematinics; a strength only where
    the list or a check online gave it. Then live by section 9.
    LIVE 2026-11-24: screen and the 19 drugs on testing and live, CI, both
    deploys and both database runs green; used in a browser at phone and
    desktop widths (filled in, saved, every value in the saved visit).

248. **Check the whole antenatal card works and saves, live.** (2026-11-25)
    "Please check the system very well. Make sure that the antenatal...
    you correctly built everything. Cross-check everything. Make sure it's
    now live and everything is working well. Test it yourself. Save the
    detail after entering it for the antenatal visit, because the matron
    complained that she couldn't save some details... Make sure no step is
    missing. Take your time."
    Checked 2026-11-25 against a real local Supabase (every migration), as
    a made up matron: every part of the card saved and survived a refresh
    (visit, About her, history, delivery documented, next of kin, routine
    test, previous pregnancy, last period, consent). Faults found and fixed:
    (1) a record left open over 12 hours: the database refuses the save
    (the opening rule), but the booking and profile showed "Saved" while
    nothing was written, and a visit said "try again", which never works.
    Now both say "Not saved: this record was opened more than 12 hours
    ago. Go back to the patient, open the record again, then save."
    (2) foetal heart list went down to 50; the database takes 60 to 220.
    (3) a decimal in a whole number box, an empty visit, a future date, a
    one letter witness, gravida or para over 30: refused without saying
    which; now named on the screen before saving. Not changed (his design,
    ask first): opening the record again by itself when a save meets an
    old opening. Most likely what the matron met: (1), or before 2026-11-24
    a typed number the database refused (BP typed as 120/80 became 12080).
    Live logs would say which; reading them needs his yes.
    LIVE 2026-11-25: CI, testing and live deploys green; the live record
    page carries the new words; layout, contrast, visibility and
    click-through checks passed; walk-through 25 of 25 and error checks 7
    of 7 against a real local Supabase.
    Follow up, LIVE 2026-11-25: his yes, "allow them to continue even
    after the 12 hours... the integrity of data is still solid." A save
    that meets an old opening writes a new opening to the log and saves;
    a screen past 12 hours keeps what it read and says it stopped
    updating; offline entries do the same. Live error log (his yes): a
    booking save refused for the number of abortions (24 Nov) and a BP
    top refused twice (25 Nov); both now named before saving. Checked
    against a real local Supabase: 13 hours of steady use, details and a
    visit saved, the opening in the log, void before and after.

252. **Keep the data trustworthy: send staff to open the record again, and
    show wrong values in red.** (2026-11-26) "We want to only do the things
    that will keep the data trustworthy... if it is to only redirect the
    page, the staff to go over it again, that will make it better, then do
    it that way... make sure there's no error. And then if the system
    refuses to save [a] number... the system should name it and show them
    in red so they make their corrections... I think it should work that
    way in other places where wrong values are entered." So: undo the save
    that opens the record again by itself (live since 2026-11-25); a save
    after 12 hours is not saved and the screen sends them to open the
    record again; every box with a wrong value is named and shown in red.
    Built 2026-11-26: the automatic reopening is undone (offline entries
    too); a refused save says "Not saved" and the record shows "Open the
    record again" at the top. Red boxes with the words under the form on:
    antenatal visit, booking details, tests, pregnancies, consent, profile,
    vital signs (record, sheet, Front Desk), medicine course, payments,
    bills, prices (Front Desk, lab list), Request lab, Prescribe, pharmacy
    stock. One red style for all (app/globals.css).
    LIVE 2026-11-26: CI, testing and live deploys green; the live code
    carries the new words; layout, contrast, visibility and click-through
    passed; the sign in walk (Cancel, Send anyway, both payments) passed
    locally and in CI.

251. **Warn before the same test (or drug) is asked for, or paid, twice.**
    (2026-11-26) "I think you should do number two a warning... if it's
    going to take a lot of context... handover to the other agent to
    continue... if requesting for the exact same test for the exact same
    patient then [a warning] shows so they don't request for the test
    twice... I'm not sure the patient paid twice... maybe the front desk
    had to tap [it] twice because they requested [it] twice... [only] one
    result... we entered so... treat duplication for that area as well...
    the system shows [a] warning and then give them a key to continue
    anyway or cancel. I don't even know what language to use." On the
    ₦8,000 found in 249: "when I discussed with them, I will know what to
    do" (his to settle; nothing to change on live). HANDED OVER to the other
    agent: full spec in docs/HANDOVER-2026-11-24-front-desk-228.md section
    9. Not started on that branch. Built here 2026-11-26 (Anthony: "Read
    docs/HANDOVER-2026-11-24-front-desk-228.md section 9 and build request
    251"): Request lab and Prescribe warn of the same test or drug not
    done yet, with Send anyway or Cancel; the Front Desk's Take payment on
    the Laboratory and Pharmacy cards warns of the same on another request
    in the last 24 hours, with Take payment anyway or Cancel. No database
    change: it reads what each person may already read. Screen entries
    with made up duplicates; the sign in walk sends the same test twice
    (Cancel, then Send anyway) and pays both through the warning.
    LIVE 2026-11-26: CI, testing and live deploys green; the live code
    carries the new words; layout, contrast, visibility and click-through
    passed; the sign in walk (Cancel, Send anyway, both payments) passed
    locally and in CI.

253. **Pre-eclampsia, Duphaston, and a full check of lab results and
    files.** (2026-11-26) "the matron just said something that's under the
    antenatal, that there's eclampsia, but there's no pre-eclampsia, that
    they need that column for pre-eclampsia." "She also said that
    Dufrastone is not there... check if she could have added these things
    herself if they were not there. So next time when I go, I will show
    her how to add it." "Also check if the sending individual test back to
    doctor is correct and working fine... 3 lab requests is sent to the
    lab scientist, but only one result is ready... the doctor sees it...
    when the other results are ready, the lab scientist sends the
    remaining and the doctor sees those... the database is taking the data
    properly... files are saving in our Cloudflare storage." Also asked
    what "Not saved" after 12 hours means (answered in chat).
    DONE 2026-11-26: Pre-eclampsia and Eclampsia on the antenatal Medical
    history ticklist, LIVE (that list has no Other, so she could not add
    them). Lab results one test at a time checked end to end on a local copy
    with the Worker and its file storage: 3 tests asked, Malaria sent with a
    photo, the doctor sees it and opens the photo, Widal and FBC pending,
    then sent; 12 of 12 checks passed. Seen: the doctor's request line still
    lists all three tests under "Pending results" after one is sent (the
    other agent's 240h design; told him, not changed).
    WAITING: (1) his yes to add Duphaston 10 mg tablet to the medicine list
    (dydrogesterone 10 mg is there under its own name; staff could also add
    it with Other, pending the Pharmacy); (2) his yes to read live, counts
    only, to confirm files reach the live Cloudflare storage.
    LIVE 2026-11-26: CI, testing and live deploys green; layout, contrast
    and visibility audits passed; used on a local copy of the whole system.

254. **Spotting in pregnancy, threatened miscarriage; and the pick rule in
    CLAUDE.md.** (2026-11-26) The matron's note: "Spotting in pregnancy, we
    still need it. Spotting in pregnancy. Then threatening stage of
    pregnancy and threatening miscarriage." Anthony: "everything you are
    putting, you must be putting options that they can just be clicking...
    if it's not available, then they can click other... write that as a
    rule in Claude.md... when they add, the system can keep that and ask
    them to make it a standard... more than 10 or thereabouts... turn it
    into a drop down with that little search button at the top... So the
    system grows and becomes more intelligent." DONE: rule written in
    CLAUDE.md section 7 ("Pick, never type"; 8 is the line between quick
    buttons and a drop down, the number the app's search already uses).
    Medical history is a drop down with search and Other (Spotting in
    pregnancy, Threatened miscarriage (threatened abortion) added);
    surgical history got Other. ASKED: what "threatening stage of
    pregnancy" means. His yes to the batch 2026-11-26: migration
    20261126183515_antenatal_history_list_and_duphaston (a new pick list,
    antenatal_history, for anybody with medical access, its 14 starter
    lines, the add function knows the new name; Duphaston 10 mg tablet).
    The history drop down now reads that list, with "Save it to the list
    for everybody". Tested on a local copy: 5 database tests, 4 deliberate
    breaks caught, undo and redo; picked, added for everybody, one tap next
    time, "Duph" finds Duphaston.
    LIVE 2026-11-26: CI, testing and live deploys green; layout, contrast
    and visibility audits passed; used on a local copy of the whole system.

255. **Not palpable, previous births, and CS before.** (2026-11-26) The
    matron: "At palpation, there's something you need to add, not palpable
    too... add the last [births], like all the child [births]... the
    previous children they've had. And if they've done CS before or not.
    If they've done any operation." Checked: Presentation already has "Not
    yet palpable"; Previous pregnancies already records each child (date,
    weight, duration, method, sex, if the baby died); Surgical history
    already has Caesarean section and Other. DONE (his rule, CLAUDE.md
    section 7): birth weight, duration and method of delivery are picked
    with Other; the counts so far and the next of kin's age are picked.
    ASKED: should "Not palpable" also be offered on Height of fundus.
    LIVE 2026-11-26: CI, testing and live deploys green; layout, contrast
    and visibility audits passed; used on a local copy of the whole system.

256. **Everything the matron needs inside the antenatal visit; nothing
    filled twice.** (2026-11-26) "Please put everything the matron needs
    inside of the antenatal visit so it's easy for her. When a row or a
    detail is already filled in somewhere, let them automatically appear in
    the antenatal section too so they don't have to fill any information
    twice." Said back with a plan; his yes 2026-11-26 ("yes, go ahead").
    Then, 2026-11-26: "It's okay the way everything is on its own section...
    I like the arrangement that we did before. I don't think I want to
    change that arrangement... if there are other details the matron is
    asking for, let's record and probably work on it tonight." Built, not
    shipped: every section stays where it is; added inside them only: an
    "At a glance" block at the top of the antenatal booking, the visit
    filling HB and urine from the lab, routine tests showing the lab's
    results, gravida and para kept once in the profile. His answer
    2026-11-26: "I think the at a glance is okay. You can keep it."
    LIVE 2026-11-26: CI, testing and live deploys green; layout, contrast
    and visibility audits passed; used on a local copy of the whole system.

258. **An Inpatient tag in Find patient.** (2026-11-26) "if a patient is
    an outpatient or an inpatient, let the tag be among where you click to
    find patient that you normally have the tag for family, individual,
    sent to room. Let us have an extra tag that says inpatient. Find a way
    to include it, even on mobile. Maybe just a little text. So it's easy
    for somebody to select a patient that is inpatient or a patient that is
    outpatient." Everybody signed in reads admissions already (no SQL).
    His detail 2026-11-26: "Just make it small... a green pill, and put in
    on it. Then for the other one, put an orange pill... and put out on it
    ... something really small that will not clutter the card... the
    patient always carries that logo, even when they appear on the doctor's
    patient queue or anything." Also: "on previous pregnancies... you can
    only add one baby... there's no button to add another baby or another
    pregnancy." And: "an improved arrangement too can help as well,
    especially for the antenatal stuff."
    LIVE 2026-11-26: CI, testing and live deploys green; layout, contrast
    and visibility audits passed; used on a local copy of the whole system.

257. **Every bill starts with what was already collected, admitted or
    not.** (2026-11-26) "every bill that is being made by the front desk,
    whether it's prescription, if the patient is admitted, they should
    automatically be already populated inside the bill section. So when the
    doctor or anybody opens the bill section, anything that the person has
    collected before would automatically be showing... the other agent
    started it, but right now I'm not even seeing it... even in the list, I
    can't find medications given... I think it's on the testing branch, but
    it's not here yet." Checked: testing and live are the same commit, and
    the other agent's branch has nothing unmerged, so the inpatient bill
    (request 240) is live. Add a bill fills in Medicines given, Take Home
    Drugs and Laboratory tests only when the patient is ADMITTED (Admit on
    the patient's page); for anybody else it starts empty, and "Medicines
    given" is not in the list to pick (it is only that worked out line).
    Waiting for him: he may do it with the other agent this evening; asked
    whether outpatients should get the same.
    CLOSED 2026-11-26, no change: his decision, outpatients pay on the spot
    (see Decided). Live file check the same day (his yes, counts only): 12
    patient files on live, the newest that day; 33 lab results, none with a
    photo yet. Live security warnings: only the accepted one. Nightly
    backups green.

### Moved from the open list, 2026-11-26 (live and checked; his word: "move what is finished to done")

244. **Full check of everything this agent (claude/front-desk-228) built,
    then handover notes.** (2026-11-24) "go through all what you've done so
    far on the Rhema app... everything that you ever touched your previous
    work your most recent work... step-by-step... checking the screen how it
    fit on mobile tablet and desktop the responsiveness click through the
    buttons you walked on every single person you ever added. Check the
    database check that everything is OK and correct the SQL are running
    right the health of the system is correct and healthy... The npm run is
    green... The billing system is accurate and plan[ned] as we planned it...
    if you find anything not OK take your time [and] fix it here... keep a
    detailed record of what you did from the time you started your own
    session... the last 72 hours or thereabouts... write down everything
    you've ever touched fixed and summary and then handover notes on git."
    DONE 2026-11-24: everything re-checked (database, verify, audit,
    screens, click-through, every walk, CI and live health). One fault found
    and fixed on screen (the stay's lines on a bill). Handover notes:
    docs/HANDOVER-2026-11-24-front-desk-228.md. Still open from 240: part h
    (lab results one test at a time), not built yet.

121. **His plan for the rest of today (2026-10-31).** "First of all get
    the backup files [key]... Then I'll set up the budget. After that...
    open the AWS account and you walk me through that one... whatever
    that is left that you can do today, you will do it before the
    November 6th. Then after you do it, you go through what you did
    again. Make sure everything is fine. Then we wait." So: build 117
    (menu), 119 (file backup), 120 (CI stall), the AWS watcher with him,
    then one full review pass of everything built.

122. **Demo data on testing, and the full review.** (2026-10-31) "Let's
    just go straight to the review. Take it one step at a time, each
    module, everything. Make sure that all the modules are already built...
    when I'm going to go and meet the client in the next 1 hour... I'll be
    asking you to switch to front desk, switch to lab, pharmacy... I think
    you should put some test data in the testing sites... a few patient
    test data... of which we know that it's going to expire by its own in
    7 days." Built: .github/workflows/testing-seed.yml (testing only,
    once only). He said yes; it ran on testing 2026-10-31 and passed. Note for him: database rows
    do not expire by themselves; only testing FILES are deleted after 7
    days.

129. **Call in tells the Front Desk, with the ringing.** (2026-11-02) "If
    a consultant in room one calls in patient, that means the front desk
    gets the notification, right?... the notification will float on the
    screen, even if the front desk is doing something... it should also
    carry the call attention ringing infrastructure the same way... so
    they can quickly call the patient." Today Call in only changes the
    patient's status; the Front Desk is not told. "If that's not it, then
    you have to note it down for when you are going to do that."
    His answer 2026-11-02: either order is fine; "it has to float in front
    of the screen... they can just click the X to remove it... different
    headline, different coloration... call patient, then the name of the
    patient to room 1". Built the same day: a green card with a door icon
    and a chime, "Call patient · Adaeze Okafor to Consultant Room 1", for
    every Front Desk. His yes on the SQL 2026-11-02, with: "the name
    should still show when the app is locked" (the phone alert names the
    patient: his decision on patient data, NDPA), and "they should count
    differently... and each should prevent duplicate" (each kind has its
    own 30 second guard).

130. **Lab, prescription and download fixes.** (2026-11-02)
    a. Request lab: "doesn't populate the patients that are there... I
       don't understand this type of way that the thing is looking" (the
       initials circle stretched into a long oval on the iPad; nobody is
       listed until you type).
    b. Prescribe: optional parts must never block Send prescription; make
       sure Send works to the Front Desk and straight to the Pharmacy.
    c. After sending: "a gray, as in a softer button... by the side of back
       to the record... send also to front desk" (or "also to pharmacy"),
       not a "send to both" button.
    d. Attachments only: "show the names of the attachment... select or
       toggle one button that says select all... download everything once
       as a zip folder, or they can just choose one and download as a
       single file." Full medical history stays as it is, on its own,
       without attachments.
    e. "When they are downloading a medical report... let it come with the
       name of the patient with their patient ID."
    f. "remove in hospital and then put the actual tags" on Find patient.
    All of 130 live 2026-11-02.

131. **Duplicate guard on every action.** (2026-11-02) "Remember
    Idempotency checks in all actions that might cause a duplicate of
    exact results." Audit 2026-11-02: payments, lab requests, results,
    prescriptions, Send also, files, invites, Call attention and Call
    patient, Send to room (one open visit per patient) are guarded in the
    database. Not yet guarded (a double tap saves twice): registering a
    patient (and from old file), and the medical record writes (allergies, vital signs, notes,
    consultations, medicines, doses, conditions). Built 2026-11-02 as one
    shared guard (double_tap_guards); his yes 2026-11-02; live, 0
    security warnings on testing and live.

171. **His list of 2026-11-09 (with the antenatal answers).**
    (a) "That refresh spinning wheel at the top bar will be needed" (it
        was removed earlier the same day on his question; now back).
    (b) "Simple back buttons will also be needed to help move back to
        previous pages on a desktop."
    (c) "Request lab goes to lab and front desk simultaneously and the
        updates on payment and test results ready should not wait for a
        reload... once any request is fulfilled, the doctor gets a
        notification."
    (d) "All notifications should come with a sound... a unique sound that
        can't be ignored, maybe a pop up sound or iPhone notification sound."
    (e) "Pharmacy request too, simultaneously send to pharmacy and front
        desk for payment."
    BUILT 2026-11-09: (a) refresh button back; (b) a Back button first in
    the top bar on every screen but Home (back in the app, or Home); (c)
    lab: the Lab sees a request at once, "Waiting for payment at the Front
    Desk", ready the moment it is paid, live; the option reads "Lab and
    Front Desk (payment)"; "Straight to the lab" kept; (e) pharmacy: the
    first option, "Pharmacy and Front Desk (payment)", sends to both at
    once; "Straight to the pharmacy" kept; (d) a three note chime, twice,
    whenever anything new waits (not a message while Messages is open).
    STILL TO DO: (c) the doctor told when a prescription is dispensed (lab
    results already tell them): needs a "seen" column, SQL with the
    antenatal batch. Note: the pharmacy file said "No alert when dispensed"
    (his earlier word); his new word replaces it.
    LATER 2026-11-09: "That back button should be only for desktop and
    maybe tablet, iPad... on a smartphone, it will probably clutter." "The
    spinning wheel, let it be fast... like it just reloads the page in the
    background... as if nothing happened." LIVE 2026-11-09 (e24844a): Back
    hidden under 700px wide; Refresh fetches every screen's data in the
    background, no page reload, the arrow turns once. Waiting for him to
    try it on his phone and iPad.

174. **Who may do what (nurse, front desk), email records, medicines.**
    (2026-11-10) "Nurses are able to perform some things only doctors are
    supposed to do like consultation notes. The register patient buttons
    (old/new) should be hidden for others, only front desk registers.
    The nurse should also be able to forward medical records to email if
    the patient's email is included. If the doctor prescribes and pharmacy
    has given it, it should automatically reflect under current
    medication; when it is there the nurse can stop/suspend/edit it."
    LIVE 2026-11-10: Register buttons (Find patient, family card, the two
    register pages) only for the Front Desk; no consultation note button
    for anybody but a doctor. The deploy test now has the Front Desk
    register the patient.
    His yes to the SQL: "yes, doctor and edit SQL" (2026-11-10), with:
    "all consultant rooms can write consultations whether the person is a
    doctor or nurse/matron, as long as they have a consulting room assigned".
    So the rule is the ROOM, not the role (private.has_consulting_room).
    Migration 20261110141814_doctor_notes_front_desk_registers_med_edit (a
    person in an active consultation room writes/voids notes; only front desk inserts patients; nurse may edit a
    current medicine, not a stopped one) and the Edit button on a medicine
    (Medications.tsx, record.ts). Test 015 now uses a doctor.
    Already true: a dispensed prescription adds its drugs to current
    medications (dispense_prescription, migration pharmacy); the nurse
    already had Suspend, Resume, Stop and Void.
    EMAIL THE RECORD. His answer (2026-11-10): "the privacy policy is
    adjusted to fit, this is only with the patient's consent, which means the
    patient provided their email. Doctors and nurses should be able to as
    well." BUILT, NOT LIVE: worker/src/records.ts (POST /api/records/email,
    reads the record as the staff member, sends only to the email on the
    record, writes the send to record_emails BEFORE sending, none = no
    email); Email record button on the record page (confirm step shows the
    address); Privacy Policy section 6 and LEGAL_UPDATED changed (version
    kept, so staff are not asked to agree again). Held: migration
    20261110151018_record_emails (new table, waits for his yes to the SQL).
    Included in the email: profile, allergies, conditions, medicines, doses,
    vitals, nursing and consultation notes, lab results. Not the files.
    Anybody with medical record access can send it (doctor, nurse, matron).

181. **Check Refresh; keep what is loaded so it works on a shaky network.**
    (2026-11-11) "Check that refresh button if it actually refreshes the page...
    when the system has already loaded, if you click on find patient... open
    that patient... click back, the system loads details again. I thought
    details already loaded just remain. That's what we agreed, so they can
    work offline even if the network is unstable."
    FOUND: Refresh does fetch on every screen with live data and never
    reloads the page; the Admin staff and invitation lists did not re-read
    (fixed). Find patient, the patient's screen and the medical record kept
    nothing in memory, so a slow network meant a blank wait (3 s on a 1.5 s
    network; never visible when returning by the menu).
    DONE: Find patient keeps what was typed and found (per person, memory
    only) and falls back to the device copy of recent patients; a patient
    opens at once from the list or the copy; a loaded medical record stays in
    memory and stays on screen if the network drops (loadRecord now returns
    nothing when any part fails, so a refresh offline cannot blank it). Each
    screen still asks the database straight after and replaces what it
    showed. Measured (1.5 s network): open patient 3063 ms to 66 ms; menu back
    to Find patient never to 67 ms. Offline: record, patient and list all stay.
    Memory is emptied on sign out and on closing the app (his rule: nothing
    medical on disk; the 30 day patient copy on disk is unchanged).

182. **The sign in screen remembers emails.** (2026-11-12) "On any computer,
    make sure the system remembers the email addresses that have logged into
    that computer... one person: it is already there. Three: a drop down...
    so the person can choose their own email and log in." DONE: this device
    keeps the work emails that signed in (lib/auth/known-emails.ts, emails
    only, newest first, 10 at most, kept after sign out). The newest fills the
    box; with two or more a drop down arrow lists them, each with Remove.
    Privacy Policy section 3 says so (LEGAL_UPDATED 12 November).
183. **The Pharmacy sees the medicines a patient has taken.** (2026-11-12)
    "Patients do not remember their drugs... I want the pharmacist to be able
    to see somebody's medical records of their medication: the ones they are
    taking, suspended, stopped." Today the Pharmacy cannot open the medical
    record (doctors, nurses, matron only) and still cannot. His yes: "pharmacy,
    run the SQL" (2026-11-12). Shipped with: migration 20261112053852_pharmacy_sees_patient_
    medicines (a function that returns the medicines only, Pharmacy role only,
    each look written to the activity log) and a "Medicines this patient has
    taken" card on the patient's screen for the Pharmacy. Not built: "dispense
    again" (a dispense needs a doctor's prescription).
184. **Antenatal consent and extras.** (2026-11-12) "What the matron told me
    about antenatal patients... I believe you've added those." Already LIVE
    since request 170 (migration 20261109170525): the antenatal booking card,
    tests, previous pregnancies, and the operation consent for every patient.

185. **Master account admin again; testing without install cards; pitch names.**
    (2026-11-12) "I mistakenly made myself a front desk without admin access...
    make me an admin from the database, rhemamedical7@gmail.com, the director
    is not around." Migration 20261112105211_master_account_admin (that one
    email: role admin and the admin ticks). Testing was switched with
    testing-role.yml. Also: the testing address no longer shows the install or
    alerts cards (lib/brand/site.ts); live unchanged. Pitch names ready on
    testing for his "go": MASCAP, then LANA (ops/pitch.json), then Rhema back.
    Emergency: nurses swap with Nursing Station nurses, so he will add two rooms
    in Admin > Rooms: "Nursing Station Emergency" (nursing) and "Consultant Room
    Emergency" (consultation, so its doctor writes consultation notes). A person
    has one room at a time; an admin moves them when they swap. Asked whether
    nurses should switch their own room. MASCAP pitch: "forget mascap for now"
    (testing stays Rhema).

186. **Pick lists for almost everything repetitive.** (2026-11-12) "The
    medication samples aren't up to 112... you didn't add the picker for dosage...
    plaster and syringes are not drugs, they should have their own list...
    doses should have a list to pick from and others, just like strength; same
    with frequency; the allergies should follow the same pattern... virtually
    everything repetitive, so they will have just little to write; when they
    choose other, they can type by hand, and notes by hand. The aim is to
    reduce what they type by hand."
    SUPPLIES: LIVE-ready (no database change): the medicine picker shows
    medicines only; the Pharmacy page has Medicines and Supplies tabs.
    ON THE 112: the starter list is 112 LINES (a name and a strength each) but
    70 names (64 medicines, 6 supplies); the picker shows names.
    His yes (2026-11-12): "it's run the SQL, and the same for the registration,
    the front desk. For the lab, the same as well. The pharmacy, find more drugs
    ... software like Swift comes already populated... go online and search."
    PICK LISTS shipped with migration
    20261112114324_pick_options (93 starter lines: dose 24, how often 13,
    allergen 24, reaction 12, condition 20; typed lines kept per person, standard
    when a second person types the same; a person can remove their own), the
    drop down with Other (components/options), used for dose and how often on
    Prescribe, Add a medicine, Give dose, Edit medicine, Record a dose; allergen,
    reaction and condition on the record. NEXT, not built: next of kin
    relationship and the State on the registration card; other repetitive
    fields he may name.

225. **Sheets: automatic name and time, tidy buttons, a running sheet.** (2026-11-17)
    a. Buttons: "the way you put save and cancel like that... on the desktop,
       it's too cluttered... I thought I told you to be screenshotting every
       page... check other areas where the buttons are not okay on a desktop."
    b. "The system should automatically take the name of the nurse that is
       logged in as the person who entered the data... including the
       consultants... which consultant is logged in, their name, and which
       room... they don't need to manually select who did what. System keeps
       the audit trail." (Replaces his earlier "picker that contains only
       nurses".)
    c. Time: "the moment they save, the time automatically takes the time
       from the internet... not the time in the system, in case the system
       is not correct."
    d. Vital signs and other records "like Excel spreadsheets... signs that
       change... the BP reading for today is no longer the same as
       yesterday... they are supposed to add... as time goes on. Currently it
       looks as though it's just one of something."
    STATUS: LIVE 2026-11-17 (no SQL). Sign and Seen by are the person
    signed in, with their room; no picker. Saves take the database's clock;
    offline lines, "now" time boxes and dates use the device clock corrected
    against /api/time (checked live). The sheets are one running table:
    headings, the new line, then every line newest first by day. Every
    record form ends with Cancel and Save on their own line on the right;
    the consultation's medicines in their own box, its Save bar in view.
    Desktop sweep: record forms fixed; Register, old file, Request lab and
    Prescribe already had one main button at the bottom. Dark mode checked
    at phone, iPad landscape and desktop.

224. **Records ready offline; instant moves; spreadsheet notes; lag.** (2026-11-17)
    a. "When you load the page for the first time, the most current patient
       data in the last 30 days... should load into the system and stay,
       excluding attached files, so it's easy when there's no network... if
       loading everything will be difficult, can we at least do patients for
       the last seven days, at least those currently receiving treatment or
       consultation, their records preload so that anyone can easily see
       those even when the network is bad." (Reverses Decided 2026-10-28,
       "Medical records are never kept on the computer": needs his yes on
       the plan, NDPA.)
    b. "Did you check if the instant opening really works... sometimes it
       appears as though the new page is loading."
    c. The doctor: "when he clicks consultation... open a complete full page
       with the different categories like history and symptoms... listed
       like a spreadsheet... he can decide to use the picker... or type by
       hand... Same with nurses... their own... in form of a spreadsheet...
       a full page... so he can type in his notes and also see what he's
       typing." He sent text from the ward record book: a treatment sheet
       (Time, Name of drug, Dosage, Route, Sign) with events such as "Blood
       connected" and IV fluids in mls, and a vital signs sheet (Time, Temp,
       BP, Pulse, Sign).
    d. "Check the system to know if the system has anything that make it lag
       as they're registering patients."
    FOUND (b, d): no screen ever reloads in full; typing is 17 to 28 ms a
    letter on a slowed phone; the database is small and healthy (Paris,
    eu-west-3). The app recounted every notice on every move and on every
    save anywhere: requests while moving 82, now 47 (counts at most once in
    10 seconds, never in the background); every screen's code is fetched
    ahead once. LIVE with this entry.
    HIS ANSWERS (2026-11-17), "yes on the SQL as long as all is well":
    a1. Offline copy: "anyone with a visit now is better" (open visits only).
    a2. Text only; files show that they exist and load when opened.
    a3. "Front desk keeps what is their business and let the nurses and
        doctors keep theirs."
    a4. Safety yes; "we just don't want them to lose data" (unsent work must
        never be wiped).
    a5. Log the copy and offline openings: yes. a6. Size fine "as long as
        it doesn't slow the system". a7. Privacy notice line: yes if not risky.
    c. All recommendations yes, plus: "the time column automatically
       updates as you type and save" (the time of recording); "the nurse can
       enter their name from a picker that contains only nurses, and for
       doctors in consulting room"; "make it as easy as possible for them to
       see, including the midwife/nurse who is currently consulting in room
       2. She is the one in charge of antenatal patients." He sent photos of
       the two ward sheets: drugs (Time, Name of drugs, Dosage, Route, Sign;
       events in red: Blood connected, Blood got finished, Blood
       disconnected; IVF in mls; routes IV, IM, Infusion, Orally) and vital
       signs (Time, Temp, Pulse, Resp, BP, Sign). No patient details were in
       the photos; none were copied into the repo.
    STATUS: LIVE 2026-11-17 (SQL first, 0 new warnings on both; then the
    screens; the full walkthrough passed). Records of open visits kept,
    scrambled, on clinical staff's devices (logged; wiped at sign out and
    after 24 hours); a record with no network opens from it under a banner
    and the opening is logged later. FIXED on the way: opening the app with
    no network signed people out as "switched off"; unsent entries were
    wiped at sign out. Treatment and vital signs sheets full page (Sign
    picked from nurses); the consultation full page (Seen by from consulting
    rooms, midwife included); route on medicines and doses; privacy notice.
    KNOWN LIMITS, told to him: unlocking the PIN screen needs the network
    (the PIN is checked by the database); a phone that has not been opened
    online for over an hour may still need the network to renew sign in.
    NEXT after this: registration in one trip (one function), offered and
    accepted with "all your recommendations are good".

222. **A bubble disappears once the message is seen.** (2026-11-17)
    "When someone has already opened a message, even if the person did not
    respond... as long as the person has opened that message and seen it...
    the bubble should disappear. The only thing that the bubble doesn't
    disappear... is when a doctor or any nurse or lab or pharmacy requested
    for something, a request or a sent to room... That one stays until the
    person acts on it. But normal message, notification, all those things,
    once the person has seen it, it should not be showing the bubble."
    STATUS: LIVE 2026-11-17. Messages, announcements, results ready and
    prescriptions dispensed stop counting once unfolded in Notifications
    (messages marked read; the rest kept on the device as notice keys);
    work waiting counts until done. Opening a conversation already cleared
    its messages. Backup timer CONFIRMED: runs at 07:17 and 09:17 UTC
    started by the timer, both succeeded.

220. **SQL yes; medicines without a note; drop downs for long lists.** (2026-11-17)
    a. "Rhema backup timer is done." The first token was saved as plain
       text and wiped by a deploy; it was also partly shown in a screenshot,
       so he generated a new one (2026-11-17) and saved it as a Secret.
       RENEW BY 2027-11-17: GitHub, Fine-grained tokens, "Rhema backup
       timer", Regenerate; then Cloudflare, rhema-hospital, Settings,
       Variables and Secrets, GITHUB_BACKUP_TOKEN, pencil, paste, Deploy.
    b. "Run the SQLs first." His yes to the 219c batch (migration
       20261117003602).
    c. "If a doctor adds a medicine, doctor must add a note to it. Is it
       compulsory? Is that how other platforms design it? And why?"
    d. "If they are picking from a selection, long selections should just
       have drop downs that you can choose from with a search bar, of which
       the first letter populates only those words that start with their
       first letter. So it's more minimalistic and easier to use."
    STATUS (2026-11-17): b LIVE (SQL first, then the screens; 0 new
    warnings on both databases). c LIVE: medicines save with no note. d
    LIVE: every search shows only names that start with the letters; the
    note's common words are one drop down per box. a: waiting on the first
    timer run with his token.

219. **Build 1 to 6, check the doctor's screens, and ease of use.** (2026-11-17)
    a. The token goes on the main hospital Cloudflare account (asked which).
    b. "Check the things that you have put live for the doctor. Check that
       everything fits well."
    c. "For the comparison... check if we need the 1 to 6, they are worth it.
       Then we run all of them, we add all of them, run the SQLs at once."
    d. "Check the arrangement, apart from the flow... the interface, how clean
       their own is... ease of use... We are not trying to design a complex,
       difficult software... even people who are not that savvy, who uses
       WhatsApp, can still use it well."
    STATUS (2026-11-17, early hours):
    a. Answered: the main hospital account (rhema-hospital Worker). The
       timer is LIVE (Cloudflare shows "schedule: 17 1-23/2 * * *"); it
       sends nothing until he adds GITHUB_BACKUP_TOKEN.
    b. LIVE: checked at 320, 360, tablet and desktop with the forms open.
       Fixed: Save could store medicines with no note; tap words now show 8
       with More; boxes stack on phones.
    c. LIVE 2026-11-17 (all 6). Was: BUILT, tested, NOT pushed to testing: all 6. SQL is commit 473d245
       (migration 20261117003602, test 047, 9 of 9 breaks caught); screens
       are commit 8041ae3. WAITING FOR HIS YES ON THE SQL. Then: push
       473d245 alone to testing and on to main (the screens read the new
       columns, so the database goes first), then 8041ae3.
    d. Answered in chat: their systems are desktop first and dense; nurses'
       top complaints about the big ones are clicks, typing twice and
       warnings. Ours stays phone first, two taps, plain words.

216. **History: his answers and the front desk's real need.** (2026-11-16)
    "Yes, admin 3 card fees." "The front desk... when they click history,
    they are seeing the payments. The admin is seeing the same thing... all
    payments for today, in the last 24 hours... choose range of time, let's
    say last six hours... or their particular shift, since they started the
    shift... they want to know how much they made when they were on duty...
    by category... by mode of payment... the total paid... count the cash they
    have and know that it matches. Others are also able to see just numbers of
    how many they attended to." Design: "easy to spot and understand.
    Screenshot and check it until it looks good both on mobile and
    desktop/tablet."
    CORRECTED 2026-11-16 (his words: "the front desk just want to know the one
    they themselves collected... from the time their own session started...
    admin is now the one that sees everything"): the Front Desk sees only
    their own money, enforced by the database, from their last email sign in
    ("This shift"), with Today and Last 24 hours; no Everybody. Admin: Period
    drop down (dates and hours) and Taken by (Everybody or one person). Long
    lists folded. His SQL yes "if it matches"; it matched. LIVE 2026-11-16.
    BUILT 2026-11-16: History in the menu (migration
    20261116155137_history_summaries, test 045, 9 breaks caught). Front Desk
    and admin: total, Cash/POS/Transfer (cash marked, "Count the cash in hand:
    it should be..."), each category with its own total (card split into
    Individual, Family, Antenatal), patients registered, payments; "Only
    payments I took" (on for the Front Desk) or Everybody. Lab and Pharmacy:
    counts only. Doctors and nurses: their own work. Periods: Today, last 6
    or 24 hours, this week, this month, dates and times chosen. Admin >
    Prices: three card fees; Register and Take payment use the patient's kind.

215. **History behind the menu: money for the Front Desk and admin, numbers
    for the Lab and Pharmacy, own work for each consultant.** (2026-11-16)
    "The front desk can see history of everyone registered today and all
    payments made, so they can also see how many different categories of
    payment... individual, antenatal and family are different amounts, the lab
    tests and the medicine. It also shows the amount of money in total... by
    day, week, month, and even hourly range. Each category also has its own
    total apart from the general total... so the front desk can cross check
    what was paid. Then also total paid by mode of payment, cash, POS or
    transfer... Pharmacy and lab only see numbers. The pharmacy sees how many
    drugs and how much was sold or given out today, then the lab as well. Only
    the admin and front desk see all history amounts... each consultant can
    still see their own history... how many patients in particular they
    attended to. The history button can sit behind the hamburger menu."
    Also his yes to 214's SQL ("Yes to the SQLs").

214. **His answers on 213 a and b, plus notes titles and lab edits.**
    (2026-11-16) "1. yes 2. yes" (send paid lab tests to the Lab, paid drugs to
    the Pharmacy). "3. yes on the pharmacy but entering number of units or
    sachets can only be required when the pharmacy actually sets the quantity in
    stock otherwise it remains skippable. 4. show warning when it's at zero and
    allow anyway and keep showing warning until the restock but this only
    matters if the pharmacy actually set it. 5. one unit and let pack be its
    own line."
    "On the nursing note let's add title and then the body becomes the note, so
    they can title their notes, same with consultants."
    "The lab scientist should be able to find and edit/add patients medical
    tests as long as the front desk has confirmed them paid... they can make
    mistake and discover later and go to edit or cancel... If they mistakenly
    mark finished at the lab without adding the test, refuse and add warnings
    that they should add test details."
    LIVE 2026-11-16 after his yes (migration 20261116145838, test
    044, 10 breaks caught; test 031 kept, 009 caught a doctor read gap that
    was fixed): Front Desk Send to the Laboratory / Pharmacy after a lab or
    drug payment, with an optional doctor; stock (unit, warn level, restock,
    recount, drops on dispensing, below 0 allowed with warnings, Running low on
    the Pharmacy's Home, how many required only for counted lines); titles on
    nursing and consultation notes; Lab: warning naming tests without details,
    database refuses Result ready (missing_tests), Find a patient's tests page,
    cancel a wrong result with a reason, add the right one.

213. **After a payment, send it on; pharmacy stock; small fixes.** (2026-11-16)
    His yes to 211's SQL: "yes on the sql". Then:
    a. "If front desk takes a payment, they will now have to send to lab, same
       with medicine/pharmacy payment."
    b. "The pharmacy/medication is supposed to have units/packet/sachets... if a
       person is taking any drug, they should be able to pick how many, whether
       it's sachets or tablets, and the pharmacy is able to set how many is left
       and as they sell to patients, the number drops until they restock...
       just like in standard pharmacy."
    c. "On the medications, make the drop down arrow visible enough that they
       know they can just click to see a list."
    d. "Can the patients in queue have a button that opens straight to medical
       records for doctors and nurses."
    e. "The doctors and other departments should not see a button that says
       take payment. A doctor or nurse who is also an admin should not see take
       payment."
    LIVE 2026-11-16: 211 (payment kinds with test and medicine pickers, every
    payment with date and time, First registered, old file month; migration
    first_registered_and_payment_lists, test 043) and c, d, e (medicine box
    closed with a clear arrow; Medical record button in the queue for medical
    staff; Take payment and the pay cards only for the Front Desk and an admin
    who does not work with patients). a and b: plan read back, waits for yes.

212. **Vital signs: pickers and Other on each box.** (2026-11-16) "The vital
    signs, can there be pickers + others on each of the box, so they can pick
    from options without typing?"
    DECIDED same day (on 211's question): doctors do not see payments: "No,
    doctors only knows that the patient has already paid for that test."
    211's SQL still waits for his yes.
    BUILT 2026-11-16: every vital sign box is a number list (opens at the usual
    value: 120/80, 36.8, 76, 16, 98, 65 kg, 165 cm), search, Other to type.
    Vital signs he added himself (such as Blood sugar) stay typed boxes.

211. **Front Desk payments by kind, with pickers; payments and first
    registration on the record; month picker for old files.** (2026-11-16)
    "Payment should have other categories, so they can choose from the list,
    either lab test, card payment, drug payment and when they choose payment
    for pharmacy or lab, they should also have a picker to select what
    particular test or medication... for rush hour where the doctor may not
    have time to reach for the computer to request for test so they can just
    give a patient a piece of paper to meet front desk for payment. And on the
    patient records all payments made with date and time will be shown. When a
    patient was registered first should also show. For older patients, please
    add a month picker because they're registering the patients month by
    month."

210. **Widal: a "Significant titre value" heading.** (2026-11-16) "Only
    insignificant titre value. I can see that the significant is the comment,
    but we can add a heading that says significant titre value at the top with
    the explanation followed." DONE: the explanation sits under that heading at
    the top of the Widal boxes and is the first line of every Widal result;
    comment picks are now Insignificant / Significant titre obtained.

209. **Lab and Other, a batch.** (2026-11-16) His yes to 208: "your
    understanding is right and on that SQL is yes." Then:
    a. "The test and the pharmacy and every place there's Other, make it so
       that they can save that type of test or medication as part of the
       lists... when they add a new test they should be able to save it as
       standard so next time it becomes part of the picker."
    b. "After the lab scientist is done with the patient data, they can send to
       room and also save/submit to the doctor that requested and any other
       doctor or others that have access to see the data."
    c. "Do not add any picker that belongs to another category to another
       category e.g. PCV is showing AA which I don't think it's supposed to be."
    d. "Take some time and make sure everything is in order especially the lab
       tests, let them be correct."
    e. "Even under a test, if there is a type they can add, because I noticed
       there's no significant titre value."
    LIVE 2026-11-16 (migration 20261116125814, test 042, 9 breaks caught):
    208 lab prices: lab sends, admin approves or refuses (Admin > Prices top),
    standard on its own after 72 hours (backup job, every 2 hours); Front Desk
    sees standard, or the waiting price marked "not yet approved"; empty boxes
    say "e.g. 2,000". a: Other has a tick "Save it to the list for everybody"
    (on by default); new lab tests saved for everybody; words typed with Other
    inside a test box are kept for that box. Medicines: a doctor's or nurse's
    Other still waits for the Pharmacy to confirm (his rule of 2026-11-11,
    unchanged). b: results screen says who was told and has "Send patient to a
    room" (opens the patient card). c: fixed, a new test starts with empty
    boxes. d/e: 1/640 titre, significant titre comment, vaginal and urine
    microscopy, Hepatitis B profile boxes, no microscopy on blood culture.
    Pharmacy prices with approval: not built (he did not say pharmacy too).

208. **Tests come with prices; the lab proposes, the admin approves.**
    (2026-11-16) "Add price pickers too so tests comes with price, especially
    check the list I uploaded, there's price in it. Also the lab scientist can
    add/edit price of any test and the admin approves it and it becomes the
    standard price. But if admin hasn't approved it after 72hrs, make the price
    standard regardless... Option for Other included in the price list."
    CHECKED: the uploaded LABORATORY_REPORT.docx has no prices in it (no naira
    sign, no amounts beside tests); asked him for the price list. Plan read
    back 2026-11-16, waits for his yes. Goes with 204.

207. **Lab test list for the lab scientists.** (2026-11-16) "Can the lab
    scientists see the list of test without any patient data, if not please
    fix." They could not (tests only showed inside a request). BUILT: page
    /lab/tests/ (every test by section, its boxes, units, normal ranges and
    picks, plus tests added with Other), linked from the lab's card on Home.

206. **Backup: a copy of everything, all the time.** (2026-11-16) "Does it take
    duplicate files?... the backup is duplicating the patient data immediately,
    or the backup only takes raw files?... I want a system whereby the backup is
    taking in everything automatically. So at any point in time, the hospital
    can decide, okay, they want their data. If the live site ever crashes...
    they can access their data." ANSWERED 2026-11-16, his choice waits.
    FOUND: backup.yml copies only lab/ files; record/ files (old file scans,
    patient files) are not in the backup. To fix (asked him).
    Same message, 203: "rhema back, okparavero out, we would build the proper
    demo later." DONE: testing back to Rhema.
    DECIDED 2026-11-16: "1 and 3 is great": (1) backup every 2 hours, free;
    (3) a Download our data button in Admin. Point in time recovery (paid) later.
    (1) LIVE 2026-11-16: backup.yml every 2 hours (recent/ kept 2 days, daily/
    35 days, monthly/ for good); record/ files now backed up with lab/. Run by
    hand after the merge: success, copy checked and opened, both file kinds read.
    (3) Plan read back to him 2026-11-16, waits for his yes.

205. **Remove the test patients on LIVE.** (2026-11-16, about 10:55 Lagos time)
    "Let's remove all the test patients added before today. But if there is any
    patient added this morning that is in the last 10hrs leave it, but anything
    higher, just delete, they should be around five test patients in the live
    site." Cut off: added before 00:55 Lagos time on 16 November is deleted.
    Rules: a read on live and any delete are asked first (CLAUDE.md section 2).
    Asked him 2026-11-16 for (1) a read only look, then (2) the delete batch.
    DONE 2026-11-16: he confirmed all 8 (RMC-000001 to 000008) were tests and
    said "still delete it, all 8". Migration 20261116110342 (test 041, three
    breaks caught) ran on testing (nothing matched, 17 kept) then live. Live
    now has 0 patients, payments, visits and families. Left: 2 files of
    RMC-000003 in file storage, unreachable. Next number RMC-000009.
    FILES CLEARED 2026-11-16 (his words: "clear the uploaded files, it was me
    that uploaded it"): new job files-leftovers.yml (list, or delete with a
    limit) deleted the 2 leftovers from rhema-files; a list run after shows 0.

204. **Prices: not a picker; "e.g." in every price box.** (2026-11-16) "We don't
    need prices to be a picker, the hospital decides per time how much a test
    costs and if they want to make it fixed it should be something they set in
    the admin settings. From front desk to pharmacy, they can decide to set the
    price as a standard including laboratory, otherwise let the field just show
    e.g. so they can manually enter the price of anything themselves." Read back
    to him 2026-11-16, waits for his yes.
    Also, same message, on 203: "don't switch it. Don't switch the testing site.
    Leave it. I will not go to the hospital. I would go to the other hospital."
    Testing was already switched to Okparavero when this arrived; asked him
    whether to put Rhema back now or leave Okparavero showing.

202. **The hospital's own lab list.** (2026-11-16, he sent LABORATORY_REPORT.docx,
    real past reports) "This is the laboratory document, check it to know
    what's left and what to correct. Also see the structure and propose the
    best arrangement for easy picking. Don't forget, we always include Other for
    anything not on the list." The document holds real patients: only test
    names, fields, units, ranges and result wording were taken; the working
    copy was deleted, nothing of it is in the repo.

187. **Open a patient from the queue.** (2026-11-16) "After calling in a
    patient, at the patient queue they should be able to click on the patient
    and open the profile." LIVE 2026-11-16: an Open patient button on each
    queue line.
188. **Sign in feels slow.** (2026-11-16) "After you put the code, the system
    tends to delay... maybe even show you the place where you enter your Gmail
    again before eventually showing the dashboard... when the system locks and
    you enter your PIN, it still shows that login page slightly before opening
    your dashboard... look into it and see if you can fix it." LIVE 2026-11-16:
    once signed in or unlocked, the sign in and lock pages show the navy opening
    screen while Home opens (never the email form or idle screen again); Home is
    fetched in advance; a fresh sign in asks the database 2 questions at once
    instead of 4 one after the other. Ask him whether it feels better.
189. **Antenatal: palpation columns and the card's data.** (2026-11-16, three
    photos: the "Anti-natal record" visit table and the P.H.C. data and client
    details pages) "The midwife (consultant room 2) gave me some lists... they
    do palpation... height of fundus... we need to add columns for the
    palpation... check if we already have those data." FOUND: next of kin
    details, route tests, previous pregnancies and consent were built (request
    170). MISSING, BUILT 2026-11-16, NOT LIVE (waits for his yes to the SQL):
    migration 20261116051615_antenatal_visits_and_client (the visit table:
    fundus, presentation, position, FHR, urine protein and sugar, BP, pulse,
    respiration, weight, Hb, oedema, drugs given, remark, examiner, return
    date; her marital status, religion, education, occupation, tribe; medical
    history ticklist; surgical history) and the due date from the LMP. Also
    waiting: migration 20261112124143_pick_lists_registration_lab and the
    registration card drop downs (town, LGA, State, relationship).
190. **Lab templates.** (2026-11-16) "The laboratory data, I currently have it,
    so I will upload everything to you... structure them so they can just be
    picking data." Waiting for his upload.
192. **Register from old file needs the category.** (2026-11-16) "The front
    desk complained that register old file does not have category like
    individual, family and antenatal." LIVE 2026-11-16.
193. **More pharmacy drugs.** (2026-11-16) "Apart from the 112... search the
    internet, Nigeria and everywhere, the drugs they sell... populate."
195. **Dark mode.** (2026-11-16) "We also need a dark mode toggle because of
    the eye... ensure every text fits, nothing becomes illegible or too faint...
    let the dark mode feel natural just like the light mode."
    Also 2026-11-16: "I have set emergency room myself."

177. **Medicine list to pick from, instead of typing (pharmacy, nurse, doctor).**
    (2026-11-11, after a day at the hospital) "They said it would be nice if
    they uploaded all the medicine that they normally give. Instead of
    typing, they will just tick the medicine. When they click on that place,
    it gives a drop down with a search. They press the first letter of the
    medicine, tick which medicine, then tick the milligram associated with
    it (500, 100, 200 depending). Same for the nurse wherever they put in
    medications: select it. In case it is not in the list they click
    'other' and add it. If a nurse types a medicine by hand, the system
    should remember it, so next time a letter finds it. The pharmacy can
    also enter all the medicine they have, plus syringe and the like, by
    hand. Same thing with the doctor. In almost all the cases: only notes are
    typed; when an option does not exist, click 'other' to add it manually.
    The pharmacy will send their list, like the lab will send theirs; for
    now I can populate the regular ones (paracetamol, cimetidine,
    omeprazole...) with their milligrams, from the internet."
    HIS ANSWERS (2026-11-11): only the Pharmacist (role) adds and edits the
    list. A doctor or nurse can add one that is missing: it is PENDING, usable
    at once, seen only by them and the Pharmacy, and becomes standard for
    everybody only when the Pharmacy confirms it. Yes to the starter list
    ("I concur"). Extra vital signs: typed once, kept for that person, and
    made standard automatically when a second person types the same one.
    His yes: "okay, go on with both SQLs, I'll do the necessary parts"
    (2026-11-11). BUILT; shipped with request 178's database rule:
    migration 20261111160406_medicine_list (112 starter lines, marked
    "starter" until the Pharmacy confirms), migration 20261111160643_vital_
    extras; the picker (components/medicines), Pharmacy page /pharmacy/list/
    (confirm, confirm the starter list, add with several strengths, edit,
    switch off), a notification for the Pharmacy, the Home button (replaces
    Messages for the Pharmacy), the picker in Prescribe, the nurse's Add a
    medicine and Record a dose, "+ Other vital sign", and the extras in the
    emailed record. "Same" for a vital sign = same words ignoring capitals,
    spaces and punctuation.
178. **Only the Front Desk edits patient details.** (2026-11-11) "The nurse,
    the doctor, the pharmacist, the lab, they should not be able. It's only
    front desk that can register a patient and edit patient details."
    LIVE (screen): the Edit details button and the Edit page are Front Desk
    only. Database: migration 20261111175805_patients_edit_front_desk (his yes,
    2026-11-11: "go on with both SQLs"), shipped with the medicine list and
    the Other vital signs.
179. **Vital signs: "Other" for a measure that has no box.** (2026-11-11)
    "What about a vital sign that is not among those boxes? Put something
    like 'other', so they can enter the vital sign and add it manually."
    NOT BUILT. Needs a design question first.
180. **Allergy reminder.** (2026-11-11) "The statement to click no allergies
    should be removed, but the warning leave it there, because it is
    important. Tell them: remember to ask patients for allergies." LIVE: the
    amber banner now reads "Allergies not recorded yet. Remember to ask the
    patient about allergies." The tick "No known allergies" is still inside
    Blood group and profile > Edit (Background.tsx), where he could not see
    it.

176. **Lab result entry: choices and numbers, from the lab's template.**
    (2026-11-10) "The lab also said the lab results for entering results is
    not fully built, that there are certain things he doesn't have to type
    manually. That some things are options he needs to choose from and then
    enters numbers on some. But he promised to send me the template. So take
    note for when the template is sent so we work on it."
    WAITING FOR THE TEMPLATE from the Laboratory. Today the result screen
    (web/app/lab/result) takes free text per test. When it arrives: list each
    test with its fields (a choice, a number with its unit and normal range,
    or text), then ask him to confirm before building. Nothing built yet.

175. **Everyone gets their own notifications; the master account is renamed.**
    (2026-11-10) "The notifications meant for front desk or lab or pharmacy
    should not be showing bubble on another person's account... if a patient
    is sent to the doctor or room, the room receives notification... lab
    knows when payment has been made so they proceed... Admins should not
    get bubbles that belong to pharmacy, lab or front desk; if the admin is
    also a doctor or nurse they get that role's." And: "change the name of
    the doctor Evans with this email rhemamedical7@gmail.com to Master
    Account." Also: "yes, record emails SQL".
    BUILT: notifications follow the ROLE (payments: Front Desk only; admin
    gets none of the Front Desk, Lab or Pharmacy ones); Lab and Pharmacy are
    counted only once PAID (so the chime and bubble come at payment); a new
    notice "N patients are waiting at <room>" for doctors, nurses, matron,
    Lab and Pharmacy. Migration 20261110154435_rename_master_account (data
    only, by email). Migration 20261110151018_record_emails (approved).
    His next words: "just leave the charts and the details in home page.
    But if admin is also a doctor or nurse or matron, let them see in the
    home page what's more urgent and important before any admin related
    information." Then his CORRECTION: "The patient queue sits below the
    charts... it's okay where it is normally. The things that pertain to
    admin come later at the bottom... Admin office only gets the things of
    admin." DONE: Home order is the same for everybody (counts, chart, queue,
    Lab, Pharmacy). An admin who works in a consulting, nursing or matron's
    room (worksWithPatients, lib/auth/roles.ts), and a doctor/nurse/matron
    who is also admin, gets the room's four buttons at the top (an admin
    gets the doctor's set), Call in / Finish visit, the waiting-patients
    notification, and the admin buttons (Invite staff, Announce) LAST. An
    admin in the Admin Office gets only the admin's Home. Lab and Pharmacy
    payment cards unchanged.

173. **Refresh in the menu, Back steps back, old file needs only a name.**
    (2026-11-10) "The refresh spinning button... should go to the side bar,
    blue background, only that button... only for desktop. Back should not
    take me to the home dashboard, but to the previous page." LIVE: Refresh
    is the blue button at the bottom of the menu (760px and wider), gone
    from the top bar and from phones; Back uses a flag kept outside the
    shell, because each screen mounts it again and the old flag always
    said "first screen", so it always went Home.
    "In register from old file, allow submit even without date of birth or
    phone number... name is enough, the rest says (optional), including the
    attachment of file." BUILT, NOT LIVE: page and code done and checked;
    needs migration 20261110130716_old_file_without_phone (loosens the rule
    patients_details_or_old_file: an old file patient no longer needs a
    phone). His yes: "please work on it... merge to live" (2026-11-10), taken
    as the yes to the batch he had been shown.
    LATER 2026-11-10: Refresh smaller; Notifications (bell, with the count)
    in the menu beside Messages, on desktop and the phone's bottom bar;
    "Send to room" (or "Move to room") on each Find patient result card,
    opening the same form under the card, no need to open the patient.

170. **Antenatal booking form, from the hospital's paper card.** (2026-11-09,
    photo of the card) "The matron said these information have to be
    there including the one written at the bottom with pen, for consent.
    Like a consent box." The card: P.H.C. DATA; Next of kin (name, surname,
    relation, occupation, religion, level of education, age, phone, tribe);
    Route (routine) test (PCV, RVS, blood group, genotype, hepatitis B,
    hepatitis C, urinalysis, RBS/FBS, H. pylori, PT); Previous pregnancies
    (date of birth, duration, birth weight, method of delivery, sex; the
    card shows two); number of abortions, miscarriages, total pregnancies,
    parity; Baby if death (age at death, cause, living/alive); Consent form
    for an operation (name, operation, relationship, address, date,
    signature, witness, date, signature); handwritten: "Would you like your
    delivery to be documented? Yes / No". Plan and questions sent
    2026-11-09; WAITING for his answers (it changes what patient data is
    kept, so it needs his yes under the NDPA).
    HIS ANSWERS 2026-11-09: "yes to all" (one Antenatal booking section in
    the record; tests with result and date; any number of previous
    pregnancies; baby if death on its pregnancy; extra next of kin
    details; religion, tribe, education confirmed). "Documented means
    photos and video." Signatures: "no signature, you can put a checkbox to
    serve for the signature, including name and date." Consent form: "any
    patient should have one." To build (SQL shown first).
    BUILT 2026-11-09 on the feature branch: migration
    20261109170525_antenatal_booking_and_consent (4 tables + the dispensed
    notice column and function), 6 tests, 7 deliberate breaks caught; the
    record shows "Antenatal booking" for antenatal patients and "Consent
    for an operation" for every patient; doctors get "dispensed" notices,
    cleared by opening the record. HIS YES 2026-11-09 ("yes, antenatal SQL").
    LIVE 2026-11-09: testing and live databases took it, 0 security
    warnings on both, deploys and checks green.

169. **A chosen patient opens on its own screen, with their files.**
    (2026-11-09, phone photo) "When you click on a patient... why does it
    open on that same screen?... it should open a new screen... What if the
    names are plenty?" And: "If I am a doctor, I should be able to see the
    document. If I am front desk and I'm the one who uploaded the document,
    I should be seeing the documents." Built: tapping a result opens the
    patient alone ("Patient", Back to search, the phone's back works too);
    the patient's files show below the details (preview; attach; delete
    only by the uploader on an old file patient, as decided on 2 Nov). The
    database already let the patients tick and the opened record read them;
    only the screen was missing them. Same on every screen size.

168. **www.rhemamedical.app redirect.** DONE by him 2026-11-09 in Cloudflare
    Redirect Rules. His first rule used a wildcard (*.rhemamedical.app/*),
    which also sent testing.rhemamedical.app to live; he changed it to www
    only. Checked: www (with path and query) 301 to rhemamedical.app;
    testing and live answer 200 on their own.
    workers.dev: on his word ("go ahead with the workers.dev redirect"),
    every screen opened on the old workers.dev address moves at once to the
    real one (same screen, same address after it), live to rhemamedical.app
    and testing to testing.rhemamedical.app. /api/ on workers.dev still
    answers, for the deploy checks.

165. **Adding a family member: the category is the family, with Change
    category.** (2026-11-09) "Because this person is already a family...
    the only thing that can be there is change category... change category
    to individual or antenatal. Once that category is changed, every other
    thing concerning contact, address... can just clean off, the payment and
    the rest just refreshes. It becomes a fresh registration. But the
    person can still keep their old family member records... It will
    maintain family and then still maintain individual or antenatal."
    Built 2026-11-09: the form shows "Family FAM-..." with Change category;
    Individual or Antenatal clears contact, address and next of kin, hides
    the family's payments, and asks for the card fee; family_id is kept.
    "Keep in the family" puts the family's details back.

164. **White secondary buttons must look like buttons.** (2026-11-09,
    photos of the receipt and Find patient) "Those secondary buttons that
    are white... put an outline, blue outline... a white button on a white
    screen, it's just looking like you just wrote a text... all the buttons
    should look like buttons, especially the flat ones, excluding the ones
    that already look like 3D." Every flat white button app wide gets a blue
    outline and blue words (like Register from old file). DONE 2026-11-09:
    every base .button in 9 screen styles, plus record, offline and alerts
    buttons; primary, danger and the raised 3D ones unchanged.

163. **iPad: the lock (idle) screen leaves a white strip at the bottom.**
    (2026-11-09, photo) "This blue cover is not covering completely... The
    white part is showing at the bottom... peculiar to iPad and maybe Mac."
    FIXED 2026-11-09: the lock screen and the starting screen now use the
    screen's full height (100lvh), not inset 0. NOT enough: his photo still showed the
    strip in the installed app. Real cause: the installed app draws under
    the clock bar (black-translucent), so about 24 points at the bottom
    show the html background. Fix: CanvasColour paints the html background
    the cover's colour while a cover shows. Also (his Android): the phone's
    own start screen showed a square logo; the launcher icon (maskable) is
    now the round logo on navy, and the icon addresses carry ?v=2 so
    Chrome refreshes them. A reinstall shows it at once.

161. **AWS watcher, without GitHub for now.** (2026-11-09) The first stack
    failed: the account is on AWS's Free plan, whose service control policy
    denies iam:CreateOpenIDConnectProvider (the GitHub login link). His
    choice: "my card is not really with me... we just go to option B. Then
    maybe before another hospital, I would put my card." So the template
    has GitHubDeploy (default no) and he uploads watcher.zip (aws/
    make_zip.py) in the Lambda console. Region eu-north-1. Alerts to
    stellaxafe@gmail.com. Later, on the Paid plan: GitHubDeploy yes.
    DONE 2026-11-09: stack CREATE_COMPLETE, watcher.zip uploaded, test run
    in AWS answered "Rhema live" ok: true, email subscription confirmed.
    It now runs every 5 minutes. (Request 74 is live.)

160. **Adding a family member inherits the family's details.** (2026-11-09)
    "The contact that you've already filled before should be a family
    contact... next of kin, you don't have to fill it again... the next
    family member should inherit most of those data. The only different
    thing is the biodata... Let the front desk be the decider... they
    should see the payment that was previously made by that family. Then
    you can add the payments." Built 2026-11-09: the form starts with the
    first member's phone, email, address and next of kin (editable), the
    biodata empty; the Payment card lists what the family has paid and the
    new payment stays optional. 2026-11-09 his answer: "Yes if changed to
    individual": a family member changed to Individual must pay. Built
    2026-11-09 on Edit patient: the Payment section shows only for that
    change, the card fee is required, and it is paid before the change
    saves (checked: no fee refused; with a fee, payment then update).

159. **Receipt: send by email, a receipt number that looks different, and
    alignment.** (2026-11-09) "When a patient receipt is being printed,
    there should be an option for sending receipt to email... If the person
    actually dropped their email, then it shows that option... the
    infrastructure that we used for invitation... By the time you just
    click on it, it sends to email automatically. Also, check the receipt.
    The alignment of text... where the patient number is written is a bit
    drifted... make receipt number to look significantly different. You
    know how bank transaction numbers used to look?" (Also item 14 of the
    6 November list.)
    Built 2026-11-09: "Send to email" beside Print, only when the patient
    has an email; the Worker (worker/src/receipts.ts) reads the payments as
    the staff member and sends to the email on the patient's record only
    (10 tests). Receipt number shown bank style: the day paid and the
    number in groups of four (RCT-000123 paid 9 Nov 2026 -> 2611 0900 0123),
    in its own box; the stored number is unchanged. The two columns now line
    up with the right edge.

158. **Start screen navy, rooms option A, no refresh button.** (2026-11-09)
    "Why change the app's loading screen to white instead of making the
    logo circular and letting the edges blend well with the blue
    background." "For options on rooms, A is okay." "Since the app now
    refreshes itself, there may be no need for the spinning refresher in
    the top bar, right?" Start screen: icon-192/512 are now the round logo
    with clear corners (the maskable launcher icon is unchanged), the
    phone's start colour navy again, the app's starting screen navy with
    the same round logo. Refresh button removed. Rooms A: built on the
    feature branch (office room kind, Admin Office room, room required when
    inviting, admin picks the Admin Office by itself). HIS YES 2026-11-09
    ("yes, rooms SQL"); on testing, 0 new warnings.
    Same message: "hope the updates aren't going to be disturbing people...
    someone is typing name and all of a sudden the screen refreshes and
    clears what they were doing?" Checked every live update: they swap the
    data only, no form is cleared. The one risk (a new version reloading
    the app when it comes back) now waits while anything is typed.
    AWS: the console opened in eu-north-1 (Stockholm) with no Ireland
    choice shown, so the watcher goes to eu-north-1 (aws/target.json).
    Ticks (2026-11-09): "the double mark... the second mark is usually on
    top of the first one... just like on WhatsApp." Drawn now: the second
    tick starts inside the first. Checked on screen.

155. **What is left, and a quick pass before handover.** (2026-11-08)
    "Apart from the what else is left? Also do a quick pass for both
    buttons and screens. Check anything missing, any step ignored from a
    process or any button that was forgotten or anything broken or left
    unfixed and also the security of the platform."
    Done 2026-11-08: layout check 26 screens clean; 138 buttons pressed,
    none broke (the "changed nothing" ones are options already chosen, or
    Home tiles that scroll smoothly, proved by a scroll test). Security:
    npm audit 0 in what ships (8 moderate in lint tools only); database
    advisors 0 new (Supabase check run 42407659217, both projects). FOUND
    and FIXED: no browser security headers at all (CSP, HSTS, nosniff,
    referrer, permissions, no-frame); added and proved on testing with a
    real sign in request. FOUND and FIXED: CARDS_PAUSED still true (109),
    turned off, cards walked on iPhone, Android, desktop.

### Closed 2026-11-26 on his answers

238. **The lab sets a test price, the doctor approves.** (2026-11-22)
    "sometimes the lab scientists do set price for tests so the doctor can
    approve". Said back to him how it would work; waiting for his yes. Not
    started.
    HIS ANSWER 2026-11-22: "yes, (a), wait for the doctor". So: on one
    patient's lab request with no price, the lab scientist types a price per
    test; the doctor who asked sees "Price from the lab" with Approve or
    Change; the Front Desk takes payment only after the doctor approves.
    And, same day: "The pharmacist sets price of drugs. They don't set price
    of tests. The lab scientist sets price of tests. They don't set price of
    drugs. But the nurses, the front desk, they see the price. Who can edit
    and set price? The doctor or the matron, anyone with a consultant room.
    Then for drug prices, the pharmacy can set price, but they still need the
    doctor to approve it. If they ever set price, they need the director to
    approve... in this case, they don't actually set the price. It's the
    doctor that sets the price. But the lab scientist sets price because the
    lab scientist is the one that does most of the price, and then the doctor
    approves as it is designed."
    OPEN QUESTIONS asked 2026-11-22: (1) today "doctor or matron" is by role;
    should it be "anyone with a consultation room" instead? (2) the Pharmacy
    drug price: doctor approves, or the director (admin) approves, or build
    nothing for the Pharmacy now since the doctor sets drug prices?
    NEXT after part 3 (bills).
    HIS ANSWER 2026-11-22 (after bills went live): "the front desk should
    not wait. most times the front desk already knows the price, and the
    front desk can also edit the price set by the doctor. A set price only
    acts as a suggestion not a blocker or a must." So for 238: the lab's
    price shows to the Front Desk at once as a suggestion; the doctor's
    Approve or Change is still there. See 239 for the Front Desk editing.
    CLOSED 2026-11-26, his word: "the system should learn the test price." It does today: a doctor or the matron who types a price is asked to make it the standard (236), and a lab price becomes standard after 72 hours (208). The Front Desk sees it filled in and can change it (239). When the hospital gives a price list, it goes into Admin > Prices.

218. **Go ahead with the proposal, Next.js, backups, and the whole flow.** (2026-11-16)
    a. Live read allowed: "you have my permission to check the live database"
       for why the doctor cannot write in consultation notes. He thinks the
       doctor can see them in a consulting room, "it's just that... I can't
       write freely normally."
    b. "Your proposal is good. I think you should go ahead with this." (217c,
       points 1 to 6.)
    c. Next.js: "check and make your plan on what update you want to do...
       whatever fix that we need to make to keep everything running smoothly
       and not to get any error messages and not to allow the system to break
       at usage. So let's make those fixes."
    d. Backups: "check it again... that nothing goes away, nothing misses,
       nothing is lost."
    e. The whole flow: "how the front desk enters data, others send to room,
       others get it, like the entire flow from one department to another...
       look into those platforms (OpenMRS, Bahmni, Epic)... the pharmacy as
       well, the population of the medicine, the arrangement, the lab as well
       ... areas where our own look simpler and better, we keep. Where their
       own seems better, we make adjustments... put all the plans together."
    STATUS (2026-11-16, night):
    a. Done. Live read: the director's account is a doctor in Consultant Room 1,
       kind consultation, so he could write; the fault was placement and names.
    b. LIVE: the four boxes with tap words, medicines to the chart, Send to the
       nurses, the medication chart (Given, then Yes), the summary, the plan
       banner for nurses, each role's work first, Visits by day. No SQL.
    c. LIVE: Next.js 16.4.3 to 16.4.5. typescript-eslint 8.73.0 (clears a
       dev-only minimatch notice) was published 2026-11-16, so it waits a week.
    d. LIVE: the backup now proves every counted row is in the copy and every
       live file is in the backup; a run by hand passed on live. FOUND:
       GitHub starts scheduled runs hours late or not at all (the 01:17 run
       came at about 08:00; 0 of the 2-hourly runs started in 9 hours).
       Proposed fix waits for his yes and a token: a Cloudflare Worker timer
       (free) that starts the backup every 2 hours.
    e. Research done, the whole-flow plan sent to him. WAITING FOR HIS YES.
    CLOSED 2026-11-26: e, the whole-flow plan, was built as 219c (all 6 live); d, the Cloudflare timer, is live (219a, confirmed in 222).

217. **Download our data, a review of today, then simplicity.** (2026-11-16)
    a. "Download our data: if you've checked it and everything checks out,
       then you go on with it."
    b. "Go through what you've done today in the last 24 hours... one after
       the other. Check anything that is not in order, anything that drifted...
       anything we've not run the SQL, then correct it."
    c. Simplicity: "when it comes to inputting data, the steps they follow, the
       arrangement seems to be a little bit cumbersome... look at how other
       tools designed it (Swift, Helium, Neon, the US and India ones)... profile
       a restructuring... so that the consultation notes, every section they
       are working on... how they enter patient data, how they check patient
       medical history, everything is seamless... both the doctors and the
       nurses. After we do it now, it becomes easier to sell to other
       hospitals."
    The director's voice note (transcribed by Anthony): in his consulting room
    "there is no proper place where I can write my medical findings... where I
    can write the patient's symptoms, examination findings, then diagnosis,
    then treatment plan... The only place I saw there is notes... my clinical
    patient history... a place for patient's review, another for treatment
    plan, so that when I forward it to the nurses... they will follow the
    treatment plan." Nurses: "medication, the time given, the nurse that gave
    it, the dose... like a column... something like a spreadsheet where they can
    record... so-so drug given at so-so time, so-so dose by so-so person. So
    that any person that comes around will see it." Picking drug, then
    milligram, then dosage to record a dose "will more difficult".
    STATUS: a. LIVE 2026-11-16 (Admin, Data tab; migration 20261116201525,
    test 046; checked with made up data, ZIP opened, wrong PIN and cancel
    checked). b. Done: all 13 of today's migrations on both databases, 0 new
    warnings; fixed the emailed record missing note titles (LIVE). c. Research
    done, proposal sent to him, WAITING FOR HIS YES before building.
    Also asked: Next.js shows a moderate security notice (16.4.3, fix is a
    small version bump; does not touch this app, which is static). Waiting
    for his yes to bump it.
    CLOSED 2026-11-26: c was his yes in 218b and went live then; the Next.js bump went live in 218c.

201. **Profile, and the go ahead on Settings and the demos.** (2026-11-16)
    "You can always go ahead with the settings the way you have described it,
    one at a time." "What about profile?... they can, maybe put their profile
    picture if they want to... cap it at maximum 500 kilobytes... the system
    automatically strips the picture and reduces the size until it's below 500
    kilobytes. If you can't get below 500 kilobytes, the system rejects it...
    other things for their profile, if at all is needed... if it's not needed,
    you can scrap that." Demos: "I think StellaXafe is better... we'll use my
    StellaXafe account... arrange it in a way that I can easily delete them...
    after a month of pitching a hospital and no response, I can delete it...
    check that Cloudflare can accept as many demos as possible, or maybe if we
    have built up to 20, we can delete some older ones... so Cloudflare
    doesn't charge us money." He will set the demos up with me when he is back,
    with the lab list. "After you check everything checks out, you can run the
    SQL and give me the reports. Make sure everything passes on CI before
    running the SQL."
    DECIDED: Settings goes into Admin, one part at a time (hospital details and
    prices first). Demos on the StellaXafe Cloudflare account, not Vercel.
    BUILT 2026-11-16: Settings part 1, the price list (migration
    20261116072103, test 040, Admin > Prices). Profile picture NOT built:
    a staff photo is new personal data (NDPA), so it waits for his yes on the
    plan in the chat.
    CLOSED 2026-11-26: Settings part 1 (prices) is live; the profile picture is cancelled, his word: "The profile picture, cancel it. 201, no need for it." The demos carry on under 198.

199. **Only the biodata is compulsory.** (2026-11-16) "None of them is a
    compulsory detail... The only details that are compulsory is the biodata,
    which is the patient name, phone number... the things that the front desk
    enter... Every other detail is not compulsory, whether medical records...
    They can enter whatever they have and save... Register from old file... it
    is only the name that is compulsory."
    CHECKED 2026-11-16: medical record forms save whatever is filled in (each
    only refuses a completely empty line, such as a medicine with no name).
    Register from old file needs only the name. OPEN QUESTION for him: a new
    patient today needs name, date of birth and sex (his rule of 2026-11-10,
    "for the new patients, it is needed"); phone is optional, because children
    in a family may have none. Change to name and phone only? Not changed.
    CLOSED 2026-11-26, his word: "They're already there now. It's already built. The name, date of birth... they're already using it, so no need for it." Kept as it is.
