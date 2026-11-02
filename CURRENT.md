# CURRENT

Where the RHEMA Hospital Operations System stands. Read this first.
`SESSIONS.md` is the log behind it, and `PLAN.md` is the plan.

---

## ANTHONY'S OPEN REQUESTS

**Read this before anything else in this file, and add to it the moment he
asks for something.** A request moves to `docs/DONE.md` when it is live
and checked, not when it is planned. (Rule from `CLAUDE.md`, section 1.)

### Open

Numbers are kept from the full list, so older notes still match.

5. **Is Cloudflare's free 10 GB per account or per project? If per
   account, move the domain to a new Cloudflare account for the hospital.**
   Answered: per account, so yes, new account, and the move is supported.
   The move itself is still to do. `PLAN.md` 3.
9. **PWA first; later maybe a very light desktop app, with a free place to
   download it from.** Planned in `PLAN.md` 9.
12. **Use a little AWS, something free, to add a cloud stack.** Proposed:
    a Python uptime watcher on Lambda. `PLAN.md` 7. Waiting for his yes.
16. **Find free open skills on GitHub, save copies in his own GitHub, and
    create our own skills, including ones learned from StellaXafe.**
    Planned in `PLAN.md` 10. Not done yet.
22. **REMIND HIM: "we are probably going to create a private repo that
    will not carry code but will carry credentials. That will be later, so
    you will remind me."**
26. **Notifications on the installed app**, with vibration, and an
    emergency "call attention" alert that vibrates stronger. Calls later,
    not now.
27. **Email address admin@ on the hospital domain.** He says the domain is
    remamedical.app (no S, .app). Spelling to be confirmed against the
    hospital name RHEMA.
29. **Later, possibly: bundle as a desktop app and a mobile app** (Tauri,
    Capacitor), since the UI already fits any screen.
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
41. **Quick revert for any change**, **security from day one**, **checks
    before every pull request**, **skills for repeated tasks**. Rules in
    `CLAUDE.md`. Still to build: the rollback workflow, the advisor check in
    CI, the dependency audit in CI, and the first project skills.
42. **Idle screen seen live on his phone: "the animation is good, almost
    unnoticed though."** Asked whether he wants it a little stronger.
43. **Later: replace "Server: Ready" with "Powered by StellaXafe
    Technologies Limited"**, as free marketing. Do it when the sign in
    screen takes over the root address (the server status then moves to
    the smoke test only).
44. **RH logo stays a stand in** until the hospital sends its real logo.
    (2026-10-30: replaced by the logo cut from the letterhead, request
    114. A clean original file from the hospital would still be sharper.)
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
62. **Later, not now:** scanning a paper document and the system reading
    it, once the hospital has a scanner. Propose it then.
63. **Later, maybe:** voice notes that turn into text, reusing his church
    speech to text work (the Bible display project) once it works well.
    Possibly with AI to help write the records. Undecided.
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
74. **AWS account.** He is checking whether he already has one, then
    opening it. Guide him through the AWS piece when he says it is ready.
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
82. **Email inside the app for the admin.** "In the announcement section,
    they can have another place where they used to type in their email and
    send out email... and receive email as well... the admin can be seeing
    email there... and be replying from there", from the hospital's own
    address, without opening Gmail. Possible with Resend (sending and
    receiving). Build after the domain move and Resend (6 Nov).
87. **Keep awake: Cloudflare and other platforms.** He asked whether the
    Cloudflare timer expires, whether it does the same job as GitHub, why
    keep both, and said to use the same principle for Amara and
    StellaXafe "so the platforms never sleep". Answered: Cloudflare Cron
    Triggers do not expire and are free; same knock; GitHub kept as a
    second line. Build the Cloudflare timer with the Worker jobs; then
    offer the same for Amara and StellaXafe (their own repos).
88. **Public version for employers.** "We are going to do the public version
    of it... connected to... the live testing one in Supabase, or what? What
    is actually your plan?" Answered: never the hospital's testing
    database; LICENSE says this project's backend belongs to RHEMA, so the
    code itself is not published without the hospital's yes. Plan offered:
    a public demo site in StellaXafe's own accounts with made up data, plus
    a case study. He said (2026-10-29): "Just leave it for the public
    version for employers. It's okay. Just note everything down." Parked
    until he raises it again; the plan above stands.
89. **Same system for another hospital in 2 to 3 days.** "It will just be me
    creating a new Cloudflare account, Supabase account, and within 2 to 3
    days everything is already working." Everything is in the repo
    (migrations, workflows, checks); only the IDs and secrets differ. To
    write: a setup checklist and one place for the IDs, so a new hospital
    is a copy plus new secrets.
92. **Download all the hospital's data.** "If the hospital want to download
    their data to their entire data, it should be there." An admin only
    export of every table, with the download itself written in the
    activity log.
93. **Scans and other raw files.** "Ultra scan materials... store them
    inside Google Drive... with their names... easy to pull out." He also
    asked about Google Cloud's free 5 GB. Answered in chat: GCP's free
    storage is 5 GB held at any one time (not a fresh 5 GB each month),
    only in US regions, needs a billing card; Drive and GCP both put
    patient files outside Nigeria and outside the database's access rules,
    which the NDPA frame says he must decide on. Planned R2 (10 GB free in
    the hospital's Cloudflare) remains the default until he decides.
98. **Weekly digest: email, plus a notification in the app and on the
    phone** (with sound), opening the digest in the app. (2026-10-29)



109. **Pause the install and alerts cards until handover.** (2026-10-30)
    "I can't use the link to log in... it will open the default browser,
    and the default browser is Safari... I think we should pause the ask
    for now. Then... before we hand over to the hospital... we can now
    bring it back... I'll just use code to log in instead of the link."
    Done 2026-10-30: CARDS_PAUSED = true in OnboardingGate.tsx.
    HANDOVER LIST: set CARDS_PAUSED to false once sign in uses the 6 digit
    code (Resend, 6 November), and walk the cards through once more.
    HANDOVER LIST (6 November, with Resend): put the sign in code wording
    (supabase/templates/magic_link.html) into BOTH hosted templates, "Magic
    link" and "Confirm signup", because an invited person's first code
    comes in the Confirm signup email. Then send the invitation and the
    "your account is back on" emails through Resend (request 112).
113. **HANDOVER LIST: delete the test accounts once the hospital is up,
    but keep his own account as a master account** "that I can use
    remotely to be monitoring... during debugging." (2026-10-30) Needs a
    plain word with the director, because that account can see patient
    records (NDPA).

118. **Storage use and charging when one card pays for every client.**
    (2026-10-31) "Is there a way for me to automatically track how much
    each person uses without opening Cloudflare?" Plan: tell clients they
    get 20 GB free (10 GB live, 10 GB backup), alert when they pass it,
    then charge 30 cents per 10 GB against Cloudflare's 15 cents. Answered
    in chat; a usage watcher is to be built when a second client comes.

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

123. **Why are Pharmacy, payments, messages, notifications, announcements
    and printing not built?** (2026-10-31) "Why did you not build pharmacy?
    Why did you not put the payments?... notification and the messaging...
    Printing documents. What does it take to do it?... Do you need another
    code? Do you need another access code?" Answered: nothing is missing;
    they are the next steps of the build order; no new key is needed
    (emails wait for Resend on 6 Nov). Proposed order: Pharmacy with drug
    payments, then the other payments with receipts, then messages,
    notifications, announcements, printing. His answer (2026-10-31): "do
    pharmacy with drug payments now. And then after you're done with it,
    then you follow it with other payments with printable receipts...
    the receipts, you can also either print it or send to email as well...
    Then later we can work on messages, notification, announcements, and
    printing. So if you can do this too today, no problem." Pharmacy said
    back to him the same day. His answers: "let the app always work out
    the total, the front desk and the lab, they should be able to type in
    their price. For now, they are typing in manually before later we
    might now do API." Stock: "You can leave that out... no need." "It's a
    hospital, so the doctor prescribes." (Doctors only. He did not ask for
    a dispensed alert, so none: no alert spam, request 58.) So the Front
    Desk types a price per drug and per lab test, and the app adds them up.
    Pharmacy with drug payments: done and live 2026-10-31 (his yes on the
    SQL batch the same day; testing and live both 0 security warnings).
    Still open under 123: other payments with printable receipts (print,
    or email from 6 Nov), then messages, notifications, announcements,
    printing.

127. **Attachments on every patient record, auto fill from a scan, and a
    download choice.** (2026-10-31, from the client meeting) "the doctor
    was saying that every patient they open profile for, they will be
    attaching files like the document or scan. So they don't have to write
    everything by hand... he was saying something about creating profile
    for all the patients they had before... if they are able to scan it
    cleanly or use good camera, snap the file, upload it, then the system
    automatically fetches the data that it recognizes, like name, phone
    number, the important data, and populates the record, especially
    biodata information... every patient's record can carry attachments...
    they can click attach, then it will prompt their computer, they'll be
    able to upload a document... later, if they want to download the
    patient's medical history, they can download the entire thing or
    download only the file. So when they click download, it will now ask
    them whether to download the full medical history or just the
    attachment, if there's an attachment." Three parts:
    a. Attach: any record takes files (photo, scan, PDF) from the computer
       or the camera, kept on the record (same safe store as lab files).
    b. Auto fill: upload a scan of an old card or form, the system reads
       name, phone and the other biodata, fills the registration form, and
       staff check it before saving. For bringing in the old patients.
       Needs his decision before building: reading the scan means sending
       patient data to a reading service, which is a data protection
       question (NDPA) and may cost money (CLAUDE.md section 2).
    c. Download: a Download button on the record asks "Full medical
       history" or "Attachments only" (the second only when there are any).
    Recorded; not started. Say back to him before building.

128. **Old patients, attachments, family profile, poor network; migration
    later.** (2026-11-02) Replaces part b of 127: "Let's ignore the OCR
    for now... Let's forget about API and OCR for now."
    NOW, for this hospital:
    a. Attachments: "we can attach a document like scanned a patient scan,
       ABI ultrasound scan results and other stuff. And you can also attach
       normal written documents." "yes we can attach and download files."
    b. Register by document, for the patients they already have: "There
       should be another button there that should say register patient by
       attachment... or register patient by raw document... they will just
       put the patient name, the full name and the phone number. Then they
       will now upload the patient's documents there." Old card numbers are
       not used. "let it be one by one because if I allow them to upload
       back then papers, they'll just fill up the storage fast."
    c. Find by name or phone: "in case you have two people with the same
       name, they will not have the same phone number."
    d. Family profile: "You register the mother, and then since you have
       toggled family... it will show you add family, add member... you
       don't have to first of all save the person detail before adding
       family members... Anybody from the family can make the family
       profile pop up." No family last name needed. (Today "family" is only
       a category label; there is no family group yet.)
    e. Download (from 127): full medical history or attachments only.
    f. Poor network: "front desk should be able to click register a
       patient... click save, and if the network is poor, the system should
       say so, that patient is registering, and that they can continue
       doing other things... saves whatever it is as a draft. Then when the
       network is back, the system just automatically push it to server."
       Search and open records with poor network: "those texts for each
       patient... preloaded... since it's text... I don't think there's any
       need to leave anyone out. So I need you to evaluate that." Attached
       files load over the network; shrink them on upload "while
       maintaining the quality" (as in Amara) so they open on little
       network. "we are designing for the worst-case scenario of network.
       And we are also designing to manage space."
    LATER, not this hospital (record only):
    g. Messages ticks like WhatsApp: one tick sent, two ticks read; for a
       group, two ticks when everyone has read. Part of THIS build, with
       messaging (his correction, 2026-11-02).
    h. Migration for hospitals leaving other software: import their CSV or
       Excel export (typed, so no OCR), map biodata and the important
       medical records to our layout; keep their own ID pattern; where only
       an age is given, store the age and the date it was taken so it grows
       each year; or pull through the old system's API or webhook. "in less
       than a day with few clicks of a button." "if there is a better way
       they used to do it, you can do a research and then recommend."
       Selling point: own the system, stop paying per patient.
    i. Batch upload of scanned papers: not now (storage).
    j. OCR auto fill: not now (mostly handwriting).
    Mapped back to him 2026-11-02. His answers the same day:
    - Order yes: (1) attachments, Register from old file, download;
      (2) family profile; (3) poor network; (4) receipts; then messages.
    - Button name: "Register from old file" ("So they know it's their old
      file").
    - Files: shrink what can be shrunk, keep quality; "just allow them to
      upload. If they finish the space, they will pay for more space."
      No personal photos are wanted in the system ("use their Google
      Drive"). Limits proposed: 10 MB a file, 5 files at a time.
    - Family: "one family will have one card number for all of them...
      they can use one card number to even search for the family". A
      family member who later opens a personal profile gets their own
      number. Needs a database change (patient_number is unique today).
    - Network: "anything... that is going to slow the system down, keep it
      in the server... we don't want a complex system to manage." Keep on
      the device only patients whose details changed in the last 30 days.
      Registration drafts are fine. Device copy is allowed (his yes).
    - Messages are part of THIS client's build (with ticks), only the
      migration (h) is later.
    - He asked for a quick search on how other platforms migrate data.
    His answers 2026-11-02 (second message), "yes to both, go ahead":
    - Limits yes: 10 MB a file, 5 at a time. Pictures and PDFs are picked
      with separate buttons. Pictures shrunk to WebP (same method as in
      Amara). PDFs open in the app to read where the browser can, without
      downloading first.
    - Every patient gets their own RMC number, old file ones too.
    - Device copy: text only, never files or pictures; only patients with
      any change in the last 30 days.
    - Notes and vital signs with no network: "The thing should show that it
      has not saved. But let it save." So they wait on the device, marked
      not sent, and send when the network is back. (Two people do not
      update one patient at the same time.)
    - Receipts summary right; a receipt can be printed or sent again any
      number of times, and updates when the patient pays more.
    - Import templates: later, when ready.
    - He asked for Helium Health's public pricing (per year, per patient,
      setup and training).
    - Button words (2026-11-02): "Add scan or photo" and "Add PDF file";
      PDF only, so a Word document is saved as PDF first.
    - "make sex and age optional, they can add or skip it" (old file):
      optional date of birth and sex; skipped shows "not recorded".
    - Keep every screen clean, no more words than needed (CLAUDE.md 7).
    Step 1 (attachments, Register from old file, Download) live
    2026-11-02, his yes on the SQL; testing and live 0 security warnings.
    Adjustments asked 2026-11-02 (after step 1 went live):
    - "The register from old file button doesn't look like a button...
      let it look like maybe another kind of protruding 3D button, just
      like you did the buttons in the home screen."
    - "a file that I upload, I can't click on it to preview it... it
      should have a little preview... to check whether what you uploaded
      is the correct document." (PDF text reading: "don't worry, just the
      preview will be okay.")
    - Old file patients get a faint mark: "something that just says from
      old file, a little bit faint, like a watermark... when you open their
      profile."
    - Category on Register from old file: "pointless selecting family or
      individual in this case. During edit, they can decide." Name and
      phone only (date of birth and sex stay optional).
    - On Edit patient, "anybody should be able to see the files that were
      attached to that patient... They can preview it, but they can't
      delete it" and cannot download. "Only allow the person who uploaded
      to delete the file", a real delete (frees storage), with a red
      warning first, and "this is just for only the register from old
      file... because they have a backup". Not even the admin may delete.
      Every other file is still only crossed out with a reason.
    - "make me a doctor": done 2026-11-02.
    NEXT after these: step 2, family profile (one card number for the
    family).

### Standing instructions

These never come off the list.

15. **Work as experts in DevOps, cloud and cybersecurity, using every free
    resource.** Standing instruction.
20. **"We are going to actually rush this thing. So we only have about 2
    weeks."** The 8 week timeline in `PLAN.md` 12 is replaced by 2 weeks.
28. **Agents get API tokens through GitHub secrets, never through the
    chat.** Some setup he does by hand so he learns the platforms.
34. **Aim: app built within about 10 days, test runs and small fixes after,
    then plug in email and install.** No need to wait for day 14.
73. **Show him the Cloudflare side as it is built.** "As you are doing it,
    you can still be directing me to go and be looking at the backend,
    where to go to see what you've done": for each Worker function, R2
    bucket and setting, say where in the Cloudflare dashboard to see it.
75. **Keep teaching the Python.** "Any new Python code you write, you help
    me so I can still know it... I really liked that one." Standing rule,
    already in CLAUDE.md; he asked for it to continue.

### Decided

- 2026-10-31: One AWS account for the company (StellaXafe), not one per
  hospital, for the uptime watcher across all clients. "I just wanted to
  open this one on my own company's account." A hospital gets its own AWS
  account only if it ever stores data there and pays for it.

- 2026-10-30: Invites use option A: Supabase "allow new users to sign up"
  is on, and a database rule refuses any new email without a waiting
  invitation under 72 hours old. No server key anywhere. He switched the
  setting on himself the same day, on both projects (screenshots of
  Rhema-testing and RHEMA MEDICALS). He said "yes, run the batch" for the
  staff_invites migration the same day.

- 2026-10-30: Backup goes to a second Cloudflare account, not Google
  Drive. "I think second Cloudflare is better than Google Drive for
  backup." Not ready yet: AWS and the second Cloudflare account.

- **One chat, not a new chat per feature.** (2026-10-29) "I don't want to
  be using new chats. I want to be doing my work in one chat." CLAUDE.md
  section 1 changed to match.

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

- 2026-10-31: Lock screen after 1 hour without use, not 10 minutes. "We're
  going to extend the idle lock screen time to 1hr because of network
  connections, so they don't get locked unnecessarily."

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
