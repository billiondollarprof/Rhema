-- =============================================================================
-- tests for flow_priority_not_given_sample_expiry (request 219c, 2026-11-17).
--
-- What this proves:
--   1. A visit starts Normal; staff with the patients permission set it to
--      Emergency; staff without it are refused; a wrong word is refused; a
--      closed visit says so; a moved patient keeps their priority.
--   2. A dose not given is saved with its reason and no dose; a one letter
--      reason is refused.
--   4. The Laboratory marks a sample taken once; a second tap says already;
--      an unpaid request says not paid; anybody without lab is refused.
--   6. The Pharmacy restocks with an expiry date; an expiry date on a
--      correction is refused; anybody but the Pharmacy is refused.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000471', 't047-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000472', 't047-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000473', 't047-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000474', 't047-pharm@test.rhema'),
  ('00000000-0000-0000-0000-000000000475', 't047-nopatients@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical, can_lab, can_patients) values
  ('00000000-0000-0000-0000-000000000471', 'T47 Desk',  't047-desk@test.rhema',  'front_desk', false, false, true),
  ('00000000-0000-0000-0000-000000000472', 'T47 Nurse', 't047-nurse@test.rhema', 'nurse',      true,  false, true),
  ('00000000-0000-0000-0000-000000000473', 'T47 Lab',   't047-lab@test.rhema',   'laboratory', false, true,  true),
  ('00000000-0000-0000-0000-000000000474', 'T47 Pharm', 't047-pharm@test.rhema', 'pharmacy',   false, false, true),
  ('00000000-0000-0000-0000-000000000475', 'T47 None',  't047-nopatients@test.rhema', 'laboratory', false, false, false);
insert into public.rooms (name, kind) values ('T47 Room A', 'nursing'), ('T47 Room B', 'consultation');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T47 Patient', '1990-01-01', 'female', '00000000-0000-0000-0000-000000000471');
insert into public.queue_entries (patient_id, room_id, sent_by)
select p.id, r.id, '00000000-0000-0000-0000-000000000471'
from public.patients p, public.rooms r
where p.full_name = 'T47 Patient' and r.name = 'T47 Room A';
insert into public.lab_requests (patient_id, tests, status, requested_by)
select id, array['PCV'], 'awaiting_test', '00000000-0000-0000-0000-000000000472'
from public.patients where full_name = 'T47 Patient';
insert into public.lab_requests (patient_id, tests, status, requested_by)
select id, array['FBC'], 'awaiting_payment', '00000000-0000-0000-0000-000000000472'
from public.patients where full_name = 'T47 Patient';
insert into public.medicine_list (name, strength, status, source, in_stock)
values ('T47 Medicine', '5 mg tablet', 'standard', 'pharmacy', 10);


-- ===== 1. Priority =====
do $$
begin
  if (select priority from public.queue_entries q join public.patients p on p.id = q.patient_id
      where p.full_name = 'T47 Patient') <> 'normal' then
    raise exception 'FAIL 1: a new visit is not Normal';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000471"}', true);
set local role authenticated;
do $$
declare
  visit bigint := (select q.id from public.queue_entries q join public.patients p on p.id = q.patient_id
                   where p.full_name = 'T47 Patient' and q.status <> 'done');
  moved bigint;
begin
  if public.set_priority(visit, 'emergency') <> 'done' then
    raise exception 'FAIL 1: the Front Desk could not set Emergency';
  end if;
  begin
    perform public.set_priority(visit, 'very bad');
    raise exception 'FAIL 1: a wrong word was taken as a priority';
  exception when invalid_parameter_value then null;
  end;
  moved := public.move_patient(visit, (select id from public.rooms where name = 'T47 Room B'), '');
  if (select priority from public.queue_entries where id = moved) <> 'emergency' then
    raise exception 'FAIL 1: the moved patient lost their priority';
  end if;
  if public.set_priority(visit, 'urgent') <> 'closed' then
    raise exception 'FAIL 1: a closed visit took a new priority';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000475"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.set_priority(1, 'normal');
    raise exception 'FAIL 1: staff without the patients permission set a priority';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 1: priority'


-- ===== 2. Not given, with a reason =====
insert into public.record_openings (staff_id, patient_id)
select '00000000-0000-0000-0000-000000000472', id from public.patients where full_name = 'T47 Patient';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000472"}', true);
set local role authenticated;
do $$
declare patient bigint := (select id from public.patients where full_name = 'T47 Patient');
begin
  insert into public.medications_given (patient_id, medicine, dose, not_given_reason, given_by)
  values (patient, 'T47 Medicine 5 mg tablet', null, 'Refused', '00000000-0000-0000-0000-000000000472');
  if not exists (select 1 from public.medications_given where patient_id = patient and not_given_reason = 'Refused') then
    raise exception 'FAIL 2: the not given dose was not saved';
  end if;
  begin
    insert into public.medications_given (patient_id, medicine, not_given_reason, given_by)
    values (patient, 'T47 Other medicine', 'x', '00000000-0000-0000-0000-000000000472');
    raise exception 'FAIL 2: a one letter reason was taken';
  exception when check_violation then null;
  end;
end $$;
reset role;
\echo 'PASS 2: not given, with a reason'


-- ===== 4. Sample taken =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000473"}', true);
set local role authenticated;
do $$
declare
  paid bigint := (select r.id from public.lab_requests r join public.patients p on p.id = r.patient_id
                  where p.full_name = 'T47 Patient' and r.status = 'awaiting_test');
  unpaid bigint := (select r.id from public.lab_requests r join public.patients p on p.id = r.patient_id
                    where p.full_name = 'T47 Patient' and r.status = 'awaiting_payment');
begin
  if public.mark_sample_taken(paid) <> 'done' then
    raise exception 'FAIL 4: the Laboratory could not mark the sample';
  end if;
  if public.mark_sample_taken(paid) <> 'already' then
    raise exception 'FAIL 4: a second tap marked it again';
  end if;
  if public.mark_sample_taken(unpaid) <> 'not_paid' then
    raise exception 'FAIL 4: an unpaid request was marked';
  end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.lab_requests where sample_taken_by = '00000000-0000-0000-0000-000000000473'
                 and sample_taken_at is not null) then
    raise exception 'FAIL 4: who and when were not written';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000471"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.mark_sample_taken(1);
    raise exception 'FAIL 4: the Front Desk marked a sample';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 4: sample taken'


-- ===== 6. Expiry date on new stock =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000474"}', true);
set local role authenticated;
do $$
declare medicine bigint := (select id from public.medicine_list where name = 'T47 Medicine');
begin
  if public.move_stock(medicine, 20, 'restock', null, '2027-03-31') <> 30 then
    raise exception 'FAIL 6: the restock did not add up';
  end if;
  begin
    perform public.move_stock(medicine, -2, 'correction', null, '2027-03-31');
    raise exception 'FAIL 6: an expiry date went on a correction';
  exception when invalid_parameter_value then null;
  end;
  -- The old way, without an expiry date, still works.
  if public.move_stock(medicine, -5, 'damaged', 'broken') <> 25 then
    raise exception 'FAIL 6: a move without an expiry date failed';
  end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.stock_moves m join public.medicine_list l on l.id = m.medicine_id
                 where l.name = 'T47 Medicine' and m.expiry_date = '2027-03-31' and m.reason = 'restock') then
    raise exception 'FAIL 6: the expiry date was not kept';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000472"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.move_stock((select id from public.medicine_list where name = 'T47 Medicine'), 5, 'restock', null, null);
    raise exception 'FAIL 6: a nurse moved stock';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 6: expiry date on new stock'

rollback;
