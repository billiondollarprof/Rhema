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
