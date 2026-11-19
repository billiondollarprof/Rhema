-- =============================================================================
-- 058_unpaid_expire_after_24_hours.sql: tests for unpaid_expire_after_24_hours
-- (request 228a, 2026-11-19).
--
-- What this proves:
--   1. Before expiring: one due to expire cannot be paid, dispensed or have
--      its sample taken; a young one can still be paid.
--   2. expire_unpaid() expires only the unpaid ones never given or tested
--      and older than 24 hours, as cancelled with the time; it answers how
--      many; it writes the activity log.
--   3. Never expired: paid, dispensed (owed), sample taken, tested (owed),
--      or younger than 24 hours.
--   4. Gone from the Front Desk's waiting list.
--   5. Nobody signed out, and no suspended staff, may run it; running it
--      twice changes nothing more.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000581', 't058-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000582', 't058-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000583', 't058-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-000000000584', 't058-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000585', 't058-gone@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000581', 'T58 Desk',     't058-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-000000000582', 'T58 Doctor',   't058-doctor@test.rhema',   'doctor'),
  ('00000000-0000-0000-0000-000000000583', 'T58 Pharmacy', 't058-pharmacy@test.rhema', 'pharmacy'),
  ('00000000-0000-0000-0000-000000000584', 'T58 Lab',      't058-lab@test.rhema',      'laboratory'),
  ('00000000-0000-0000-0000-000000000585', 'T58 Gone',     't058-gone@test.rhema',     'front_desk');
update public.staff set can_pharmacy = true where id = '00000000-0000-0000-0000-000000000583';
update public.staff set can_lab = true      where id = '00000000-0000-0000-0000-000000000584';
update public.staff set is_active = false   where id = '00000000-0000-0000-0000-000000000585';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T58 Patient', '1990-01-01', 'male', '00000000-0000-0000-0000-000000000581');

-- Made up prescriptions, each named by its note. "old" is 25 hours ago.
insert into public.prescriptions (patient_id, note, prescribed_by, prescribed_at, status, dispensed_at)
select p.id, x.note, '00000000-0000-0000-0000-000000000582', now() - x.age, x.status::public.prescription_status, x.dispensed
from public.patients p,
  (values
    ('T58 old waiting',        interval '25 hours', 'awaiting_payment',  null::timestamptz),
    ('T58 old straight',       interval '25 hours', 'awaiting_dispense', null),
    ('T58 old straight second', interval '25 hours', 'awaiting_dispense', null),
    ('T58 old given',          interval '25 hours', 'dispensed',         now() - interval '24 hours'),
    ('T58 old paid',           interval '25 hours', 'awaiting_payment',  null),
    ('T58 young',              interval '2 hours',  'awaiting_payment',  null)
  ) as x(note, age, status, dispensed)
where p.full_name = 'T58 Patient';
insert into public.prescription_items (prescription_id, drug)
select id, 'Paracetamol 500 mg tablet' from public.prescriptions where note like 'T58 %';

-- Made up lab requests, each named by its note.
insert into public.lab_requests (patient_id, tests, note, requested_by, requested_at, status, sample_taken_at, completed_at)
select p.id, array['Malaria parasite'], x.note, '00000000-0000-0000-0000-000000000582', now() - x.age,
       x.status::public.lab_status, x.sample, x.done
from public.patients p,
  (values
    ('T58 lab old waiting', interval '25 hours', 'awaiting_payment', null::timestamptz, null::timestamptz),
    ('T58 lab old straight', interval '25 hours', 'awaiting_test',   null, null),
    ('T58 lab old sample',  interval '25 hours', 'awaiting_test',    now() - interval '24 hours', null),
    ('T58 lab old tested',  interval '25 hours', 'completed',        now() - interval '24 hours', now() - interval '23 hours'),
    ('T58 lab young',       interval '2 hours',  'awaiting_payment', null, null)
  ) as x(note, age, status, sample, done)
where p.full_name = 'T58 Patient';

-- "old paid" was paid in time (made up as already paid).
insert into public.payments (patient_id, purpose, amount, mode, received_by)
select id, 'drugs', 500, 'cash', '00000000-0000-0000-0000-000000000581'
from public.patients where full_name = 'T58 Patient';
alter table public.prescriptions disable trigger prescriptions_refuse_expired;
update public.prescriptions set payment_id = (select max(id) from public.payments), status = 'awaiting_dispense'
 where note = 'T58 old paid';
alter table public.prescriptions enable trigger prescriptions_refuse_expired;


-- ===== 1. Before expiring: too late to pay, give or test =====
do $$
declare
  old_waiting bigint := (select id from public.prescriptions where note = 'T58 old waiting');
  old_straight bigint := (select id from public.prescriptions where note = 'T58 old straight');
  young bigint := (select id from public.prescriptions where note = 'T58 young');
  lab_old bigint := (select id from public.lab_requests where note = 'T58 lab old straight');
  lab_old_waiting bigint := (select id from public.lab_requests where note = 'T58 lab old waiting');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000581"}', true);
  set local role authenticated;
  begin
    perform public.pay_prescription(old_waiting, '[{"label": "Paracetamol", "amount": 300}]', 'cash');
    raise exception 'FAIL 1: an old unpaid prescription was paid';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.pay_lab_request_lines(lab_old_waiting, '[{"label": "Malaria parasite", "amount": 2000}]', 'cash');
    raise exception 'FAIL 1: an old unpaid lab test was paid';
  exception when invalid_parameter_value then null;
  end;
  if public.pay_prescription(young, '[{"label": "Paracetamol", "amount": 300}]', 'cash') <> 'paid' then
    raise exception 'FAIL 1: a young prescription could not be paid';
  end if;
  reset role;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000583"}', true);
  set local role authenticated;
  begin
    perform public.dispense_prescription(old_straight);
    raise exception 'FAIL 1: an old unpaid prescription was dispensed';
  exception when invalid_parameter_value then null;
  end;
  reset role;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000584"}', true);
  set local role authenticated;
  begin
    perform public.mark_sample_taken(lab_old);
    raise exception 'FAIL 1: a sample was taken for an old unpaid test';
  exception when invalid_parameter_value then null;
  end;
  reset role;
end $$;
\echo 'PASS 1: too late to pay, dispense or take a sample; a young one still pays'


-- ===== 2 and 3. Expire: only the right ones =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000581"}', true);
set local role authenticated;
do $$
declare
  how_many integer;
begin
  how_many := public.expire_unpaid();
  if how_many <> 5 then
    raise exception 'FAIL 2: expected 5 to expire, got %', how_many;
  end if;
end $$;
reset role;
do $$
declare
  wrong text;
begin
  select string_agg(note, ', ') into wrong from public.prescriptions
   where note like 'T58 %'
     and (status = 'voided' and expired_at is not null)
      <> (note in ('T58 old waiting', 'T58 old straight', 'T58 old straight second'));
  if wrong is not null then
    raise exception 'FAIL 2/3: wrong prescriptions expired or kept: %', wrong;
  end if;
  select string_agg(note, ', ') into wrong from public.lab_requests
   where note like 'T58 %'
     and (status = 'voided' and expired_at is not null)
      <> (note in ('T58 lab old waiting', 'T58 lab old straight'));
  if wrong is not null then
    raise exception 'FAIL 2/3: wrong lab requests expired or kept: %', wrong;
  end if;
  if exists (select 1 from public.prescriptions where note = 'T58 old given' and status <> 'dispensed') then
    raise exception 'FAIL 3: a given prescription changed';
  end if;
  if (select count(*) from public.activity_log
      where table_name in ('prescriptions', 'lab_requests') and action = 'update'
        and actor_id = '00000000-0000-0000-0000-000000000581') < 5 then
    raise exception 'FAIL 2: the expiring is not in the activity log';
  end if;
end $$;
\echo 'PASS 2: only unpaid ones never given or tested, older than 24 hours, expire'
\echo 'PASS 3: paid, given, sampled, tested and young ones stay'


-- ===== 4. Gone from the Front Desk's waiting list =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000581"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.prescriptions where payment_id is null and status <> 'voided'
             and note in ('T58 old waiting', 'T58 old straight')) then
    raise exception 'FAIL 4: an expired prescription is still waiting for payment';
  end if;
  if not exists (select 1 from public.prescriptions where payment_id is null and status <> 'voided'
                 and note = 'T58 old given') then
    raise exception 'FAIL 4: the owed prescription left the list';
  end if;
end $$;
reset role;
\echo 'PASS 4: expired ones leave the waiting list; owed ones stay'


-- ===== 5. Nobody signed out or suspended; twice changes nothing =====
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000585"}', true);
  set local role authenticated;
  begin
    perform public.expire_unpaid();
    reset role;
    raise exception 'FAIL 5: suspended staff ran it';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin
    perform public.expire_unpaid();
    reset role;
    raise exception 'FAIL 5: somebody signed out ran it';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000584"}', true);
  set local role authenticated;
  if public.expire_unpaid() <> 0 then
    reset role;
    raise exception 'FAIL 5: running it twice expired more';
  end if;
  reset role;
end $$;
\echo 'PASS 5: only active staff run it, and twice changes nothing'

rollback;
