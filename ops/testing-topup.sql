-- =============================================================================
-- ops/testing-topup.sql: more made up data for the TESTING site, for the
-- parts built after the first demo data of 2026-10-31.
--
-- Why: request 137 (Anthony, 2026-11-04). He walks through every part of
-- the system himself. The first demo data covers patients, the queue, lab
-- and payments only, so Pharmacy, Messages, Announcements, families and the
-- medical record were empty. This fills only those.
--
-- What it adds, all made up:
--   1. three more staff who can never sign in (nurse, pharmacist, admin);
--   2. one family: Oghenekaro Ufuoma with his mother and his brother;
--   3. the medical record for 3 patients (allergy, condition, medicine,
--      vitals, consultation and nursing notes);
--   4. three prescriptions: one to pay, one to dispense, one dispensed;
--   5. messages between rooms, some read and some not;
--   6. one announcement.
--
-- Run by .github/workflows/testing-topup.yml, on the testing database only.
-- Once only: if the announcement below is already there, it stops and
-- changes nothing.
--
-- Never: run this on the live database. Never use a real name or number.
-- =============================================================================

\set ON_ERROR_STOP on

-- ===== 0. Once only, and only after the first demo data =====
select exists (select 1 from public.announcements
               where client_key = '00000000-0000-4000-8000-00000000de10') as topped_up \gset
\if :topped_up
  \echo 'The top up is already there. Nothing changed.'
  \q
\endif
select exists (select 1 from public.patients where phone = '08035550801') as seeded \gset
\if :seeded
\else
  \echo 'Refusing: the first demo data (testing-seed.yml) is not there.'
  \q
\endif

begin;

-- ===== 1. Three more made up staff (they can never sign in) =====
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000de04', 'demo-nurse@test.rhema',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000de05', 'demo-pharmacy@test.rhema', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000de06', 'demo-admin@test.rhema',    'authenticated', 'authenticated')
on conflict (id) do nothing;
insert into public.staff (id, full_name, email, role, room_id)
select v.id::uuid, v.name, v.email, v.role::public.staff_role, (select id from public.rooms where name = v.room)
from (values
  ('00000000-0000-0000-0000-00000000de04', 'Nurse Demo Ojo',      'demo-nurse@test.rhema',    'nurse',    'Nursing Station 1'),
  ('00000000-0000-0000-0000-00000000de05', 'Demo Pharmacist',     'demo-pharmacy@test.rhema', 'pharmacy', 'Pharmacy'),
  ('00000000-0000-0000-0000-00000000de06', 'Demo Administrator',  'demo-admin@test.rhema',    'admin',    null)
) as v(id, name, email, role, room)
on conflict (id) do nothing;
update public.staff set can_admin = true where id = '00000000-0000-0000-0000-00000000de06';

-- ===== 2. One family: Oghenekaro, his mother and his brother =====
-- Each part is done as the made up person who would do it, so the
-- activity log and the medicine history name somebody, as in real use.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000de02"}', true) as acting_as \gset
-- The family number (FAM-) is given by the database.
with family as (
  insert into public.families (created_by)
  values ('00000000-0000-0000-0000-00000000de02')
  returning id
)
update public.patients set family_id = (select id from family), category = 'family'
 where phone = '08035550803' and full_name = 'Oghenekaro Ufuoma';
insert into public.patients (full_name, date_of_birth, sex, category, family_id, phone, town, state,
                             next_of_kin_name, next_of_kin_relationship, next_of_kin_phone, created_by)
select v.name, v.born::date, v.sex::public.patient_sex, 'family',
       (select family_id from public.patients where phone = '08035550803' and full_name = 'Oghenekaro Ufuoma'),
       '08035550803', 'Sapele', 'Delta', v.kin, v.rel, v.kin_phone, '00000000-0000-0000-0000-00000000de02'
from (values
  ('Ese Ufuoma',   '1988-02-14', 'female', 'Omamuyovwi Ufuoma', 'Husband', '08035550863'),
  ('Ovie Ufuoma',  '2019-08-30', 'male',   'Ese Ufuoma',        'Mother',  '08035550853')
) as v(name, born, sex, kin, rel, kin_phone);

-- ===== 3. The medical record for 3 patients =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000de01"}', true) as acting_as \gset
-- Chinedu Okafor (fever), Funmilayo Adebayo (blood pressure), Blessing
-- Edewor (antenatal).
-- No blood group or genotype here: saving a profile fails today because
-- the activity log needs an id column, which medical_profiles does not have
-- (found 2026-11-04, fix waiting for Anthony's yes).

insert into public.allergies (patient_id, allergen, reaction, severe, recorded_by)
select id, 'Penicillin', 'Rash and swelling', true, '00000000-0000-0000-0000-00000000de01'
from public.patients where phone = '08035550801';

insert into public.conditions (patient_id, name, status, recorded_by)
select id, 'High blood pressure', 'active', '00000000-0000-0000-0000-00000000de01'
from public.patients where phone = '08035550804';

insert into public.patient_medications (patient_id, medicine, dose, how_often, status, added_by)
select id, 'Amlodipine 5 mg', '1 tablet', 'Once a day', 'active', '00000000-0000-0000-0000-00000000de01'
from public.patients where phone = '08035550804';

insert into public.vital_signs (patient_id, systolic, diastolic, pulse, temperature_c, spo2, weight_kg,
                                recorded_by, recorded_at)
select p.id, v.sys, v.dia, v.pulse, v.temp, v.spo2, v.weight, '00000000-0000-0000-0000-00000000de04',
       now() - v.ago::interval
from (values
  ('08035550801', 124::smallint, 80::smallint, 98::smallint,  38.6, 97::smallint, 78.0, '2 hours'),
  ('08035550804', 156,           94,           82,            36.8, 98,           71.5, '3 hours'),
  ('08035550804', 148,           90,           80,            36.7, 98,           71.5, '7 days'),
  ('08035550802', 112,           72,           88,            36.9, 99,           68.0, '1 hour')
) as v(phone, sys, dia, pulse, temp, spo2, weight, ago)
join public.patients p on p.phone = v.phone and p.family_id is null;

insert into public.consultation_notes (patient_id, complaint, findings, assessment, plan, written_by)
select p.id, v.complaint, v.findings, v.assessment, v.plan, '00000000-0000-0000-0000-00000000de01'
from (values
  ('08035550801', 'Fever and headache for 3 days.', 'Temperature 38.6. No neck stiffness.',
   'Likely malaria.', 'Full Blood Count and malaria test. Paracetamol for the fever.'),
  ('08035550804', 'Here for blood pressure review.', 'Blood pressure 156/94.',
   'High blood pressure, not well controlled.', 'Continue Amlodipine. Review in 2 weeks.')
) as v(phone, complaint, findings, assessment, plan)
join public.patients p on p.phone = v.phone;

insert into public.nursing_notes (patient_id, note, written_by)
select id, 'Antenatal check. Mother feels well. Baby moving well.', '00000000-0000-0000-0000-00000000de04'
from public.patients where phone = '08035550802';

-- ===== 4. Three prescriptions =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000de01"}', true) as acting_as \gset
-- a. Ibrahim Musa: waiting for payment at the Front Desk.
with rx as (
  insert into public.prescriptions (patient_id, note, prescribed_by, status)
  select id, 'Take after food.', '00000000-0000-0000-0000-00000000de01', 'awaiting_payment'
  from public.patients where phone = '08035550805'
  returning id
)
insert into public.prescription_items (prescription_id, drug, strength, dose, how_often, days, quantity)
select rx.id, v.drug, v.strength, v.dose, v.often, v.days, v.qty
from rx, (values
  ('Artemether/Lumefantrine', '80/480 mg', '1 tablet', 'Twice a day', 3, '6 tablets'),
  ('Paracetamol',             '500 mg',    '2 tablets', 'Three times a day', 3, '18 tablets')
) as v(drug, strength, dose, often, days, qty);

-- b. Godwin Akpobire: paid, waiting at the Pharmacy (he is in the Pharmacy queue).
with paid as (
  insert into public.payments (patient_id, amount, purpose, mode, description, received_by)
  select id, 4500.00, 'drugs', 'pos', 'Drugs: Amoxicillin, Vitamin C', '00000000-0000-0000-0000-00000000de02'
  from public.patients where phone = '08035550810'
  returning id, patient_id
), lines as (
  insert into public.payment_lines (payment_id, label, amount)
  select paid.id, v.label, v.amount from paid,
    (values ('Amoxicillin 500 mg', 3500.00), ('Vitamin C 100 mg', 1000.00)) as v(label, amount)
), rx as (
  insert into public.prescriptions (patient_id, prescribed_by, status, payment_id)
  select paid.patient_id, '00000000-0000-0000-0000-00000000de01', 'awaiting_dispense', paid.id from paid
  returning id
)
insert into public.prescription_items (prescription_id, drug, strength, dose, how_often, days, quantity)
select rx.id, v.drug, v.strength, v.dose, v.often, v.days, v.qty
from rx, (values
  ('Amoxicillin', '500 mg', '1 capsule', 'Three times a day', 5, '15 capsules'),
  ('Vitamin C',   '100 mg', '1 tablet',  'Once a day',        7, '7 tablets')
) as v(drug, strength, dose, often, days, qty);

-- c. Funmilayo Adebayo: paid yesterday and dispensed.
with paid as (
  insert into public.payments (patient_id, amount, purpose, mode, description, received_by, received_at)
  select id, 2500.00, 'drugs', 'cash', 'Drugs: Amlodipine', '00000000-0000-0000-0000-00000000de02',
         now() - interval '1 day'
  from public.patients where phone = '08035550804'
  returning id, patient_id
), lines as (
  insert into public.payment_lines (payment_id, label, amount)
  select paid.id, 'Amlodipine 5 mg', 2500.00 from paid
), rx as (
  insert into public.prescriptions (patient_id, prescribed_by, prescribed_at, status, payment_id,
                                    dispensed_at, dispensed_by)
  select paid.patient_id, '00000000-0000-0000-0000-00000000de01', now() - interval '1 day',
         'dispensed', paid.id, now() - interval '23 hours', '00000000-0000-0000-0000-00000000de05'
  from paid
  returning id
)
insert into public.prescription_items (prescription_id, drug, strength, dose, how_often, days, quantity)
select rx.id, 'Amlodipine', '5 mg', '1 tablet', 'Once a day', 30, '30 tablets' from rx;

-- ===== 5. Messages between rooms =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000de02"}', true) as acting_as \gset
-- The client_key is fixed, so the same message is never added twice.
insert into public.messages (sent_by, from_room_id, to_kind, to_room_id, body, client_key, created_at)
select v.sender::uuid, f.id, v.kind::public.room_kind, t.id, v.body, v.key::uuid, now() - v.ago::interval
from (values
  ('00000000-0000-0000-0000-00000000de02', 'Front Desk', 'consultation', 'Consultant Room 1',
   'Good morning, Doctor. Chinedu Okafor is waiting for you.', '00000000-0000-4000-8000-00000000de21', '50 minutes'),
  ('00000000-0000-0000-0000-00000000de01', 'Consultant Room 1', 'front_desk', 'Front Desk',
   'Thank you. Please send him in after his vitals.', '00000000-0000-4000-8000-00000000de22', '45 minutes'),
  ('00000000-0000-0000-0000-00000000de03', 'Laboratory', 'consultation', 'Consultant Room 1',
   'The results for Funmilayo Adebayo are ready.', '00000000-0000-4000-8000-00000000de23', '30 minutes'),
  ('00000000-0000-0000-0000-00000000de05', 'Pharmacy', 'front_desk', 'Front Desk',
   'We are out of Ciprofloxacin until Friday.', '00000000-0000-4000-8000-00000000de24', '15 minutes'),
  ('00000000-0000-0000-0000-00000000de02', 'Front Desk', 'nursing', null,
   'Two antenatal patients are coming in at 11.', '00000000-0000-4000-8000-00000000de25', '10 minutes')
) as v(sender, from_room, kind, to_room, body, key, ago)
join public.rooms f on f.name = v.from_room
left join public.rooms t on t.name = v.to_room
on conflict (client_key) do nothing;

-- The doctor has read the first message; the Front Desk has read the doctor's reply.
insert into public.message_reads (message_id, staff_id, read_at)
select m.id, v.reader::uuid, m.created_at + interval '2 minutes'
from (values
  ('00000000-0000-4000-8000-00000000de21', '00000000-0000-0000-0000-00000000de01'),
  ('00000000-0000-4000-8000-00000000de22', '00000000-0000-0000-0000-00000000de02')
) as v(key, reader)
join public.messages m on m.client_key = v.key::uuid
on conflict do nothing;

-- ===== 6. One announcement, shown for 7 days =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000de06"}', true) as acting_as \gset
insert into public.announcements (sent_by, body, show_until, client_key)
values ('00000000-0000-0000-0000-00000000de06',
        'Staff meeting on Friday at 4 pm in the Matron''s Office. Everybody should attend.',
        current_date + 7, '00000000-0000-4000-8000-00000000de10');

commit;

-- ===== 7. Say what was added =====
\echo 'Top up added: 3 staff, 1 family of 3, records for 3 patients, 3 prescriptions, 5 messages, 1 announcement.'
