# CURRENT

Where the RHEMA Hospital Operations System stands. Read this first.
`SESSIONS.md` is the log behind it, and `PLAN.md` is the plan.

---

## ANTHONY'S OPEN REQUESTS

**Read this before anything else in this file, and add to it the moment he
asks for something.** A request moves to `docs/DONE.md` when it is live
and checked, not when it is planned. (Rule from `CLAUDE.md`, section 1.)

### Open

262. **MASCAP demo: the app and the website, by Saturday.** (2026-11-27)
    "There's a hospital that said I should send them a demo... MASCAP. So I
    need to do their own demo and put it under something like
    mascap-app.stellaxafe.com. They also want a demo website, so we'll do
    mascap.web.stellaxafe.com. So we are going to... repurpose the Rhema
    website... I promise to send them this weekend, which is tomorrow,
    Saturday." Asked which comes first: discharge (260) or this. Goes with
    198 and 201 (demos on the StellaXafe Cloudflare account). The website
    to copy: billiondollarprof/rhema-website (testing branch, plain files,
    web.rhemamedical.app). Also 2026-11-27: "It's working now. She says
    she's been allowed" (259 confirmed by the person locked out).

    HIS ANSWERS 2026-11-27 (evening): no database for the demo ("Why do we
    need a database for the demo?... I thought the Cloudflare is enough...
    We are not running a backend yet"; StellaXafe's Supabase already has 2
    projects). Cloudflare only, code in GitHub, one StellaXafe home for
    every hospital's demo. Addresses mascap-app and mascap-web.stellaxafe.com
    are okay. Website FIRST, then the app. Details he gave: the manager's
    WhatsApp 0813 399 3514; Facebook page phone 0806 591 1940 (the number at
    the top of the page); Head Office 34 Adeola Road, Sapele, Delta State,
    Branch Office Egbokodo Road; Google profile https://share.google/
    Wi2GyAlLNoAPE2Poi; Facebook https://www.facebook.com/share/1AQ1zNgZQc/;
    their logo is the MH caduceus (navy and red); mascaphospitals.com is
    broken. Google reviews he showed (real public reviews, MASCAP's own).
    The design: "repurpose the Rhema website"; images there were never
    Rhema's own. Copy from the Olympus concept site he built
    (olympus-sapele.vercel.app, on the connected Vercel): the ring becomes
    the TESTIMONIAL section, made up video cards with a play button that
    says it is a demo; the scroll section ("The lounge fills up", image 4)
    shows the laboratory, pharmacy, radiology and other rooms as you
    scroll; the moving gold highlight that jumps from section to section;
    good layering. Keep Rhema's card stack instead of Olympus's. White
    background, sleek, "closer to the Olympus website design though, much
    more upgraded... I'm trying to win a contract here." Use the scroll
    craft and the humanizer. Write him prompts to generate more images. He
    will send images found online; asked whether to enhance them.

    WEBSITE BUILT 2026-11-27 (night), not online yet: new private repo
    billiondollarprof/stellaxafe-demos (his yes), sites/mascap-web, one
    Worker for every demo (src/worker.js, address picks the folder),
    noindex everywhere. Olympus layout in MASCAP navy and red on white,
    light and dark; Rhema's card stack; scroll scenes front desk, vitals,
    doctor, lab, pharmacy; ring of 10 sample patient stories, play shows
    "This is a demo"; 6 real Google reviews as written; booking in four
    steps to the manager's WhatsApp; Ask MASCAP; contact with both offices.
    Checked: 390 and 1440 wide, light and dark, every control pressed (two
    faults found and fixed: the demo box sat half off screen, and a mouse
    could not press play). WAITING: Anthony connects the repo to Cloudflare
    (StellaXafe account). Then the app demo (mascap-app).

263. **The humanizer is a rule in every repository.** (2026-11-27) "The
    humanizer should be a standard. It should be a rule in the Claude.md...
    across all my repository... in fact, inside my Google Drive as I work,
    so every agent knows that they have to read that humanizer
    repository." Rhema's CLAUDE.md already has it (section 6). Not started
    for the other repositories or Drive.

261. **The admin sees every message.** (2026-11-27, his answer to 157a)
    "The admin, because it's an admin, should see everybody's message,
    including their own. That's why it's an admin." FOUND: today an admin
    reads General, their own and their room's messages only
    (private.can_read_message). Needs SQL: show the batch first.

260. **Discharge: ask, show the bill, then the PIN; who may discharge.**
    (2026-11-27) "When you click the discharge box, let it show something
    like a pop-up in the middle of the screen asking you, do you want to
    discharge this patient... yes and cancel... when you say yes, it takes
    you to the bill section and then shows the bill. If the bill has been
    prepared, it shows you the prepared bill... and then it says complete
    the discharge... plus a cancel button." "If a doctor prepared a bill...
    After sending the bill, the system should show a button that says
    discharge this patient." "Anytime a patient is being discharged, the
    last part should request for PIN." "The front desk can discharge a
    patient, the doctor can discharge a patient, the admin can discharge a
    patient, anybody with consultant room... no one else." "If the bills
    are not yet prepared, the system should refuse the front desk... if the
    bills are prepared and the person has paid their money, then allow the
    front desk." "Until the person's money balance is 0, the doctor cannot
    discharge a patient, except they are discharging the patient on
    credit... patients with an outstanding balance... a particular
    section... maybe at the back of the hamburger menu." "If that would
    rather be an overbuild, then refuse discharge until the balance is 0,
    except for an hospital that says, okay, allow us." "They can cancel the
    outstanding balance for the patient using their PIN. Only people with
    consultant room and admin can do that." "Front desk can only discharge
    someone who has finished paying." FOUND: today only a doctor or the
    matron discharges (by role), with no PIN and no balance check. Read back
    2026-11-27, waits for his yes.

250. **Go through every aspect of the platform: everything saves, everything
    is accurate, the system works.** (2026-11-26) "I also need you to go
    through every aspect of the platform to ensure that... very important
    that everything is saving the work. Everything is accurate. The system
    is working fine." Also: "I have connected the right [Supabase] so you
    check it out now." And: "When you're done document everything for a
    handover so the next Agent can pick where you stopped."
    DONE SO FAR 2026-11-26: live consistency checks (read only) all clean
    (see 249); the full code and screen check of 2026-11-24 (244) and every
    check on each ship since. NOT YET: a walk through every screen against
    live behaviour for the parts other agents built. Handover:
    docs/HANDOVER-2026-11-24-front-desk-228.md section 8.

249. **History: the Front Desk's day shows wrong amounts.** (2026-11-24)
    "I check the history section... The front desk is saying that money she
    entered today [for] drug medicine and [for] test is what she collected
    20,000 naira between... two patients but it recorded... 1000 for drugs
    instead of test then test recorded 16,000... she is surprised... she
    [does] not know where the price amount came from so I think we will
    have to touch that area later." Later, his word. Not started.
    (Numbered 249: the other agent recorded its own 248, the antenatal
    card check, the same day.)
    2026-11-25: "The build and the lab results... I'll test it myself later.
    And then the history... check it... yesterday they... collected... 2 lab
    tests, 41,000, and there were no drugs, but the system recorded drugs
    41,000, lab tests 16,000... they said they recorded two cards, but the
    system recorded 1, 2 antenatal cards. System recorded 1. I don't know
    whether it's the front desk person that made a mistake, so I need you to
    verify that. If the system lies or something went wrong, you should
    check 24 hours ago and beyond, and even today... anything shaky... in
    that history and records." IN PROGRESS. Code read: History adds each
    payment under the kind it was saved with; the live records of 24 and 25
    Nov are needed to tell entry from fault. Asked his yes for a live read
    (no names), 2026-11-25. HIS YES 2026-11-25: "yes". BLOCKED 2026-11-26:
    the Supabase connector (the only read-only way in) failed to connect
    (502), twice; not worked around (no new tool pointed at live). Waiting
    for it to come back. It came back, but it reaches only two other
    projects in another account ("billiondollarprof's Project",
    "stellaxafe"), not the hospital's live database (ref ntfvckqczpmylskusgft,
    in the hospital's own account). Not queried. Needs the hospital's
    Supabase account connected at claude.ai/customize/connectors, then a new
    session. A GitHub workflow is not an option: its logs are public while
    the repository is public, and real payments must never reach a log.
    2026-11-26: he connected the hospital's account. CHECKED (read only, no
    names), payments 23 to 26 Nov:
    - Every payment's kind matches where it came from: Drugs only from
      prescriptions (drug lines), Lab tests only from lab requests, Cards
      from registration. The system recorded what was entered.
    - The figures he quoted are the Front Desk's evening shift of 24 Nov
      (History shows the shift since the last email sign in): Drugs ₦41,000
      = two prescriptions (₦9,000 and ₦32,000); Lab tests ₦16,000 = two lab
      requests of ₦8,000. So the 41,000 was drugs, not lab tests.
    - FOUND: those two lab requests were the same three tests (MP, Widal,
      PCV) for the same patient, asked by the same nurse at 21:40 and 21:46,
      and both were paid (21:52, 21:58): the patient was very likely charged
      ₦8,000 twice. Neither has a result yet. Nothing changed on live; for
      him to decide (void one payment with a reason through the app, or a
      refund). The request double tap guard is only 30 seconds.
    - Cards 24 Nov: one antenatal card fee recorded (₦5,000, 12:15); the
      antenatal patient registered at 12:03 has no card fee recorded (the
      fee is optional at registration; the screen shows "The card fee was
      not saved" when saving fails, so it was most likely not typed). Two
      Individual cards in the evening (₦3,000 each), both recorded.
    PROPOSED (needs his yes): warn the nurse or doctor when the same tests
    are already waiting unpaid for the patient, and warn the Front Desk
    before paying a second identical request. Live consistency (250): 59
    payments, totals all equal their lines, no paid item still waiting, no
    completed lab request without a result; 2 same-tests-within-an-hour and
    4 same-drug-within-an-hour cases in 14 days to look at.
    2026-11-25 also: "make the vital sign visible to also the front desk, so
    the front desk can also [chart] it. I believe we've done that already.
    Just confirm." CONFIRMED: Take vitals for the Front Desk is live since
    2026-11-19 (228c), with glucose, pain and BMI since 235; readings go into
    the record; the Front Desk sees back only its own readings (by design;
    seeing others' would be a change to who sees patient data, to ask).

247. **The Pharmacy sees the medicine chart like the nurses, with Dispense
    in place of Given.** (2026-11-24) "Remember the pharmacy needs to see
    medicine chart as nurses but with a dispensed button in place of the
    given button that nurses see." TODAY: the Pharmacy sees the chart's
    medicines as a list on the patient's page (taking now, suspended,
    stopped) with doses given, dispensed, left and a Dispense button, not
    the nurses' chart layout (last given, next due). Next after 240h.
    (Numbered 247: the other agent recorded its own 246, the antenatal
    visit chart, on the same day.)
    HIS ANSWERS 2026-11-24 (voice note, tidied, meaning kept): on prices:
    "they don't necessarily have to type... the system should populate
    prices... when the doctor is typing prices, the system should be
    recording the price of that drug and then you can just make [it]
    standard... as long as it's coming from the Dr or the Matron... any
    price of any drug or the bed space... record it... next time the system
    is suggesting it... our system should actually be learning." On old
    patients: "if there is any medicine chart that the doctor entered before
    now... when the doctor click[s the bill] you should show all of those...
    we don't know whether the [patient] has been discharged because they were
    registered... before we built this... you will know inpatient if their
    medication appear[s] in the medicine chart." On the Pharmacy: "yes...
    that's what I mean... the nurse can come and take medication at once...
    they don't always take it as per dose... they can even take more
    dosages for that patient... then be giving the patient [from] the
    store... the [Given and Dispense] place is a little bit confusing for
    me... explain it." Explained back with a plan and three questions.
    HIS ANSWERS 2026-11-24: "there has to be a way to record [what is
    returned]... maybe a button [that] records [it]... so that the patient
    is not charged for... whatever is returned or wasted." "Thank you,
    suggestions are correct." Admitted on: "front desk [or] Dr... can click
    the details and put admitted on [a] date and then everything from [then
    on]... that's nice." Prescriptions: "the prescription medicine that
    [was] dispensed can show... with the price... paid... if the patient is
    admitted and they still prescribed drug for them even if they had paid
    for the prescription, it shows in the final receipt... the bill
    preparation just shows everything the patient has spent since they were
    admitted... and the lab test even if they paid separately... at the end
    of the day they pay... the difference." (Bill counts doses Given.)
    BUILT 2026-11-24 on the branch (not on testing): migration
    20261124200126_chart_prices_returns_admitted_on (set_admitted_on; chart
    lines marked with their prescription, older ones matched; Medicines
    given priced from the chart, else the drug's standard, else none;
    return_to_store; the Pharmacy's chart adds route, last given, returned),
    test 074, 11 breaks caught. Screens: Change admitted on; the chart's
    dose price fills from the standard and a new one is offered as standard;
    a price box per unpriced medicine on the bill (offered as standard after
    sending); the Pharmacy's medicines taken now with Last given, Next due,
    Dispense and Returned. SQL batch shown. HIS YES 2026-11-25: "Yes".
    And: "if the drug was given like two doses and the doctor entered 2000
    naira, the system automatically know[s] [it] should be 1000 naira so
    another time where it is five doses the system knows automatically that
    is 5000. I believe that's already designed." (It is: the box is the
    price of one dose, multiplied by the doses given and kept as the drug's
    price. Added the worked total beside each box so it reads plainly.)
    247 LIVE 2026-11-25: 0 security warnings on testing and live; smoke
    tests passed; click-through none broke. Merged the other agent's
    antenatal work first; my test renumbered 075 (theirs is 074), my
    History request renumbered 249 (theirs is 248). Stays open until he says
    it is done.

245. **Only what was selected, with an amount, is on the receipt.**
    (2026-11-24) "the receipt must not contain what does not have an
    amount. If a line is not selected, it should not appear on the receipt.
    Only what was selected while prep[ar]ing the bill shows on the receipt."
    FOUND: every saved bill line has an amount above 0 (the database
    refuses 0), and the receipt prints only the bill's saved lines. But since
    the check of 2026-11-24 the stay's three lines (Medicines given, Take
    Home Drugs, Laboratory tests) cannot be left off, because sending a bill
    settles every drug and test of the stay. To let the doctor leave one
    off, the database must settle only what is on the bill (SQL). Built
    locally, waiting for his yes on the batch.
    HIS ANSWERS 2026-11-24 to the open questions: "We build the lab one
    result at a time" (240h: yes, next). "An unpaid dispensed drug never
    expires" (already so: the 72 hour rule only expires drugs not given,
    and tests with no sample taken). "No need [for a] settled by the deposit
    button, the system handles that automatically once the person is
    discharged with no outstanding balance" (Discharge with nothing owed
    marks the stay's unpaid bills settled: SQL, added to this batch). "Yes,
    the doctor should be able to but we already have cancel, suspend etc"
    (no new edit for days and doses: stop the medicine and chart it again).
    "Keep the price suggestion" (the Lab's suggestions to the admin, 208,
    stay).
    HIS YES 2026-11-24 to the batch (20261124094742: only ticked lines are
    settled; discharge with nothing owed settles): "Yes, run it". And: "The
    bill payments and the lab is not done yet" (245 and 240h stay open
    until he says so).
    240h LIVE 2026-11-24: migration 20261124172347 (results_at; some tests
    sent, the rest pending; complete when every test has a result; the
    doctor's notice and alert at every send), test 073, test 044 brought to
    the new rule, 7 breaks caught; screens: the Lab types the ready ones,
    "Send these results", "Pending results" after, opening again shows what
    was sent and boxes for the rest; "Pending results" on the record; "Some
    results are ready" for the doctor. 0 security warnings on testing and
    live. Stays open until he says it is done.
    245 LIVE 2026-11-24: 0 security warnings on testing and live; smoke
    tests passed; click-through none broke. Merged the other agent's pitch
    commits (testing shows Jerou Hospital; live is always Rhema) before
    pushing. Stays open until he says it is done. NEXT: 240h.
    2026-11-24 (voice note, tidied): "go on with the lab results now and fix
    it" (his yes to the 240h batch as described: results_at, saving some
    tests, the alert at each send). And on the bill: "remind me [of the]
    plan... tell me if you've done it... medicine chart, nurses give
    medicine... pharmacist dispense, then on the bill you should show [what]
    they are given; the prescription is for mostly outpatients... they
    usually pay that one separately, but everything the patient has taken,
    has been supplied, everything recorded, so when you open [and] prepare
    [the] bill you already see the things already recorded and you click
    other things you want to add... the medication, the drugs, the supplies,
    the lab test and the rest... check it properly and let me know that
    everything about billing as we said is concluded [and] live... the other
    agent is working on something on patient so you should not bother about
    that."

243. **"Other" in every list always in blue.** (2026-11-23) "when someone is
    picking from a list... drugs... tests... there are some places where the
    ink is dark just the same color of fonts that the list was used for...
    the other should come with a different color of font, which is blue...
    this afternoon... when the doctor entered [Other] and put nursing care,
    the [Other] itself in that list of options was still dark... so [Other]
    always comes with a blue type font... I think you should save it for
    later." SAVED FOR LATER, his word. Not started.

242. **Inpatients: deposits at the Front Desk during the stay.** (2026-11-23)
    "when the inpatient stays... they used to come and still make some
    deposit... for a bed space... they don't usually meet the doctor, they
    just go and meet front desk. So front desk should be able to take the
    payment and enter the description of what payment they made, that
    deposit... optional description... any deposit they are making as they
    are staying is counting towards their stay as against the services they
    are receiving... calculate how much they have paid so far cumulatively
    and how much service they have gotten so far cumulatively... pay the
    balance difference." HIS YES to the chart plan (Epic and Bahmni way):
    "a very nice and easy flow... go on with it." Admit: "the doctor, the
    matron, the front desk. All three... antenatal patients... switch from
    being outpatient to inpatient when they come to do delivery." Pharmacy:
    "see the chart on the patient's page, not the full medical record."
    Bill: "Medicines given" one line, automatic; "Take home medicine" its
    own line, from prescriptions while admitted, even if paid separately;
    everything while admitted counts; "the receipt should not be naming the
    name of medicine or name of test"; lab tests "they used to pay that one
    different... the system can still fetch the laboratory tests... and still
    show the money they paid, even though they are not owing." Part of 240.
    2026-11-23: "I think you got the bill right. The lab test can show as
    paid. And also, if they've not paid for it, it is still show that
    they've not paid and it still shows the amount... whatever the person
    has paid is subtracted from the total and the person pays the
    difference... show me the SQL ba[tch]." Bill and inpatient SQL batch
    (13 points) shown 2026-11-23. HIS YES 2026-11-23: "Yes". Building.
    BUILT 2026-11-23: migration 20261123215523_inpatient_bill (admissions,
    admit/discharge, deposit, chart days/doses/dose_price with a price-setter
    check, chart_dispenses and dispense_chart, the Pharmacy's list with
    doses/given/dispensed, the form's bill kinds, bills tied to the stay with
    covers, bill_statement, pay_bill settles covered items), test 071, tests
    068 brought to 40 lines (the form has more than 20), 18 breaks caught.
    Screens: Stay card (Inpatient/Outpatient, Admit, Discharge, "The bill is
    paid. Discharge this patient?"); Deposit at the Front Desk for an
    inpatient; chart: days, doses in all (worked out), price of one dose,
    "2 of 6 doses given", "All 6 doses are given. Give another?"; the
    Pharmacy: Given, Dispensed, Left, Dispense; the bill: the form's 17 lines
    (bed Regular/Private/VIP), Medicines given / Take Home Drugs / Laboratory
    tests worked out with what each is made of, Preview, Paid since admission
    and Balance; the Front Desk takes the balance; the receipt shows the
    bill's lines, balance and signature lines.
    LIVE 2026-11-23: 0 security warnings on testing and live; smoke tests
    passed; click-through none broke.
    FOLLOW-UPS (not built, to ask him): (a) unpaid prescriptions and lab
    tests of an inpatient still expire after 72 hours; they should wait for
    the bill (needs SQL); (b) a bill the deposits fully cover stays in Bills
    to pay, because a payment of 0 is refused; it needs a "settled by the
    deposit" step (needs SQL); (c) days and doses can be set when charting,
    not yet changed afterwards.

240. **The director on bills, the medicine chart, the Pharmacy, lab results
    and a back button on phones.** (2026-11-23, a long voice note, written
    down in his words; an image of the hospital's receipt was mentioned but
    did not come through.) Said back to him in parts a to i; NOT STARTED,
    waiting for his yes and answers. The 238 SQL (Lab sets prices) is ON
    HOLD: he now says "the lab scientist should not be able to edit price".
    a. Pharmacy and the medicine chart: "those medications that are entered
       into medicine chart, they are medications that the inpatients take...
       they don't pay for it... They pay when they are about to check them
       out... give the pharmacy access to see the list of medications from
       those medicine charts... Only the medicine... the pharmacy should also
       see those medicine and be able to see their own button... dispense. So
       when they are clicking dispense, the system would also record the
       history... just like it records the history for medicine that the
       pharmacies give out... that medicine chart now is not part of what
       comes as notification. The pharmacies will only click on find
       patients... open the medical record... the only thing they are able
       to see and access is the medication and the prescriptions... They will
       see all the prescription, all the ones they have given and the ones
       they have not given. They will see the medicine chart... so that they
       can click on dispense for that particular time."
    b. Chart medicines given become a bill line: "every medicine in medicine
       chart that has been given would appear automatically in the bill...
       with the prices that the doctor used to input when he was charting the
       medication... The total should appear with the name medications...
       it should be one line... Receipt can just say medications given...
       The doctor doesn't want the names of the medicine to be in the receipt
       that will be given to the patient to avoid self-prescription."
    c. The bill's list (from the receipt): "professional fee, nursing fee,
       procedure and surgery, aesthetic [anaesthetic], oxygen, phototherapy,
       blood transfusion, delivery, physiotherapy, tear and repair, hospital
       facilities, stroke [/] bed space, orals, injectable, infusion, stroke
       [/] cannulation, consumables, antibiotics, take home drugs, others...
       where others is is where they can add others and put a name... they
       can still make it a standard."
    d. Bed space: "a sub category that says... regular, private and VIP...
       They have different prices... capture any price the doctor puts...
       make it a standard for next time... remember and recommend it."
    e. Prices: "the only people that can set that price is either the admin,
       the matron or the doctor. Also the doctor said that the lab scientist
       should not be able to edit price. So only the matron, the doctor and
       the admin can set price of medication."
    f. Preview: "The doctor also want to see the preview of the receipt...
       click to preview the receipt. And he should be able to edit the
       receipt before sending it to front desk... every row on its own with
       its price."
    g. "Other" (he says "order") shows the typed name: "when they click
       order, they will put the name of the thing... that new name... becomes
       what appears in the field, not order... Same with every other place
       in the platform... the doctor... clicked on order inside the bill...
       the system was still showing order... Even after we made it a
       standard... nothing care [nursing care] will be on its own. I believe
       that is a mistake in the system."
    h. Lab results one test at a time: "the doctor can send three lab
       requests at the same time. He should be able to conduct the one he can
       conduct now and send the results without sending everything... the
       other one, he will keep it as pending results... some of the results
       takes three days. Whenever the results is ready, he can now send it."
    i. Back button on phones: "putting that back button that we have on
       desktop and tablet screen... at the top for mobile as well... when you
       are using iPhone, it's difficult to go back... it doesn't take space.
       Just be at the corner... previous pages, not... home page."
    THE FORM (photo sent 2026-11-23): "Rhema Medical Centre, Discharge /
    Billing Form". Name, Room Name, Date, Card Number. S/N, Service, Bill ₦:
    1 Professional Fee, 2 Nursing Fee, 3 Procedures / Surgery,
    4 Anesthetics, 5 Oxygen, 6 Phototherapy, 7 Blood Transfusion,
    8 Delivery, 9 Episiotomy Tear and Repair, 10 Hospital Facility / Bed,
    11 Orals, 12 Injectable, 13 Infusion / Cannulation, 14 Consumables,
    15 Antibiotics, 16 Take Home Drugs, 17 Others. Then Total, Deposit,
    Balance. Signed: Doctor; Patient.
    Questions sent 2026-11-23, not answered yet: (1) chart price per dose
    given? (2) Pharmacy Dispense on the chart: a tap per supply, again
    later? (3) Pharmacy sees chart medicines and prescriptions on the
    patient page, not the full record? (4) remove the Lab's price
    suggestions to the admin (208) and drop 238? (5) a second bill shows
    only medicines not billed before? (6) Deposit: recorded at admission
    and taken off the Balance? Order proposed: g and i, then h, then a, b,
    c, d, f with one SQL batch.
    HIS ANSWERS 2026-11-23 (voice note, tidied, his meaning kept):
    (1) "Yes, it should be a price for each [dose] given... if... it was
    given... multiple times... the system mathematically calculate the
    number of times... if the dose is 2500 and... given up to six times...
    show something like times six, and then show the total."
    (2) The nurses give each dose and tap Given; the Pharmacy should tap
    Dispense each time it hands the drugs over, again and again, so the
    medicine given out is logged "because pharmacy does not have that part
    as [a pre]scription"; the Pharmacy also sees what the nurses gave.
    (4) "According to the doctor, do not suggest any price so the Dr check
    the price. [If the] Matron has any price in mind physically meet the
    doctor or call the doctor." (So no price suggestions from the Lab.)
    (5) A second bill shows what has not been billed before, and "Dr you
    want to see all the money the person is spending when the person came
    [to the] Hospital. They paid something 50,000 naira... by the time
    you're leaving the entire might be 300,000... when [the doctor] is
    writing the bill... shows how much... was previously paid by this
    patient... and then subtracted from the total... so that the patient
    can compare the balance." And: "the only way we differentiate
    inpatients is when they have medicine charts except you can add a place
    where you can tag inpatient and outpatient... think about that."
    Not answered: (3) patient page or full record for the Pharmacy; (a) or
    (b) for medicines on the bill; the matron setting prices (his earlier
    message says yes; this one is unclear); the order of work.
    MORE FROM HIM 2026-11-23 (voice note, tidied, meaning kept): "a patient
    can be marked inpatient or outpatient... outpatient... pay individually
    [for each] service... inpatient... can still pay the price of whatever
    they collect or... initial deposit... admission deposit... [separate
    from the] category of family, individual and antenatal... a toggle...
    any money they pay during their time of being inpatient... the system
    knows they've paid since they have been inpatient... at discharge...
    [take-home] prescription they might not have paid for... when the doctor
    [or matron or admin] is preparing the bill... the system will be showing
    that prescription as well... [an unpaid] lab test... as well... once
    [they] pay the bill complete... the system can ask the doctor to
    discharge this patient... once discharge is clicked the person [goes]
    to outpatient... next time... individual fees... a little upgrade
    rather than [a] change of direction."
    And on the chart: the nurse taps Given for each dose, morning and
    evening; the Pharmacy should Dispense at the same time; "when the doctor
    was... charting, [they] wrote how many times how many doses... if a
    nurse gave one dose system records one time... I don't know whether that
    is how it is designed before... check and see how they normally
    [do it]... how other platforms... normally do this."
    TODAY (checked): the chart keeps medicine, dose and how often; no number
    of doses or days. Nurses tap Given each time, with no limit.
    g and i LIVE 2026-11-23 (smoke test passed, click-through none broke; no SQL): g, the bill's What for shows the
    name typed with Other, and every name used before (standard or own
    price) is its own choice with its price; the other Other boxes in the
    app already worked this way (OptionSelect). i, a slim back arrow beside
    the logo on phones (32 px); at 320 wide the name in the bar is cut
    shorter ("Chio...").
    Also: "cross-check before you run the SQL that you just showed me...
    if there's any adjustment that needs to be made before this current SQL,
    you make the adjustment before running the SQL."

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
    Adjustments live 2026-11-02 (his yes on the SQL; 0 security warnings
    on testing and live).
    Step 2, family profile, live 2026-11-02: he chose the family number
    (FAM-000012; each member keeps their own RMC number). His yes on the
    SQL; 0 security warnings on testing and live.
    Step 3, poor network, live 2026-11-02: registration drafts, record
    entries that wait ("Not sent yet"), a "waiting to send" pill, and a
    device copy of patients changed or seen in the last 30 days
    (registration text only; the medical record is not copied because
    every opening must be logged). Wiped at sign out.
    Step 4, receipts, built 2026-11-02 (receipt numbers, Take payment on
    the profile, printable receipt, today's receipt, Print receipt after
    paying on Home). Live 2026-11-02 (his yes; 0 security warnings on
    testing and live). Email on receipts comes with Resend (6 Nov); no
    button shows before then.
    NEXT: messages with ticks (and 132, the unread bubble). His answers
    2026-11-02 evening: "messages should most likely send from... a room
    to a room... from front desk to lab, from lab to pharmacy, you know,
    just the way you also call attention... matron one, matron two... by
    office or by room"; groups too. Patient names: "they can type the
    patient name, but they don't have to tag the patient... just a normal
    message." Text only. Kept 1 year, then deleted nightly after the
    backup (his choice, 2026-11-02). Built 2026-11-02: Messages (rooms and
    groups, ticks, clock while waiting for the network, unread bubble on
    Messages), Announce (nurses and admins), announcements on Home until
    Got it. Live 2026-11-02 (0 security warnings on testing and live).
    132 built 2026-11-02 night: Notifications in the menu, a red bubble on
    the menu button. Review pass round two the same night: Home for every
    role added to both checks (25 screens, 6 sizes): clean.
    NEXT: the 6 November handover (checklist in "6 November handover").
    Also: "Always remember to ensure that your text, nothing overflows out
    of the screen" on phone, tablet (portrait and landscape) and desktop.

132. **Unread count on the menu button.** (2026-11-02) "If notification
    is... behind hamburger menu... the hamburger menu will be showing a
    bubble, red, with... the number of notifications that are unread...
    But if we already have it at the sidebar, then there's no point behind
    the hamburger menu." Today Notifications sits only in the menu (since
    117), marked Soon. So when notifications are built: a red bubble with
    the unread count on the menu button, and the same count beside
    Notifications inside the menu. Comes with the notifications build.

## 6 November handover (the one checklist, 2026-11-02)

He asked (2026-11-02): "save the November 6 while you check in case we are
forgetting anything". Everything for the move, in order. Items marked NEW
were not on any list before this check.

A. He does (the domain opens for moving on 6 November):
  1. Move rhemamedical.app from his Cloudflare account to the hospital's
     (DNSSEC already off; the zone waits in the new account). Never delete
     the domain.
     2026-11-06 12:42 to 13:13: he started the move from his personal
     account (Domains, Registrations, rhemamedical.app, "Move to another
     account", the hospital account ID typed twice). The old zone had 0 DNS
     records. Status now "Pending Account Move Out". Next: he checks the
     hospital account (rhemamedical7), Domains, Registrations, and sends a
     photo (arrived? Active or Pending?). Then Resend (his order of
     2026-11-03), then Email Routing, then my part (B).
     14:19: DONE. He accepted the move by the email Cloudflare sent to the
     hospital account (I had not warned him an email would come). The
     hospital account shows rhemamedical.app Active under Registrations,
     Action Center: no pending actions. Still to confirm: the website
     (zone) in Domains, Overview shows Active, not Pending.
     Decided 2026-11-06: Resend on the HOSPITAL's own account
     (rhemamedical7). (The Resend connection I can reach belongs to
     StellaXafe, with stellaxafe.com; it is not used for the hospital.)
  2. Resend: add rhemamedical.app, put its DNS records (SPF, DKIM, DMARC)
     in the hospital's zone, wait for "Verified".
     2026-11-06 14:37: DONE for sending. Domain added in Resend (Ireland,
     tracking off, receiving off so Email Routing can own incoming mail),
     records added by Resend's Auto configure into the hospital's
     Cloudflare (CNAME send, CNAME rsend, TXT resend._domainkey, all DNS
     only), status Verified. Still to do: DMARC (optional record), a
     Resend API key for testing and one for live (Sending access, this
     domain only), typed straight into Supabase SMTP, never in chat.
     2026-11-06 14:56: SMTP saved on TESTING (key rhema-testing typed by
     him into Supabase, never in chat). Test: the sign-in email arrived in
     about a minute, Inbox, from "Rhema Medical Centre
     <no-reply@rhemamedical.app>", but with a LINK and no code, because the
     hosted templates still have Supabase's wording. Wording written in
     ops/email-templates/sign-in-code.html (navy band, red line, code in a
     blue box, no picture), for both "Magic link" and "Confirm signup",
     subject "Your Rhema sign-in code". Next: he pastes it on testing and
     tests again; then the same on live with its own key (rhema-live).
     2026-11-06 15:24: LIVE works too (key rhema-live, both templates on
     live; he signed in on live as Dr. Evans and set his PIN; live home
     shows zeros, so no demo rows). Zone Active ("protected by
     Cloudflare"). The orange "Proxy DNS records" triangle is only a hint:
     the 3 Resend records must stay DNS only.
     8 (Supabase URL Configuration): ops/supabase_check.py now accepts the
     old (workers.dev) and the new (rhemamedical.app, testing.
     rhemamedical.app) address, in any order, nothing else (13 tests, 9
     deliberate breaks caught). He adds the new addresses to the redirect
     list on both projects AFTER it is on main; Site URL stays on the old
     address until the app really answers on the new one.
     (Earlier note, now out of date:) The Cloudflare zone was waiting for the registrar to switch
     the nameservers to cheryl and tim (usually 1 to 2 hours, up to 24):
     he taps "Check nameservers now". Email Routing and my part (B) wait
     for the zone to be Active.
  8 DONE 2026-11-06 15:48: he added https://rhemamedical.app/** (live) and
     https://testing.rhemamedical.app/** (testing) to Redirect URLs, kept
     workers.dev, Site URL unchanged. Supabase check run on main: both
     projects "Sign in settings are as set".
  3. Email Routing: info@, admin@, records@ to the hospital Gmail (80).
     2026-11-06: set up in the hospital's Cloudflare. Destination
     rhemamedical7@gmail.com verified; rules info@, admin@, records@ to it,
     all Active; catch-all Disabled (Drop). "Onboard domain" added 3 MX
     (route1/2/3.mx.cloudflare.net), TXT cf2024-1._domainkey and the root
     SPF; nothing removed, Resend records untouched. Tests forwarded with
     SPF, DKIM, DMARC and ARC all pass, but Gmail put them in SPAM (new
     domain). His first search was in another Google account in the same
     browser. Fix given: "Not spam" on each, and a Gmail filter on To:
     info@ OR admin@ OR records@ with "Never send it to Spam" and label
     Hospital. Then one more test to the inbox.
     His question (2026-11-06): will emails we SEND (e.g. from info@ to a
     patient) land in spam? Answer: sending goes through Resend, signed
     with our own DKIM and SPF, and the code emails already land in the
     Inbox. Asked him to add DMARC now (TXT _dmarc, value copied from the
     DMARC row on Resend's domain page). Rules for patient emails (mine):
     whole sentences, hospital name and address, plain subject, no short
     links, reply-to info@, and send gently in the first weeks. The
     Gmail filter needs the BROWSER (desktop site), not the Gmail app.
     21:05: he made the filter (3 addresses, label Hospital) but a new
     test STILL went to spam; he is tired and will wait 24 hours. Next
     time: ask for a photo of the filter list (check it uses OR, the To
     field, and "Never send it to Spam" is ticked). DMARC: told him TXT
     _dmarc "v=DMARC1; p=none;" TTL Auto. Resend "Enable receiving" stays
     OFF (Email Routing owns incoming mail).
  4. The $0.01 budget alerts on both Cloudflare accounts.

B. I do, in the app, once A1 is done:
  5. NEW: wrangler.jsonc: the real address for live (rhemamedical.app) and
     testing (testing.rhemamedical.app); keep workers.dev until both work.
     TESTING DONE 2026-11-06: testing answers on
     https://testing.rhemamedical.app (health ok, sign in screen 200), with
     workers.dev still on. The deploy smoke test checks the real testing
     address too (step 6 for testing). Live waits for the time Anthony
     picks, because staff must reinstall (C15, C16).
  6. NEW: deploy.yml smoke test reads the workers.dev address: point it at
     the real address.
  7. NEW: push-keys.yml and the database's saved push address
     (rhema_push_url) use workers.dev: move them, or phone alerts stop.
  8. NEW: ops/supabase_check.py SITE_URLS, and Supabase Auth "Site URL"
     and redirect list: the real address, or sign in links break.
  9. NEW: the install guide pictures show "rhema-hospital…workers.dev":
     show rhemamedical.app.
  10. NEW: scripts/e2e-signin.mjs refuses live addresses by name: add the
      real address so a test can never touch live. DONE 2026-11-06.
  11. Supabase email through Resend (no-reply@rhemamedical.app); the sign
      in code wording in BOTH hosted templates, Magic link and Confirm
      signup (109).
  12. CARDS_PAUSED back to false, then walk the cards (109).
  13. Invitation and "account back on" emails through Resend (112).
  14. Receipts: the Send by email button (123).

C. NEW: what the staff will notice (tell them before):
  15. The real address is a new app to each phone and computer: install
      it again from rhemamedical.app, sign in with the email code, set the
      PIN again, allow notifications again. The old workers.dev address
      should send people to the new one (I add a redirect).
  16. Anything "waiting for the network" on the old address must be sent
      first: everybody opens the old app once with network before the
      switch.

D. Accounts and keys:
  17. Delete the test accounts, keep his master account, after a word with
      the director (113, NDPA).
  18. (Dropped 2026-11-03, his decision: the keys stay as they are.)
  19. NEW: rename the Supabase project ("rhemamedical7@gmail.com's
      Project") to rhema-hospital.
      DONE by him 2026-11-09 (his photo): live is "RHEMA MEDICALS"
      (eu-west-3, Paris), testing is "Rhema-testing" (eu-west-1, Ireland),
      in the organisation "Rhema Medical Center", Free plan.
  20. NEW: check live has no demo rows (the demo data was testing only).

E. Watching after the move:
  21. NEW: the first nightly backup after the move passes, including the
      new "messages older than a year" step.
  22. The AWS uptime watcher (74): set up 2026-11-03 if his phone code
      arrives; on the 6th it is pointed at the real address.
      2026-11-04: the new AWS account offered no $200 credit (AWS says it
      is linked to an older account of his) and asks for a card first. He
      may use the older account. Advised: either works, the watcher stays
      inside the always-free allowance; use the company account, choose
      the Paid plan (the Free plan closes after 6 months), MFA and the $1
      budget, then "AWS done".
      Decided 2026-11-04: he uses the NEW account, which is registered to
      StellaXafe. One watcher checks every hospital in one run every 5
      minutes (about 8,640 runs a month, under 1% of the free 1 million).
      Alerts by email, not SMS (SMS is charged per message).
      Design (2026-11-04, after his question): the watcher emails only on a
      change, once when a hospital stops answering and once when it
      answers again, never every run and not repeated every 5 minutes. The
      alerts go through AWS SNS, kept outside Resend and Supabase on
      purpose, so they still reach him when the app is down.
      State 2026-11-04 (his screenshot): the StellaXafe account is open,
      $100 credit, spend limit $20, a card saved. Next for him: MFA (via
      "Manage security and sign-in"), then the $1 budget alarm.
      2026-11-04 later: MFA done ("MFA1, TOTP"). Watcher BUILT in aws/
      (uptime_watcher.py, 35 tests, 18 deliberate breaks caught,
      template.yaml passes cfn-lint, aws-watcher.yml, README with his
      steps). Waiting for him: upload template.yaml in CloudFormation
      (Ireland), confirm the SNS email, give me DeployRoleArn. Then: put it
      in aws/target.json, merge to main, the workflow deploys and runs it
      once in test mode. On the 6th: change the address in aws/sites.json.
      Least access: watcher = one table + one topic; deploy role = one
      function, main branch of this repo only, no keys anywhere.
      Not yet checked: the $1 budget alarm (the $20 spend limit is set).

F. NEW: for the hospital to own (NDPA 2023), not code:
  23. A privacy notice for patients and staff, a record of what is kept
      and why, and who answers for data protection at the hospital.

137. **His own walk through all 13 modules.** (2026-11-04) "I want to go
    through all 13 modules and go through the entire system myself... I'll
    go from front desk to the last and test every single section of it
    myself. And I hope you populated them with dummy data." Then: "yes, top
    up, and make me front desk... look into the SQL properly and then run
    it. I'll give you my yes in advance." Top up: ops/testing-topup.sql,
    run by .github/workflows/testing-topup.yml on testing only. Checked on
    the local database first (twice, and a second run changes nothing).
    Ran on testing 2026-11-04: "Top up added: 3 staff, 1 family of 3,
    records for 3 patients, 3 prescriptions, 5 messages, 1 announcement."
    He is Front Desk on testing from 2026-11-04. Open until his walk is done.

149. **Test every button properly, and look for oversights.** (2026-11-04)
    "take your time to check not just the fixes you did, but also each and
    every button in this place... Anything that doesn't look right, take
    your time." And: "now run your SQL" (the profile fix, 138).


166. **His answers of 2026-11-09 (after the leftovers list).**
    - Demo patients on live: STAY for now ("I'm still testing the
      platform... even when I meet with the director, we'll be putting in
      demo data"). Removed later, on his word.
    - Phone alerts to rhemamedical.app: "Yes, you should do that." Done as
      migration 20261109111740_push_address_real_domain (each site's old
      workers.dev address to its own new one; keys unchanged).
    - Privacy Policy and Terms: enough as they are; a lawyer only if the
      hospital wants one.
    - admin@ on live: he invites it when setting up for them.
    - GitHub stays public until the end of the month (training first, no
      real patient data yet), then private again, after the minutes reset.
    - His walk through the modules is gradual this week, with the hospital;
      he sends screenshots; I also fix what I find myself.

227. **Sheets, consultation, drafts, history, install guide, antenatal, print, drug list.** (2026-11-18)
    a. 226b ENCRYPTION SUSPENDED: "Let's suspend this one first. It should
       be like part of the last things... when we are done with the major
       things that the hospital needs for day-to-day activities, then we
       will come back to this one."
    b. Sheets, more rows: "it's just one row... Can they add another row...
       if they are putting drugs... there should be... a place where they
       can add plus to add another row." Vital signs: "when they click add
       vital sign, they will add a new vital sign to the vital sign?"
    c. Freehand nurse notes: "I changed my role to a nursing role, but it
       still did not give me a place for freehand notes... showing nothing
       written yet, and there's no place to add notes."
    d. Consultation and prescribing: "prescription button is okay where it
       is... inside the consultation note, let that same prescription still
       be there... If that medicine chart... is serving the same purpose,
       then do it in a way that they will know that it's serving the same
       purpose as the prescription button at the top."
    e. History in the menu would not open (front desk account, on a
       patient's edit page): "I click other keys. They open, but history
       did not... even when I refresh... I had to close the app, open it
       again."
    f. Installation guide: "there should be a button... that takes you back
       to the app. And it should take you exactly to the previous page."
    g. Antenatal registration: front desk says antenatal has extra details
       (client details and next of kin from their card: marital status,
       religion, level of education, occupation; next of kin occupation,
       religion, education, age). "once they toggle antenatal, those extra
       information can populate."
    h. Record page "Download" button: "normally it should be print, and if
       the person adds their email, it should also be sent to email."
    i. Pharmacy's drug list (photos 2026-11-18): add every one missing from
       the system; "if there's anyone in the system that is not in the
       list, still leave it... better to be more than to be less."
    j. Drafts and editing: "when somebody add medication and they do not
       save it and go back... save it as draft... maybe 30 minutes." And
       after saving: edit for 5, 10 or 15 minutes, then only cancel, shown
       as cancelled? "Or what do you think is the best?" ASKED FOR AN
       OPINION; waiting for his choice.
    c DECIDED 2026-11-18: nursing notes stay where they are on the record
       page ("Single nursing note is okay where it is"). No Notes tab on the
       sheet.
    k. Front desk sees what to charge without being sent (2026-11-18): "even
       if they did not send front desk medication or lab... front desk will
       be able to see those details because they collect money for it...
       sometimes the doctor will ask them to go and meet front desk without
       even sending them the prescription... by the time they've not marked
       it paid, it will just be there... pending payment... Then once it is
       paid, whether through when it was sent to them or whether they go and
       search for the patient, it's all the same." Lab: "that one is
       different", request lab already does it. Plan sent, waiting.
    k DECIDED 2026-11-18: "So the front desk sees everything, sees what to
       be paid for, and once it marks paid, it marks everywhere." On the
       patient's details, separate from the biodata. Admitted patients too:
       "Even if the drug is dispensed, it should also show that they have
       not made payment for it until the front desk marks it."
    d DECIDED 2026-11-18: inside the consultation, a Prescription part that
       drops down: pick drugs, send; it goes to the Front Desk (take
       payment) and the Pharmacy (awaiting payment, then dispense once
       paid), without touching the rest of the note. The same for Request
       lab: to the Front Desk and the Lab, awaiting payment until paid.
    l. Consent: the director wants a place to upload a scanned signature
       (2026-11-18): "they don't have electronic signature and they can't
       use fingerprints... They will scan signature, they will now upload."
    m. Family file, confirm (2026-11-18): one file, add members; each member
       has their own diagnosis and records; open one member and easily open
       the others in the group; a member can switch to an individual file;
       a member can edit their own next of kin and address and stay in the
       family. "I believe that's how it's already designed... just confirm."
    YES TO ALL, 2026-11-18: "yes to all of your questions... Take the yes
       now. Go through it. Anything that involves the design... Screenshot
       it, and make sure everything aligns well." Order: e History fix;
       k + d payment card and Prescription and Request lab inside the
       consultation ("the same prescription, either they take the
       prescription from the medical record screen, or they take it from
       the consultation area"); j drafts (30 minutes, wiped at sign out) and
       Correct (cancel plus a filled in copy); b + Add another row; g
       antenatal fields; h Print and Email; l consent upload; i drug list
       (show the SQL batch first).
    l DECIDED: the app shrinks the scanned signature itself to a few
       kilobytes, still clear enough to read; anything still over 500 KB
       after shrinking is refused, with "scan or screenshot, then crop it".
    NEXT AFTER 227: a security and robustness review ("anything at the
       database level, anything that will cause any crash or breakage").
    n. Dark mode on every page (2026-11-18): "make sure every page is dark
       mode suitable and readable as well as light mode, so no text or
       design disappears simply because someone toggles dark mode." Also
       noted the words "dark look/light look": "seems okay though".
    o. Register from old file (2026-11-19): "When the person selects
       antenatal, did the person have the extra field to fill in those extra
       antenatal information?... the family. Is it also enabled for them to
       be able to create a family group just like the normal registration
       behaves?... adding extra family members on the register from old
       file." Checked: neither did. Building both like normal registration.
    SECURITY REVIEW 2026-11-19 (his yes): database clean (every table RLS
    on, nothing for anon, no public owner's-rights functions, no deletes,
    search_path fixed everywhere); live security advisor: only the accepted
    leaked-password warning; Worker checks sign in with the database on
    every file route, 10 MB cap, real file type checked, no caching; 0
    package problems; no secrets in the repo; record emails refuse a double
    send; the Drive job skips quietly until connected. FIXED and LIVE: a
    crash screen (app/error.tsx, app/global-error.tsx) instead of a blank
    page. ASKED: 4 indexes for speed (payments.received_by,
    prescriptions.payment_id, lab_requests.payment_id,
    stock_moves.prescription_id), SQL writes, waiting for his yes.
    2026-11-19 ALL OF 227 LIVE AND CHECKED: i drug list (98 medicines, 5
    supplies, migration 20261119015150, his yes); o old file antenatal
    details and Add family member. NEXT: the security and robustness
    review he asked for.
    2026-11-19 LIVE: l consent signature (shrunk on the phone: a 2 MB photo
    sent as 118 KB; refused over 500 KB; View signature; migration
    20261119014627). i drug list READY, NOT RUN: 98 medicines and 5 supplies
    not yet on the list, migration 20261119015150 kept in a git stash
    ("227i drug list"), waiting for his yes on the list. Then the security
    review.
    2026-11-19 LIVE: g antenatal (his yes: the 8 copied columns dropped by
    20261119011959; the Front Desk fills the antenatal booking's nine card
    details through save_antenatal_details, shown under the biodata when
    Antenatal is chosen; Edit and the patient's page read them back); j draft
    Continue/Discard, Correct 15 minutes, vital signs Void only; new
    scripts/visible-audit.cjs ("check that each button created, each section
    created can be seen"), in the screens skill. LEFT: l consent upload,
    i drug list (show SQL first), then the security review.
    2026-11-19, his notes after checking:
    - g layout: "put it below the patient bio data at the top... the moment
      the person selects antenatal, then that antenatal detail will just
      appear below it... before contact address... Then the same with next
      of kin, the extra information will just appear as part of the next of
      kin." Storage (booking, drop the 8 empty columns) still to confirm.
    - f: keep "Open RHEMA" at the bottom too.
    - d: only those who prescribe (doctors) see Prescription in the note;
      nurses see what was prescribed.
    - k: confirmed; the Pharmacy may dispense before payment (straight to
      the Pharmacy) and the Front Desk still sees it unpaid.
    - j drafts: the banner offers "Continue your consultation note" (or
      nursing note...) and "Discard draft". Discard deletes everything.
    - j Correct: "Let the [vital] sign just have void only." Correct
      expires: "30 minutes might even be too long, maybe 15 minutes.
      Otherwise, it's void."
    LATE 2026-11-18: LIVE: j drafts (consultation, prescription, lab
    request, nursing note, both sheets; 30 min, scrambled, wiped at sign
    out) and Correct (consultation notes, nursing notes, vital signs);
    b + Add another row on the treatment sheet; h Print and Email.
    g ON HOLD, WAITING FOR HIS YES: the antenatal booking already keeps the
    mother's and next of kin's details (antenatal_bookings client_* and
    kin_*). Migration 20261118211434 added 8 duplicate EMPTY columns to
    patients (live, unused). Proposed: drop them; registration writes the
    booking's fields (plus tribe) through a function the Front Desk may use
    for those fields only. Screens stashed ("227g antenatal screens").
    STATUS 2026-11-18 (evening): LIVE and checked: f (Back to the app),
    e (a stuck screen opens in full after 2.5 s; Refresh reloads a newer
    version), d (Prescription and Request lab inside the consultation,
    shared forms in components/orders), k (Waiting for payment on the
    patient's details and on Home, sent or not, including drugs already
    given; database migration 20261118170917), n (contrast-audit.cjs, all 45
    screens readable in both looks; 8 faint spots fixed). NEXT: j drafts and
    Correct; b + Add another row; g antenatal; h Print and Email; l consent
    upload; i drug list SQL (show first). Then the security review.
    STATUS 2026-11-18: f LIVE (Back to the app, to the exact screen left).
    a suspended. e: likely cause found (Refresh only refetches data, never
    reloads the app; a screen left on an old version stays stuck); fix
    proposed. i: about 80 names missing (list in the reply), SQL batch to
    be shown for his yes. b, c, d, g, h, j: plan sent, waiting for his yes.

226. **Nigeria time on screen; monthly text backup to the hospital's Drive.** (2026-11-17)
    a. Yes to always showing Nigeria time: "when the app does its own, it
       still maintains the server time... within the app it just uses the
       Nigeria time on its own. So if we deploy this same for a hospital in
       India... it still uses server time regardless, and everything is
       still correct... if the hospital downloads its data... still correct."
    b. "Directly connect their Google Drive [the rhemamedical7 account]...
       the system automatically downloads the data into their Google Drive
       ... once before we enter a new month... strip off every other thing
       and download the data based on text... create folders year by year,
       year 2026, year 2027... inside of year 2026, a zip file month by
       month... attached files will just be only in... Cloudflare." Asked
       whether a connector or API is needed. PLAN SENT, WAITING FOR HIS YES.
    b ANSWER (2026-11-17): "Okay, yes, let's do this." Then: "would I have
       to be repeating the same process for every hospital, or I can just
       create this thing with StellaXafe accounts instead of Rhema Medical,
       so that the app just has the connector... when we repurpose the app
       for another hospital, I won't have to go through the process again."
       Answered: one Google app under StellaXafe, made once; each hospital
       only taps Connect Google Drive in Admin and Allow.
       Decided 2026-11-17: NO password on the zip ("pointless adding
       password to the zip... the most important thing is to protect that
       account... add a two factor authenticator"). Two-step sign in on the
       hospital's Gmail goes in the setup steps.
    b STATUS: BUILT AND LIVE 2026-11-17, WAITING ON THE GOOGLE APP. Admin,
       Data: "Monthly copy to Google Drive" card (Connect, status,
       Disconnect). Worker /api/drive/start and /api/drive/callback: the key
       is sealed (AES-GCM, key from GOOGLE_CLIENT_SECRET) and handed back to
       the admin's page after a "#"; the page hands it in as the signed in
       admin (finish_drive_link, only the admin who started the code, 15
       minutes, once). The live timer starts drive-backup.yml at 21:17 UTC on
       the last day of the month, and on days 1 and 2 for the past month;
       it skips a month already saved. Zip: every table as CSV, text only,
       in "RHEMA backups/<year>/<year>-<mm> <Month>.zip". Privacy notice says
       so. Live and testing both answer "not set up" until the secrets are in.
       LEFT FOR ANTHONY: make the Google app under StellaXafe, put
       GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Cloudflare (both Workers)
       and GitHub secrets, tap Connect on live, turn on 2-Step Verification
       on the hospital's Gmail. LEFT FOR US: run drive-backup.yml once by hand
       and check the zip lands, then move 226b to DONE.
    b ASKED 2026-11-17 (late): "encryption is the word. So we can scramble
       it, then they'll not understand anything. But how do you now get the
       file to be readable eventually? ... it has to be scrambled with a key
       kept outside... outside the Google Drive." Explained: AES-256 zip
       (opens in free 7-Zip), long random key, kept as a GitHub secret for
       the job and on a printed recovery sheet in the hospital safe, plus a
       StellaXafe copy. WAITING FOR HIS YES. Not built.
       Token rights: GOOGLE app asks only drive.file (files it made) and
       email. GITHUB_BACKUP_TOKEN already could start any workflow; nothing
       new.
    a STATUS: LIVE 2026-11-17. Moments shown in HOSPITAL_TIME_ZONE
    (Africa/Lagos; NEXT_PUBLIC_TIME_ZONE per hospital); calendar dates never
    moved; days by the hospital's clock; the download's read me says UTC.

223. **LATER, REMIND HIM: eye comfort research.** (2026-11-17)
    "Save this for later, so you remind me... search open repos, different
    places in the internet, how... we can include [eye care] into the app...
    not just dimming the lights in a way that the system is no longer sharp
    ... so that when the person is looking at the screen, it will feel okay in
    the eyes, because some desktop, some older CPUs... even when you dim the
    lights... That's why I actually added dark mode. Then evaluate the rate at
    which people say that dark mode helps the eye... whether dark mode is just
    enough." Research only, after the current work; he decides later.

221. **The medical record page: get it right.** (2026-11-17)
    a. "When I click the button that says add, suspend, or stop medicine, why
       does it scroll down?... Why doesn't it open the charts?"
    b. "We have a drop-down button. This drop-down button itself is not as
       pronouncing as I expect it."
    c. Common words: "which one is for 2 days and for 1 week again? Inside of
       the list of medicine: painful urination, dizziness, chest pain."
    d. "As I am picking something, the thing is still taking me down to the
       bottom... You click one button, it will just scroll from the viewport."
    e. "What if the word is not there? Is there a place for the doctor to type
       in the word themselves?"
    f. Medicines: "what if the medication... is too plenty? You have to scroll
       to the bottom to see Other... I thought it's all the medicine in the
       pharmacy that will be displayed."
    g. "I'm on the dark mode. Let me change to light mode. It's not the same
       design."
    h. "Please go back to this page, this medical record page. We have to get
       it right... Check the consultation and... the medical records." Also
       asked whether records preload for when the internet drops.
    STATUS (2026-11-17): LIVE. The chart button opens the medicine list in
    place (Current medications and Doses given fold into the chart; both
    still print); drop downs return the field to its place after a pick
    (measured: 0 movement); Other sits under every list; the medicine picker
    lists every medicine with Cancel; a word not listed is typed in the drop
    down; durations left the symptom list; round blue fold arrows; 2 by 2
    summary on phones. Checked light and dark. Offline: a record opened in
    this session stays readable; keeping records on the device would be a
    patient data decision for him (NDPA), not made.

203. **Pitch: testing shows Okparavero Memorial Hospital.** (2026-11-16, he was
    at their hospital) "Let's just switch the testing site... then we revert it
    back to Rhema. Then later we settle down and do the multiple ones... we will
    still do for this particular one so that they can access it anytime." DONE
    on testing 2026-11-16 (brand okparavero, OM letters, logo too blurred). TO
    DO: put Rhema back on testing when he says (ops/pitch.json brand rhema), and
    give Okparavero its own lasting demo when the demos are built (198, 201).
    LAB (202) LIVE 2026-11-16, same day.

197. **Settings: do we need it?** (2026-11-16) "Find out if you are going to be
    needing a settings section and what are they going to be setting up... who
    has access to settings, who sees settings, and is settings going to be
    department by department... Does other softwares have that?... why should
    we?... we must design for flexibility, ease of use, lightness, reliability,
    security, durability." ANSWERED in chat 2026-11-16, waits for his decision.
198. **A demo per hospital on Vercel ("Vessel").** (2026-11-16) "Is it possible I
    connect my Vessel app here?... push a demo of what we are building... every
    hospital that I want to show... no password... no back end... they will just
    select front desk from the login page... hospitalname.vessel.app... even if
    they want to come back to the demo later." Read back to him 2026-11-16,
    waits for his yes and the platform choice (a new service costs money).
200. **Pickers as drop downs with search, and clean pages.** (2026-11-16) "Like
    this chemistry now... shouldn't it be just like a drop down? When they click
    on the drop down, they will now select and they should be able to search...
    type the first letter... put a visible drop down arrow on anyone that has a
    drop down... if the options are plenty, put a search... still put Other so
    they can enter what they have... every picker comes with its own number
    (medicine: name, then milligram, then dosage)... everything well arranged,
    very very clean in all screen sizes... on landscape the things that need to
    be horizontal can stay horizontal... on portrait one after the other...
    screenshot, look at it, then make it look better." Goes with 196d.
    LIVE 2026-11-16: one drop down (SearchSelect) for every pick list: arrow,
    search box on lists longer than 8, Other at the end. Request lab: all tests
    in one grouped drop down in place of the section chips. Page by page review
    (196d) still to do.

196. **Big batch, 2026-11-16 (his permission: "when you are done and you see that
    everything is okay, run the SQL that is needed to lock it in").**
    a. Lab: "take what is in Swift practice EMR and add it... later when I bring
       the list, check if any is missing... rewrite it the way our list is."
    b. Pharmacy: "add them, the starter list, all of it... add the milligram for
       picker... the dosage as well."
    c. Register from old file: "add the other fields but collapse them (address,
       next of kin and the others)." And: "a doctor can still view and add medical
       records to old patients, the way a normally registered patient would be."
    d. "Check every other section for where we would add pickers... organize each
       section... let every other page be as simple and well organized as Home, in
       landscape or portrait."
    e. Home buttons: "an admin who is also front desk or doctor: if a button could
       repeat itself, just one button... no point having that Invite staff big
       button anymore (it is in the sidebar)... announcements: put it inside
       Messages, an Announce button at the top for those who can announce... the
       front page will not have more than four buttons."
    f. Old files from photos: "we upload into Google Drive, then you look at the
       Google Drive and pick the major information and attach the file to each."
       Typed records from another hospital's software are easier (a file).
    g. Dark mode: "some of the nurses are complaining that it's too bright."
    h. "Every picker with a long list: a search where they type the first letter."
    STATUS 2026-11-16 (a, b, c, e, h LIVE since the merge 16510cc):
    - a. LIVE: 103 tests in 8 sections (lib/lab/catalogue.ts),
      Find a test search, browse by section, add a new test; result boxes with
      unit and usual range. No SQL needed. Waits for his own list to compare.
    - b. LIVE: migration 20261116060435 (about 400 more starter
      medicines with strengths, 42 more doses in mg, mcg, IU and ml). Test 039.
    - c. LIVE: More details (optional) folded on Register from old
      file. Doctors already open and add to old file records (checked).
    - e. CORRECTED 2026-11-16 (his words: "admin screen can remain the way it
      was... front desk... all of them that had only four big buttons can
      remain"). LIVE: only double role staff change: they see the four
      buttons of their patient role, Invite staff under Admin, Announce under
      Messages. Admin, nurse and Front Desk Home are back as before.
    - e (first version, replaced): Home has 4 big buttons; Announce sits in Messages.
    - h. LIVE: search box on every pick list longer than 12.
    - 189 antenatal visits and the registration pick lists: LIVE 2026-11-16.
    - g. LIVE 2026-11-16: Dark look in the menu, kept on the device. Light
      look unchanged (every colour named, same values). Receipt stays white.
    - Still to do: d (page by page review), f (Google Drive import design).

191. **Pick instead of type, everywhere.** (2026-11-16) "Doctors, nurses,
    pharmacy, laboratory, front desk, anywhere it is possible to populate with
    choices, we add... limit the typing to the bare minimum... consultation
    notes and nursing notes, where it is necessary to type." Step by step.
194. **Read old files from photos.** (2026-11-16) "If we snap the files of old
    patients and you extract the major details (name, phone, sex, age or date of
    birth, category, next of kin)... in batches of a hundred... if not clear,
    manually." He charges the hospital separately. Raised: real patient data must
    not pass through the chat (CLAUDE.md, NDPA); needs a way inside the app.
167. **LATER: patients get their own medical record by email.** (2026-11-09)
    "All they need to do is to send their REMA ID, their card ID with their
    phone number and their name... to records@rhemamedical.app, then
    automatically in return they will receive their medical records... for
    patients who travel out... they just email using the same email that
    they submitted with REMA. Otherwise the hospital will just have to
    manually send it to them via email or WhatsApp." Not now ("it's not an
    obstruction, so you can record it"). When built: send ONLY to the email
    already on the patient's record, never to the address that wrote in
    (an email's sender can be faked), and log every request.

162. **GitHub Actions out of free minutes; repository public for now.**
    (2026-11-09) Runs stopped: "recent account payments have failed or your
    spending limit needs to be increased" (about 2,000 free minutes used
    this month, mostly the checks). His decision: "let's make it public
    now... I will make it private by next month, or by the time we are
    done." History scanned first: no keys, no patient data. LICENSE changed
    on his word: "StellaXafe reserve the right to publish, reuse, and do
    anything with the code" (hospital data and branding still never
    shared). He switches visibility himself (Settings, Danger Zone); the
    session cannot. REMIND HIM to make it private again, and cut the checks
    first so 2,000 minutes a month are enough.

157. **His messages of 8 November evening (after the AWS profile photo).**
    Word for word where it matters:
    (a) Messages for everyone: "Messages is default for everyone. Everyone
        should be able to initiate message... you don't see messages that
        is not sent to your own department... general messages and
        messages sent to your department." "Everyone should have a room,
        including the admin, right? Or... the admin sees messages that are
        being sent to different departments." ANSWERED 2026-11-27: the admin sees every
        message (request 261).
    (b) "This refresh button, does it even work?" (Admin, Activity) It did,
        with no sign. Now it says Refreshing, shows the time, and the log
        updates by itself every 10 seconds. DONE on testing 2026-11-09.
    (c) "I also want updates to appear in the app without somebody having
        to refresh." Messages: a live signal (lib/live/changes.ts, no
        content in it) makes every open app fetch at once; heard in 40 ms on
        testing. DONE 2026-11-09. Every other save (patients, queue, lab,
        pharmacy, payments, announcements, calls, invitations) now sends
        the same kind of signal ("records"), noticed in one place (the
        database connection, lib/auth/clients.ts); Home, notices, the lab
        and pharmacy cards, announcements, the patient list, the open record,
        the activity log and the top bar counts fetch at once. Reads never
        send it (tested), so apps cannot set each other off.
    (d) "Is this even okay to publicly mention where our database is
        sitting?... Our backend services should be confidential." Privacy
        Policy no longer names any provider or place. DONE on testing.
    (e) "I sent an invitation to someone in the live site. The person did
        not get an email." Likely cause: testing and live share one Resend
        account, both number invitations from 1, and the Idempotency-Key
        was the number alone, so live's first invitation reused testing's
        key and Resend refused it. Key now includes the site. Resend's
        refusal reason is now logged. FIXED on testing; to confirm on live.
    (f) Installed app start: "as if they all plastered the logo... it
        didn't show dynamic loading." Start colour white (logo blends), then
        a white starting screen with the logo breathing and a moving bar.
        DONE on testing.
    (g) "We need an app refresher at the top bar... rotational arrow head."
        DONE on testing. And: "I gave myself a room, came back, it is still
        saying the same thing." Staff details now reload when the app comes
        back to the front, and on Refresh.
    (h) "Dr. Evans... was given access to consultant room 1, but he didn't
        receive any message." Same cause as (g): his app still held his old
        details. Fixed by (g) and (c).
    (i) "Maybe we should take it from 1 hour to 15 minutes." Lock after 15
        minutes, also checked the moment the app comes back. DONE on testing.
    (j) "Messages takes... almost a minute... make it instant." See (c).
    (k) "When a message drops... a pop sound. Pom pom." Our own soft two
        note sound (Apple's belongs to Apple), on the messages screen, for
        messages from others. DONE on testing.
    (l) "When the app is open for long, the buttons are dead... the buttons
        at the bottom." Cause: each deploy replaces the app's files; an app
        left open asks for files that are gone. Now the app checks which
        version is live when it comes back and reloads, and reloads if a
        screen file fails. DONE on testing.
    (m) "Register from old file... should be a secondary button." White
        with a blue outline now; Register patient stays the blue one. Find
        patient (Register screen) keeps its own raised look. DONE on testing.
    Also: CI turned red only because GitHub's store for test pictures was
    full; the pictures are now kept only when the test fails, for 3 days.

156. **Privacy Policy and Terms of Use, and the staff agreement tick.**
    (2026-11-08) "Write a standard privacy protection section and terms and
    agreement... put that button somewhere before you log in... it will
    include the Nigeria Data Protection Act... when a person is coming for
    the first time as an invited staff, the terms... should be at the
    bottom there for them to tick the button, so they are agreeing to
    protect patients' information... check Amara's own section... It
    stays outside of the app, just on its own... On desktop: developed by
    StellaXafe Technologies Limited at the mid bottom... On mobile phone,
    terms and privacy policy at the top left corner, so the developed by
    StellaXafe Technologies Limited still remains at the bottom." Then:
    AWS straight after church, then www and the little things.
    2026-11-08: Privacy Policy (/privacy/) and Terms of Use (/terms/) LIVE,
    linked from sign in (top left on a phone, bottom left on a computer),
    "Developed by StellaXafe Technologies Limited" bottom middle. The tick
    on the first Choose your PIN is BUILT on the feature branch (migration
    20261108061606_staff_terms_agreement, 6 tests, 8 breaks caught, walked
    at 320, 390, 1440). HIS YES 2026-11-08: "Yes, run SQL. Everyone should
    during pin set up and also myself that already uses the master account
    rhemamedical7@gmail.com. The other accounts I opened will be deleted."
    So AgreementGate (components/legal) also asks anybody signed in who has
    not agreed to the current words, before the install card.

154. **Email inside the app.** (2026-11-07) "They are not going to be
    sending email via Gmail... they will be sending their Gmail out from
    inside the app. So you have to create email section. You just put the
    button in back of the hamburger, and that place is where any email that
    is sent to info@... records@... the emails they are sending to them and
    the emails they are sending out, it will just be there... to reply
    emails... or send emails officially." "Plan the email, put the button
    there. If it requires me to do something, do the part you need to do
    and wait for me." Plan and his questions sent 2026-11-07; waiting.
    DECIDED 2026-11-07: NOT building it. "There's no point... because of
    that memory thing, I think we should focus on other things and leave
    that email. Let the admin just get it set up in their Gmail. So if they
    want to send email as info@, they will do it. And it's not only admin
    that can do that. Even doctor can still do it." So: incoming mail stays
    on Email Routing to Gmail; each person who sends as info@ or admin@
    sets Gmail "Send mail as" through Resend's SMTP with their own sending
    key. Steps to give him at the hospital.
    Also from that message: AWS watcher tomorrow (Sunday); Monday 9
    November is the handover day.

152. **Live on the real address, and the first real admin.** (2026-11-06,
    night) "You can fix the live, I don't know. Then tomorrow we are going
    to set up the admin account... admin at rhemamedical.app has to be set
    up. Then whoever logs in as the admin... will then become the one to
    invite others and make any other person an admin... before I probably
    will visit the hospital tomorrow evening. Then either the matron or the
    director would have to be made admin. Then we can still either change
    admin routing to that person's particular Gmail... and fix senders as
    well, so they can log in. Through the weekend we are just going to be
    checking things... the deploy role from AWS... tomorrow or Sunday."
    Steps: (a) live on rhemamedical.app tonight (nobody at the hospital has
    installed it yet, so nobody has to reinstall); (b) 7 Nov: admin@
    rhemamedical.app made admin on live. No SQL needed: Dr. Evans
    (rhemamedical7@gmail.com) is already admin on live (run
    40838481441), so he invites admin@ from Admin, Invite, and admin@
    signs in with the email code (2026-11-07, steps given); (c) at the hospital: the
    admin invites the matron or director and makes them admin; (d) maybe
    point admin@ routing to that person's Gmail; (e) weekend checks; (f)
    AWS DeployRoleArn, Saturday or Sunday.
    (a) DONE 2026-11-06 night: https://rhemamedical.app is live (health
    ok, sign in 200, the deploy's own smoke test passed on it). The old
    workers.dev address still works; it gets a redirect once the saved
    push address is moved (SQL on live, to be shown first). www is not
    set up yet.

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

133. **Screen text in full sentences.** (2026-11-02) "Better make a
    complete sentence... The fact that I said you should not write too many
    texts doesn't mean you should write in a way that somebody will not
    understand... don't unnecessarily explain, don't unnecessarily add
    extra text." Standing rule: short, but always a whole sentence that
    says what happened and what to do. Fixed the same day: the sign out
    warning, the waiting pill, "Not saved yet", the file messages.

134. **Anticipate the steps a flow needs.** (2026-11-02) "There are
    certain things that I might not remember to include. That little steps
    or... some buttons that may be missing. You should know that, oh, we'll
    probably need this thing... for easy flow. Without clutter, without
    having too many buttons." Standing rule, in the screens skill (2c).

135. **A thorough screen check, and a click-through check.** (2026-11-02)
    "improve the skill that checks... A skill that clicks through buttons."
    Done the same day: the layout check now covers phone, tablet portrait,
    tablet landscape and desktop and catches cut off text, squeezed
    headings, overlapping text and small buttons; scripts/screens/
    clickthrough.cjs presses every button. They found and fixed: the
    record header running into its buttons at 320, the Register from old
    file title on 3 lines, the chart period buttons and Open RHEMA too
    small to tap, and Back on the receipt (now Back to patient).

### Decided

- 2026-11-27: demos never use Supabase. "Cloudflare should be able to handle everything, even if you want to do anything database... Cloudflare worker should have been enough for it... let's leave Supabase out of it." The MASCAP app demo runs on the Cloudflare Worker alone, with made up data.

- 2026-11-26: the profile picture for staff is cancelled (201). New patients keep name, date of birth and sex as compulsory (199). Test prices learn from use as built (238); a hospital price list goes into Admin > Prices when it comes.

- **Outpatient bills are not filled in by themselves** (2026-11-26, closes
  request 257): "outpatients, they usually pay immediately for
  consultation... The reason we needed a record for inpatients is that
  sometimes they don't really pay bills immediately, and they can make a
  deposit... when they are about discharging, they will pay whatever the
  difference is." Only an admitted patient's bill starts with Medicines
  given, Take Home Drugs and Laboratory tests (live since request 240).

- **The antenatal card keeps its arrangement** (2026-11-26): the antenatal
  booking, About her, Medical history, Next of kin and more details,
  Routine tests, Previous pregnancies and Consent for an operation, each in
  its own section, in that order. "I like the arrangement that we did
  before. I don't think I want to change that arrangement."

- **CHANGED 2026-11-26 (request 252): no longer by itself. A save after 12
  hours is not saved; the screen sends them to open the record again.**
  Was: **A save after 12 hours opens the record again by itself** (2026-11-25,
  request 248): "what is the best option... as long as it doesn't affect
  the integrity of the data... allow them to continue even after the 12
  hours... the integrity of data is still solid." Built: a save refused for
  an old opening writes a new opening to the log (this person, this
  moment, only when somebody really saves, never on a timer), then tries
  the same save once more; medical permission is still checked. A screen
  past 12 hours keeps what it last read and says it has stopped updating,
  never shows empty lists. Offline entries sent later do the same. And he
  allowed reading the live error log: it showed a booking save refused for
  the number of abortions (24 Nov) and a BP top refused twice (25 Nov);
  both are now named on the screen before saving.

- 2026-11-22: a price set by a doctor, the matron or the lab is a
  suggestion. The Front Desk can change it and never waits for an approval.
  "A set price only acts as a suggestion not a blocker or a must."
- 2026-11-22: every staff role can see bills (procedures, operations, bed
  fee and the rest). "let everyone see the bill".
- 2026-11-06: Email Routing goes to rhemamedical7@gmail.com for now (the
  account made for the hospital, behind its Cloudflare, Supabase and
  Resend). "Use this one when I get to the hospital and then add it to
  their Gmail. It becomes their second Gmail." At handover: either point
  the rules at the hospital's official Gmail, or keep this one on their
  phones. records@ may carry patient reports (NDPA), so by handover it must
  land in an account the hospital controls.

- 2026-11-04: pitches keep the brand switch: "next time switching it
  becomes just one switch" (skill pitch-client, ops/pitch.json). Testing
  is back to Rhema. Automations stays in the menu on every build, live
  included: "the automation section, don't remove it... Keep it at the
  menu icon there... they will see that that's the next thing on the line."

- 2026-11-04, his answers to the say backs:
  - 141 "fee can be left empty"; Register from old file "not necessarily
    but during edit it can be found in case they're paying for something
    new/else".
  - 142 "if the sender's colleagues are also front desk they should also
    see it, except they are not in the same department or role level but
    each person's message must carry their name on it so everyone knows
    who said what." "reply goes to the office, so any matron in that
    office during that shift sees it but if you want to be specific, a
    person can be tagged by mentioning their name or clicking and holding
    their own previous chat so they know the message is for them even if
    another person in their role level can still see it (by role level I
    mean a colleague in the same room or office." Plus a General chat for
    everyone.
  - 144 "editing, yes go with your plan" (own messages, 15 minutes,
    "edited" shown, old wording kept in the activity log).
  - 140 and 147 "your recommendation for ended visit is okay": Move to
    another room, Has left (Front Desk and admin), calling the next
    patient finishes the one before, and open visits close by themselves
    at the end of the day.
  - 146 "you can run the SQL above". "check everything well."

- 2026-11-03: the Supabase keys stay as they are at handover. "Is it not
  the same key you have been using? Why change it?" He may rename the
  project on the 6th.

- 2026-11-03: the order on 6 November morning is: move the domain to the
  hospital's Cloudflare account, then Resend, then Email Routing, then
  the agent's part (the handover checklist above).

- 2026-11-02 evening: "Anything that doesn't involve me... you just do
  them. If you are going to run SQL, just show me the bash. Run them.
  Because it's already dark, so I can go and rest." So for the rest of
  2026-11-02 SQL batches are shown in the chat and run without waiting.

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
