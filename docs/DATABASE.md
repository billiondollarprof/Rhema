# DATABASE.md

The plan for the RHEMA database. Written 2026-10-28, for Anthony to approve
before any SQL runs. Every table and field below comes from the Rema demo
(`indexrema.html`) and the signed proposal. Nothing is added that the demo
does not show, except the safety parts marked **(security)**.

---

## 1. The rules every table follows

1. **RLS (row level security) is on from the moment a table is created.**
   The database itself decides who may read or change each row. Hiding a
   button in the app is never the protection.
2. **People who are not signed in get nothing.** No table can be read
   without signing in.
3. **A staff member who is switched off by the admin loses access at once**,
   even if they are still signed in on a phone.
4. **Nothing clinical is ever deleted.** A mistake is marked "voided" with
   a reason, and the original stays for the record. (security)
5. **Money is stored in kobo, as whole numbers.** ₦5,000 is stored as
   500000. Whole numbers never round wrongly; decimals can.
6. **The activity log is written by the database itself**, not by the app,
   so nobody can skip it or edit it afterwards. Nobody, the admin
   included, can change or delete a log line.
7. **The helper functions that check permissions live in a private area**
   that the internet cannot call. This also clears the 2 warnings
   Supabase's security check showed on the empty project.

---

## 2. Staff, roles and permissions

**`staff`**: one row per person who can sign in.

| Field | From the demo |
|---|---|
| full name, email | invite form |
| role | Front Desk, Doctor, Nurse / Matron, Pharmacy, Laboratory, Admin |
| room | Consultant Room 1, 2, 3, Matron's Office, Laboratory, Pharmacy |
| staff tag | like FD-01 |
| active | the admin can switch a person off |
| six permissions | register and find patients, medical records, pharmacy, laboratory, post announcements, activity logs |
| PIN | the 4 digit lock screen PIN, stored scrambled (hashed), never as the digits (security) |

The six permissions start from the role, exactly as the demo's invite
screen does, and the admin can tick or untick each one per person.

**`rooms`**: the six rooms above, so the admin can add a room later
without code changes.

**PIN safety (security):** 5 wrong PIN attempts signs the person out
completely, and they need a fresh email code to get back in. Otherwise
someone could just keep guessing 4 digits on an unattended desk.

---

## 3. Patients

**`patients`**: one row per patient.

| Field | From the demo |
|---|---|
| patient number | ROH-000001, given automatically, never typed |
| full name, date of birth, sex | Patient card |
| category | Individual, Family, Antenatal |
| phone / WhatsApp, email | Contact card |
| address, town or city, LGA, state, country | Address card |
| next of kin: name, relationship, phone | Next of kin card |
| family group | for the Family category |

**`families`**: the family name, so every member keeps their own patient
number but they stay linked, as in the demo.

**`patient_events`**: the "Patient journey" list. Each line is marked
clinical or not. Staff without medical record access only see the
non-clinical lines, the same as the demo.

---

## 4. Payments

**`payments`**: one row per payment.

| Field | From the demo |
|---|---|
| amount | in kobo |
| what it was for | Registration card, Consultation, Lab test, Scan, Drugs, Other |
| mode | Cash, POS, Transfer |
| description | optional |
| received by | the staff member who recorded it |

Only Front Desk and Admin can record a payment, as in the demo. A payment
is never edited or deleted. A wrong one is voided with a reason, and a
correct one is recorded in its place.

---

## 5. Queue and rooms

**`queue_entries`**: a patient sent to a room.

| Field | From the demo |
|---|---|
| room | where the patient was sent |
| note | for the receiving doctor or nurse |
| status | Waiting, In consultation, Lab, Pharmacy, Done |
| times | sent, called in, finished |

A doctor sees only their own room's queue, as in the demo.

---

## 6. The medical record (medical record permission only)

| Table | What it holds, from the demo |
|---|---|
| `medical_profiles` | blood group, genotype, "no known allergies", last menstrual period, gravida and para |
| `conditions` | the condition, active or resolved |
| `allergies` | one row per allergy |
| `vital_signs` | blood pressure, pulse, temperature, weight, height, SpO2 |
| `consultation_notes` | subjective, objective, assessment, plan (the SOAP note) |
| `antenatal_visits` | blood pressure, weight, fundal height, foetal heart rate |
| `custom_fields` | the "Add field" rows, label and value |
| `appointments` | date, time, reason |
| `prescriptions` | the medication, who prescribed it, and whether it was dispensed |

**Opening a record is logged, and the database enforces it (security).**
The proposal promises the admin can see who opened a record. So staff open
a record through one step that writes the log line first. The record's
tables only answer for a patient that this person has opened in the last
12 hours. If someone tries to read a record without opening it, they get
nothing, so the log can never be skipped.

---

## 7. Laboratory and pharmacy

**`lab_requests`**: the test, who asked for it, Pending or Result ready,
the result text, and a result file if one is uploaded. The laboratory sees
the requests sent to it, **not the rest of the medical record**.

**Pharmacy** sees `prescriptions` only: the medicine and the patient's
name and number. It **does not see** notes, conditions or vitals. Pharmacy
marks each one dispensed.

---

## 8. Talking to each other

| Table | What it holds |
|---|---|
| `conversations` | Everyone, a department (like "Doctor"), a direct chat, or a group |
| `conversation_members` | who is in a direct chat or a group |
| `messages` | the text, who sent it, when |
| `message_reads` | how far each person has read, for the unread counts |
| `alerts` | call attention and notices: to whom, the text, urgent or not, seen or not |
| `announcements` | to everyone, editable for 5 minutes only, as in the demo |
| `push_subscriptions` | the phones and computers that receive push alerts |

People only see conversations they belong to.

---

## 9. Activity logs (activity log permission only)

| Table | What it holds |
|---|---|
| `activity_log` | who did what, to which patient, and when |
| `staff_sessions` | sign in and sign out times, for the "Time online" figure |

---

## 10. Reminders (items 37 and 38 in `CURRENT.md`)

**`app_settings`**: the domain renewal date, the end of the free support
period, and the decision makers' emails. A scheduled job reads it for the
renewal reminder (one month before) and the 3 monthly maintenance reminder.

---

## 11. How it gets built and tested

1. Each change is a file in `supabase/migrations/`, numbered in order, with
   its undo file next to it in `supabase/rollbacks/`.
2. CI starts a throwaway Supabase on GitHub's computer, runs every
   migration, then runs the access tests. One test per rule, for example:
   "a pharmacist cannot read a consultation note" and "nobody can delete a
   log line". A failing test blocks the merge.
3. Supabase's security check runs too, and any warning fails the build.
4. Only then is the migration applied to the hospital's database, and
   Anthony is shown the SQL and its meaning first.
5. Test patients are made up, and the Python check from build step 3
   (`checks/fake_data_check.py`) makes sure of it.
