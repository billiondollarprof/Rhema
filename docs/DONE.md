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
