# DATABASE.md

**Approved by Anthony on 2026-10-28.** Lock screen default 10 minutes. The
full medical record is for doctors, nurses and the matron only. The front
desk sees what the RHEMA demo shows it (registration, payments, the journey,
and prescriptions or results sent to it on purpose).

The plan for the RHEMA database. Version 2, written 2026-10-28, for Anthony
to approve before any SQL runs.

Sources:
- the RHEMA demo (`indexrema.html`);
- the signed proposal;
- the hospital's note, quoted in section 7;
- Anthony's corrections of 2026-10-28.

Parts the demo cannot show, because a demo has no real data, are marked
**(security)**. Ideas taken from Bahmni and Open Hospital (two well-known
open-source hospital systems) are marked **(borrowed)**. Only their ideas
are used, none of their code.

---

## 1. The rules every table follows

1. **RLS (row level security) is on from the moment a table is created.**
   The database itself decides who may read or change each row. Hiding a
   button in the app is never the protection.
2. **People who are not signed in get nothing.**
3. **A staff member the admin switches off loses access at once**, even if
   they are still signed in on a phone.
4. **Nothing clinical or financial is ever deleted.** A mistake is marked
   "voided" with a reason, and the original stays. (security)
5. **Money is in naira, with exactly 2 decimal places.** The database uses
   an exact number type, so ₦5,000.00 stays ₦5,000.00 and a total never
   rounds wrongly. The screen shows whole naira when there are no kobo.
6. **The activity log is written by the database itself**, so nobody can
   skip it, edit it or delete it, the admin included.
7. **The helper functions that check permissions live in a private area**
   that the internet cannot call. This also clears the 2 warnings that
   Supabase's security check showed on the empty project.

---

## 2. Signing in, the lock screen and the session

- **First sign in:** the admin invites the person, and they sign in with a
  code sent to their email. No passwords.
- **The lock screen:** after **10 minutes** with no use, the app locks and
  asks for the 4 digit PIN. The lock screen uses the RHEMA idle design
  (waves, ring, shimmer) with the PIN pad on it, so there is no separate
  idle screen. The admin can change the 10 minutes.
- **PIN safety (security):** the PIN is stored scrambled (hashed), never as
  the digits. 5 wrong tries signs the person out completely.
- **Long absence:** if an account has not been used for **24 hours**, the
  session ends, and the next visit needs a fresh email code.

---

## 3. Staff, roles, rooms and permissions

**`staff`**: one row per person who can sign in.

| Field | Source |
|---|---|
| full name, email | invite form |
| role | Front Desk, Doctor, Nurse / Matron, Pharmacy, Laboratory, Admin |
| room or desk | where they work, from `rooms` |
| staff tag | like FD-01 |
| active | the admin can switch a person off |
| permissions | register and find patients, medical records, pharmacy, laboratory, post announcements, activity logs |
| PIN | hashed (security) |

**`rooms`**: Consultant Room 1, 2, 3, Matron's Office, **Nursing Station
1, Nursing Station 2**, Laboratory, Pharmacy, Front Desk. The admin can add
or rename rooms later without code changes.

---

## 4. Patients and their status

**`patients`**:

| Field | Source |
|---|---|
| patient number | **RMC-000001**, given automatically, never typed |
| full name, date of birth, sex | demo |
| category | Individual, Family, Antenatal |
| phone / WhatsApp, email | demo |
| address, town or city, LGA, state, country | demo |
| next of kin: name, relationship, phone | demo |
| family group | demo |

**Patient status** (borrowed): every patient shows one clear status:

| Status | Meaning |
|---|---|
| Visiting | registered today, waiting or being seen as an outpatient |
| In consultation | with a doctor now |
| Admitted | on a ward |
| Discharged | admitted before, now gone home |

**`admissions`** (borrowed): admitted at, by whom, ward or bed, reason,
discharged at, discharged by, discharge note. "Admitted" and "Discharged"
come from here, so the history of every stay is kept.

**`patient_events`**: the "Patient journey" list. Clinical lines are hidden
from staff without medical record access, as in the demo.

---

## 5. Payments

**`payments`**: amount in naira (2 decimal places); what it was for
(Registration card, Consultation, Lab test, Scan, Drugs, Other); mode (Cash,
POS, Transfer); description; received by.

Front Desk and Admin record payments. A wrong one is voided with a reason
and recorded again correctly, never edited.

---

## 6. Queue

**`queue_entries`**: the room, a note for the receiving staff, the status
(Waiting, In consultation, Lab, Pharmacy, Done), and the times. A doctor
sees their own room's queue, as in the demo.

---

## 7. The hospital's note, and what it adds

The hospital's note, word for word:

> "Medical Reports for both nursing mothers and other patients.
> Nursing Station; Comment/report. They note the medications given/the
> vital signs. They note the time the medication was given.
> Sending Lab information to the front desk and to the nursing station.
> Also EMR where the records of their medications they're currently taking
> is; this is for the nursing station."

What each line adds:

| The note says | The plan |
|---|---|
| Medical reports for nursing mothers and others | a "Medical report" document for every patient, with an antenatal and nursing mother version that adds those details |
| Nursing station comment / report | `nursing_notes`: a nurse's comment or report on a patient, with time and author |
| Medications given, and the time given | `medications_given`: the medicine, the dose, **the exact time given**, and who gave it (borrowed: a medication administration record) |
| Vital signs | nurses record vital signs (section 8) |
| Lab information to front desk and nursing station | the lab can **send** a result to a named person or desk on purpose, for example the nursing station. Nobody gets an alert they did not ask for (section 10) |
| Current medications, for the nursing station | the patient's list of medicines they are on now, shown on the nursing station screen |

The system stays light: no scanning, no barcodes. A nurse opens a patient
and sees what they are on, and what was given when.

---

## 8. The medical record (medical record permission only)

| Table | What it holds |
|---|---|
| `medical_profiles` | blood group, genotype, no known allergies, last menstrual period, gravida and para |
| `conditions` | the condition, active or resolved |
| `allergies` | one row per allergy |
| `vital_signs` | blood pressure, pulse, temperature, weight, height, SpO2, who recorded it (doctor or nurse) |
| `consultation_notes` | subjective, objective, assessment, plan |
| `antenatal_visits` | blood pressure, weight, fundal height, foetal heart rate |
| `nursing_notes` | from section 7 |
| `medications_given` | from section 7 |
| `custom_fields` | the "Add field" rows |
| `appointments` | date, time, reason |
| `prescriptions` | see section 9 |

**Opening a record is logged, and the database enforces it (security).**
Opening a record writes "who opened which patient" first. The record only
answers for a patient this person opened in the last 12 hours. So the log
can never be skipped.

---

## 9. How prescriptions and lab requests move

**Prescriptions** follow the hospital's way of working:

1. The doctor writes the prescription.
2. The doctor sends it to the **Front Desk** for payment, or straight to
   the **Pharmacy** (for example, for an admitted patient).
3. Front Desk charges the patient. Once the payment is recorded and the
   prescription is marked **Paid**, Front Desk sends it on to the Pharmacy.
4. Pharmacy dispenses it and marks it **Dispensed**.
5. The medicine joins the patient's **current medications** list.

Status: Written, Waiting for payment, Paid, At pharmacy, Dispensed, Voided.

**Lab requests**:

1. The doctor sends the request to the Front Desk for payment, or straight
   to the Laboratory.
2. Front Desk records the payment, and the request shows **Awaiting test**.
3. The lab does the test and enters the result. The request shows
   **Completed**.
4. **Only the doctor who asked gets an alert.** Nobody else is alerted.

Status: Requested, Awaiting test, Completed, Voided.

**The lab can also add a report without a request**, for example a test the
patient came in for directly. The report goes into the patient's record, and
nobody is alerted. The next time a doctor opens the record, it is there in
the history.

**`lab_reports`**: the test, the result text or file, who did it, when, and
the request it answers if there was one.

**Who sees what (security):**
- The Front Desk sees the medicine names and prices so it can charge, but
  not the notes, conditions or vitals.
- The Pharmacy sees prescriptions only.
- The Laboratory sees its requests and the patient's name and number. It
  can add a lab report to the record. It never sees the medical history.
- The Front Desk never sees lab results.

---

## 10. Talking to each other

| Table | What it holds |
|---|---|
| `conversations` | Everyone, a department, a direct chat, or a group |
| `conversation_members` | who is in a direct chat or a group |
| `messages` | the text, who sent it, when |
| `message_reads` | for the unread counts |
| `alerts` | call attention and notices, urgent or not, seen or not |
| `announcements` | to everyone, editable for 5 minutes only |
| `push_subscriptions` | the phones and computers that receive push alerts |

Nurses and the nursing stations message and send alerts like every other
department.

**Alerts only go to the person they are for.** Anthony, 2026-10-28: "do not
be spamming people that do not ask for notification." So:
- A lab result alerts the doctor who requested it, and nobody else.
- Updating a record alerts nobody.
- "Call attention", a message, or a result sent on purpose alerts the
  person or desk it was sent to. The lab can send a result on purpose to the
  front desk or the nursing station when it matters.
- Everyone else sees new information when they next open the patient. The
  record is always current, so nobody needs an alert to find it.
- Nobody gets an alert about something that is not their business.

---

## 11. Activity logs (activity log permission only)

`activity_log`: who did what, to which patient, when.
`staff_sessions`: sign in and sign out times.

---

## 12. Reminders

`app_settings`: the domain renewal date, the end of the free support
period, the decision makers' emails, and the lock screen minutes.

---

## 13. How it gets built and tested

1. Each change is a numbered file in `supabase/migrations/`, with its undo
   file in `supabase/rollbacks/`.
2. CI starts a throwaway Supabase on GitHub's computer, runs every
   migration, then runs one access test per rule. For example, "a
   pharmacist cannot read a consultation note", "front desk cannot read
   vitals", and "nobody can delete a log line". A failing test blocks the
   merge.
3. Supabase's security check runs, and any warning fails the build.
4. Only then does Anthony see the SQL in plain words, and only after his
   yes does it reach the hospital's database.
5. All test patients are made up, and a Python check makes sure of it.
