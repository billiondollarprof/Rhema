# Handover: branch `claude/front-desk-228`, 19 to 24 November 2026

Written by the Claude agent that worked on branch `claude/front-desk-228`,
for Anthony and for the next agent. Every rule in `CLAUDE.md` still applies.
The requests themselves, in Anthony's words, are in `CURRENT.md` (open) and
`docs/DONE.md` (finished). The new tables are mapped in `docs/DATABASE.md`,
section 9b.

## 1. Where things stand (24 November 2026)

- **Everything below is live** on https://rhemamedical.app and on testing.
  `main` and `testing` hold the same code. The last database change on live
  is `20261123215523_inpatient_bill`.
- **Checks on 24 November, after the full review (request 244):**
  - `scripts/local-db.sh`: every one of the 75 migrations and every test
    passed (371 PASS lines), then the undo files and the migrations again.
  - `npm run verify`: green (57 + 75 unit tests, build, Python checks). The
    9 style warnings it prints were all there before this branch started
    (same lines on commit `cc3ef4c`); none come from this work.
  - `npm audit`: 0 problems.
  - Screen checks on 75 screens at phone (320, 360, 390), tablet portrait,
    tablet landscape and desktop: visible (208 words and buttons seen),
    layout (nothing spills or is cut off), contrast (light and dark).
  - Click-through: every button on every screen, as each role on the
    screens list (Front Desk, doctor, matron, nurse, Pharmacy, Lab, admin).
    None broke.
  - Every walk script of this branch re-run, each as the person who uses
    it (Front Desk, doctor, matron, nurse, Pharmacy), checking what each
    button sends to the database.
  - GitHub Actions: CI, Deploy, Database (testing), Database (live) and the
    2-hourly backup all green. Security warnings: 0 on testing and live.
- **One fault found and fixed in the review** (see section 4).
- **The live deploy of this review (commit `497b3b5`) failed once**, at its
  first step: Supabase's own management service answered 502 while the
  deploy fetched the site's public key. Nothing had been uploaded, so the
  live site kept the previous version. Re-run once (allowed by CLAUDE.md:
  it died before any test ran); it passed, with the smoke test passing on
  https://rhemamedical.app.

## 2. Every request handled, in order

Numbers are the request numbers in `CURRENT.md` / `docs/DONE.md`.

| No. | What | Database change | State |
| --- | --- | --- | --- |
| 228c | Front Desk takes vital signs (Take vitals) | `20261119132802_front_desk_takes_vitals` | Live |
| 228a | Unpaid drugs and lab tests expire after 72 hours (grey) | `20261119211756_unpaid_expire_after_72_hours` | Live |
| 228b | The family file first: category, family details, then members; edit the family; no card fee for added members | `20261120072145_family_file_first`, `20261120082841_families_details_only` | Live |
| 229 | Consultants void and correct only their own notes | `20261120040440_consultants_void_own_notes_only` | Live |
| 230 | Full review; lists load with the expiry; app files kept a year; Messages and History load in the background; record copy on the device (own room, 7 days); a new family waits on the device with no network | `20261120162058_record_copy_own_room_7_days` | Live |
| 231 | The Pharmacy sees every medicine (not 60); Add another strength or size | none | Live |
| 232 | Dispense and test before payment | `20261120130854_give_and_test_before_payment` | Live |
| 233 | Front Desk only, or Front Desk and Pharmacy / Lab | `20261120143627_lab_front_desk_only` | Live |
| 234 | Style checker updated, npm audit 0 | none | Live |
| 235.1 | Blood glucose (fasting or random, mmol/L or mg/dL), pain score, BMI | `20261121222211_vital_signs_glucose_pain` | Live |
| 235.2 | The doctor sets prices of drugs and tests; each person's last price | `20261122051713_doctor_sets_prices` | Live |
| 236 | "Make these the standard prices?"; drug prices on the Prices tab; Other vital sign jumps to its box and offers numbers typed before | `20261122154048_standard_prices_by_doctors` | Live |
| 237 | "Completed" as a reason to stop a medicine | none | Live |
| 235.3 | Add a bill (procedures, bed fee and the rest), Bills to pay at the Front Desk | `20261122204301_bills` | Live |
| 239 | A set price is a suggestion: the Front Desk can change it | `20261123082024_set_price_is_a_suggestion` | Live |
| 240g | Bill: a name typed with Other shows and comes back as a choice | none | Live |
| 240i | Back arrow on phones | none | Live |
| 241 | Anybody with medical access in a consulting room (matron too) prescribes, sets prices, adds bills | `20261123192759_consulting_room_does_what_a_doctor_does` | Live |
| 240, 242 | Inpatients: Admit / Discharge, deposits, chart days / doses / price per dose, Pharmacy Dispense from the chart, the stay's bill on the hospital's form with Preview, balance, bill receipt with signature lines | `20261123215523_inpatient_bill` | Live |
| 240h | Lab results one test at a time ("pending results" for the rest) | will need one | **Not built yet**: agreed in the order "g and i, then h, then the bill"; the bill was done first. Next in line |
| 238 | The lab sets a test price, the doctor approves | none | Dropped by Anthony ("do not suggest any price"); the Lab's older price suggestions to the admin (request 208) are still there, removal not yet asked |
| 243 | "Other" in every list always in blue | none | Saved for later, his word |
| 244 | This full check and these notes | none | Done |

Each database change has its undo file in `supabase/rollbacks/` and its
test in `supabase/tests/` (057 to 071), and was broken on purpose with
`scripts/mutate.sh` until every break was caught.

## 3. How the inpatient bill works (the most recent and largest piece)

1. **Admit** on the patient's page (Stay card): doctor or consulting room,
   matron, Front Desk. The patient shows "Inpatient since ...".
2. **Deposit**: the Front Desk, Take payment, Deposit, optional description.
3. **Chart**: the doctor charts medicine, how often, days; doses work out
   (`web/lib/record/doses.ts`) and can be changed; price of one dose (price
   setters only). Nurses tap Given: "2 of 6 doses given"; after the last,
   "All 6 doses are given. Give another?".
4. **Pharmacy**: on the patient's page, Given / Dispensed / Left and
   Dispense (how many doses). Each Dispense is logged.
5. **Bill** (`web/components/orders/BillForm.tsx`): Medicines given, Take
   Home Drugs and Laboratory tests fill in from `bill_statement`, with what
   each is made of for the doctor only; the form's 17 lines; Preview shows
   Total, Paid since admission and Balance; Send.
6. **Front Desk** (`web/components/work/BillsCard.tsx`): for an inpatient's
   bill, Take payment shows the stay's billed, paid and balance, and takes
   the balance (which it can change).
7. **Receipt** (`web/app/payments/receipt/page.tsx`): the bill's lines (no
   medicine or test names), total, paid since admission, balance, paid now,
   signature lines for the doctor and the patient.
8. **Discharge**: once a bill exists and nothing is owed, the doctor or
   matron sees "The bill is paid. Discharge this patient?".

## 4. Fault found in the review of 24 November, and fixed

- **The stay's lines on a bill could be removed, or left out when they had
  no price, while sending the bill still settled every prescription and lab
  test of the stay.** A take-home drug could then be marked paid without
  being charged. Fixed on screen: the three lines worked out from the stay
  always show when there is anything in them, cannot be removed, and a line
  with no price waits for an amount ("Type the amount").
- **The bill form's "Paid since admission" left out lab tests and drugs
  already paid on their own**, so the preview's balance was too high.
  Fixed: they are counted, the same way the database counts them once the
  bill covers them.
- No database change was needed for either.

## 5. Open

**Not built yet, already agreed:** request 240h, lab results one test at a
time. Today, saving results closes the whole lab request. Wanted: the Lab
sends the results that are ready; the others stay "Pending results" until
sent, even 3 days later. It will need a database change (a result per test
and a request that is complete only when every test has one), so the SQL
batch must be shown to Anthony first.

**His answers, 24 November:** build lab results one at a time (next);
an unpaid dispensed drug never expires (already so); no "settled by the
deposit" button, Discharge with nothing owed settles the stay's bills
(built, in the batch below); days and doses: stop and chart again (no
change); keep the Lab's price suggestions (208).

**Request 245, LIVE 24 November (his yes: "Yes, run it"):**
migration `20261124094742_bill_settles_only_its_lines` (a bill settles only
the stay's lines ticked onto it; Discharge with nothing owed settles the
stay's unpaid bills, with the latest deposit as the payment of what they
covered), test 072, 8 breaks caught; the bill form's "Put on this bill"
ticks.

Small known edges, written down so nobody is surprised:
- A dose given in the minute between opening the bill and sending it is
  counted after the bill (it goes on the next one).
- The 9 old style warnings (section 1) are someone else's to clear.

## 6. For the next agent: how this branch worked

- One task at a time: build, `scripts/local-db.sh`, `scripts/mutate.sh`,
  `npm run verify`, `scripts/screens/serve.sh` (run it again after
  `npm run verify`, which replaces the build), the three audits
  (`scripts/visible-audit.cjs`, `scripts/overflow-audit.cjs`,
  `scripts/contrast-audit.cjs`), the click-through
  (`scripts/screens/clickthrough.cjs`, over 10 minutes, run it in the
  background), then the `ship` skill.
- Every new screen goes in `scripts/screens/screens-list.cjs` with the words
  a person must see (`mustSee`). Headings are written in capitals on screen,
  so put body words, not headings, in `mustSee`.
- The made-up data for the inpatient screens is `STAY`, `STATEMENT` and
  `PAID_STATEMENT` at the top of `screens-list.cjs`.
- Who may do what is decided in the database. The screen helpers that only
  show buttons: `actsAsDoctor`, `setsPrices` (`web/lib/auth/roles.ts`),
  `canAdmit`, `canDischarge` (`web/lib/stay/stay.ts`), `takesPayments`.
- The double tap guard on doses given refuses the same person twice in one
  moment. A database test that writes several doses at once must use a
  different person for each (see test 071).

## 7. After the handover was first written (24 and 25 November)

- **245** (live): only the stay's lines ticked "Put on this bill" are
  settled by the bill; Discharge with nothing owed settles the stay's bills.
  Migration `20261124094742`, test 072.
- **240h** (live): lab results one test at a time. Migration
  `20261124172347`, test 073.
- **247** (live): Admitted on; chart dose prices fill from the standard and
  learn; unpriced doses on the bill with a one-dose price box; dispensed
  prescriptions kept off Medicines given; the Pharmacy's chart with Dispense
  and Returned. Migration `20261124200126`, test 075.
- **249** (open, later, his word): History shows the Front Desk's day with
  wrong amounts.
- Numbering: the other agent works on the same repository. Check
  `CURRENT.md` and `supabase/tests/` for the next free number after merging
  `testing`, before naming a request or a test.
