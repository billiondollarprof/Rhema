# FUTURE-FEATURES.md

Features Anthony has asked to keep **separate**: ideas for later versions,
and selling points when the system is offered to other hospitals. They are
not part of the RHEMA build unless he moves one into `CURRENT.md`.

Written down 2026-10-29, in his words where he gave them.

---

## 1. Messages to patients (automatic)

All of these need the patient's phone or email, and a sending service.
WhatsApp first, SMS if WhatsApp fails.

1. **Birthday wishes.** "Patients receive happy birthday wishes from the
   hospital automatically. So it will be WhatsApp first, then SMS fallback."
2. **Wellness check-in, 3 days after discharge.** Wish them a quick
   recovery; "if anything, they should not hesitate to call the hospital";
   check their email for their records and prescription; "remember to
   finish up their dosage as prescribed by the doctor".
3. **Check-up reminder, 1 month after discharge.** "Always remember to come
   for checkup."
4. **Appointment reminder, the day before.** "So they don't miss their
   appointment."

Needs: a WhatsApp Business sender and an SMS provider (both paid per
message in Nigeria), and a timer (Cloudflare cron) that checks every day
who is due.

To save money (Anthony, 2026-10-29: "which one do you think we don't need
to send? Maybe the 1 month wellness message"): keep the appointment
reminder on WhatsApp or SMS, because a missed appointment costs the
hospital. Send the others by email first (free on Resend), and only by
WhatsApp or SMS if the hospital chooses to pay for them. The 1 month
check-up message is the first to drop.

## 2. Weekly digest for consultants

Also a notification in the app and on the phone, with sound, that opens
the digest in the app (Anthony, 2026-10-29).


"Info at RHEMA Medical will be sending weekly digest to consultants'
email, the Gmail they used to register." Fits inside Resend's free plan
(3,000 emails a month, 100 a day). Content to agree with him: patients
seen, pending lab results, appointments coming up.

## 3. Documents: print or send to email

"There's a button that shows send to email and also print, so they can
decide." Every printable document (medical report, prescription, lab
result) gets both buttons. Sent from records@rhemamedical.app via Resend.

## 4. Staff calls inside the app (VoIP)

"Internal call within the staffs, not just calling for attention, but they
will actually pick it." A real voice call between staff in the app.
Separate from "Call attention", which is only an alert.

## 5. Automatic payment recording

"Some medical centers include automatic payments registration... if a
patient make a payment, they don't need to be entering it manually." For
example, a bank transfer or POS payment recorded by itself from the
bank's or POS provider's notification. Payment providers used in Nigeria
(Paystack, Flutterwave, Moniepoint and others) send these notifications to
an address we give them (a webhook). Until then, voice typing makes manual
entry fast.

## 6. Voice typing (speech to text)

"Our platform can even use voice to be entering data. If they don't want
to type, they can just click voice." Reuse Anthony's church voice
recognition, which is built for Nigerian accents, once it is finished.
For the front desk (payments, registration), doctors and the matron
(notes), and the chat.

---

## Already in the RHEMA plan, not here

- **Voice notes in chat** (record, send, the other person plays it). This
  needs no special integration: the browser records it, the file is kept
  in R2, and it is played back in the chat. It is built with the messages
  module.
- **Staff profile with photo**: dropped by Anthony on 2026-10-29 ("it's
  not a social media platform").
- **Call attention as a floating alert with a bell sound**: not future;
  built now with notifications (`CURRENT.md`, item 97).
