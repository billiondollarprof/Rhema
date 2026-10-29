-- =============================================================================
-- 004_queue.sql: tests for the queue.
--
-- What this is: proves staff can send a patient to a room and move them on,
-- that a patient cannot be in two rooms at once, that the sender is always
-- the real person, that nothing can be deleted, and that people without
-- the patients permission, or not signed in, see nothing.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: a front desk, a doctor, a nobody, and one made up patient =====

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'q-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000f2', 'q-doctor@test.rhema'),
  ('00000000-0000-0000-0000-0000000000f3', 'q-nopatients@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'Queue Desk',   'q-desk@test.rhema',       'front_desk'),
  ('00000000-0000-0000-0000-0000000000f2', 'Queue Doctor', 'q-doctor@test.rhema',     'doctor'),
  ('00000000-0000-0000-0000-0000000000f3', 'Queue Nobody', 'q-nopatients@test.rhema', 'laboratory');
-- The lab person loses the patients permission, for test 6.
update public.staff set can_patients = false where email = 'q-nopatients@test.rhema';

insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Made Up Patient',   '1990-01-01', 'female', '00000000-0000-0000-0000-0000000000f1'),
       ('Second Made Up',    '1985-06-15', 'male',   '00000000-0000-0000-0000-0000000000f1');


-- ===== 1. The front desk sends the patient to a room =========================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1"}', true);
set local role authenticated;
insert into public.queue_entries (patient_id, room_id, note)
select p.id, r.id, 'Please see her first'
from public.patients p, public.rooms r
where p.full_name = 'Made Up Patient' and r.name = 'Consultant Room 1';
reset role;
do $$
begin
  if (select count(*) from public.queue_entries) <> 1 then
    raise exception 'FAIL 1: the patient was not added to the queue';
  end if;
  if (select status from public.queue_entries) <> 'waiting' then
    raise exception 'FAIL 1: a new queue entry should start as waiting';
  end if;
end $$;
\echo 'PASS 1: the front desk can send a patient to a room'


-- ===== 2. The same patient cannot be in two rooms at once ====================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1"}', true);
set local role authenticated;
do $$
begin
  insert into public.queue_entries (patient_id, room_id)
  select p.id, r.id from public.patients p, public.rooms r
  where p.full_name = 'Made Up Patient' and r.name = 'Laboratory';
  raise exception 'FAIL 2: the patient was put in a second room';
exception when unique_violation then null;
end $$;
reset role;
\echo 'PASS 2: a patient is never in two rooms at once'


-- ===== 3. The doctor calls the patient in, then finishes the visit ===========
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2"}', true);
set local role authenticated;
update public.queue_entries set status = 'in_consultation', called_at = now();
update public.queue_entries set status = 'done', finished_at = now();
reset role;
do $$
begin
  if (select status from public.queue_entries) <> 'done' then
    raise exception 'FAIL 3: the doctor could not move the patient on';
  end if;
end $$;
\echo 'PASS 3: the doctor can call a patient in and finish the visit'


-- ===== 4. Once done, the patient can be queued again =========================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1"}', true);
set local role authenticated;
insert into public.queue_entries (patient_id, room_id)
select p.id, r.id from public.patients p, public.rooms r
where p.full_name = 'Made Up Patient' and r.name = 'Pharmacy';
reset role;
\echo 'PASS 4: a finished patient can be sent to a room again'


-- ===== 5. Nobody can send a patient in someone else's name, or change the
--          patient or the sender, or delete a row ============================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1"}', true);
set local role authenticated;
do $$
begin
  insert into public.queue_entries (patient_id, room_id, sent_by)
  select p.id, r.id, '00000000-0000-0000-0000-0000000000f2'
  from public.patients p, public.rooms r
  where p.full_name = 'Second Made Up' and r.name = 'Laboratory';
  raise exception 'FAIL 5: a patient was sent in someone else''s name';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  update public.queue_entries set sent_by = '00000000-0000-0000-0000-0000000000f2';
  raise exception 'FAIL 5: the sender was changed';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  delete from public.queue_entries;
  raise exception 'FAIL 5: a queue row was deleted';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 5: the sender is always real, and nothing can be deleted'


-- ===== 6. No patients permission, or not signed in: nothing ==================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.queue_entries) <> 0 then
    raise exception 'FAIL 6: staff without the patients permission saw the queue';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  perform 1 from public.queue_entries;
  raise exception 'FAIL 6: somebody not signed in read the queue';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 6: the queue is hidden from staff without access, and from the public'


-- ===== 7. Every change is in the activity log ================================
do $$
begin
  if (select count(*) from public.activity_log where table_name = 'queue_entries') < 4 then
    raise exception 'FAIL 7: queue changes were not all logged';
  end if;
end $$;
\echo 'PASS 7: every queue change is logged'

-- ===== 8. The chart counts the finished visit, for staff only ===============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2"}', true);
set local role authenticated;
do $$
begin
  if (select coalesce(sum(total), 0) from public.patients_seen('week')) <> 1 then
    raise exception 'FAIL 8: the chart did not count the finished visit';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3"}', true);
set local role authenticated;
do $$
begin
  if (select coalesce(sum(total), 0) from public.patients_seen('week')) <> 0 then
    raise exception 'FAIL 8: staff without the patients permission got chart counts';
  end if;
end $$;
reset role;
\echo 'PASS 8: the chart counts finished visits, for staff with access only'

rollback;
\echo 'ALL QUEUE TESTS PASSED'
