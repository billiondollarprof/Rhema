-- =============================================================================
-- 021_visit_endings.sql: tests for how a visit ends (requests 140 and 147).
--
-- What this is: proves a room's own Finish stamps the time and "finished";
-- calling in the next patient ends the one before, in that room only; Move
-- ends the old visit and starts a new one, once even for two taps; Has
-- left is for the Front Desk and admins only; the end of the day ends
-- yesterday's open visits and leaves today's; nothing for somebody signed
-- out.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: a Front Desk, a doctor, a lab person without the patients tick =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000211', 't021-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000212', 't021-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000213', 't021-lab@test.rhema');
insert into public.staff (id, full_name, email, role, room_id) values
  ('00000000-0000-0000-0000-000000000211', 'Desk V',   't021-desk@test.rhema',   'front_desk', (select id from public.rooms where name = 'Front Desk')),
  ('00000000-0000-0000-0000-000000000212', 'Doctor V', 't021-doctor@test.rhema', 'doctor',     (select id from public.rooms where name = 'Consultant Room 1')),
  ('00000000-0000-0000-0000-000000000213', 'Lab V',    't021-lab@test.rhema',    'laboratory', (select id from public.rooms where name = 'Laboratory'));
update public.staff set can_patients = false where id = '00000000-0000-0000-0000-000000000213';

insert into public.patients (full_name, date_of_birth, sex, created_by)
select 'Visit Patient ' || n, '1990-01-01', 'female', '00000000-0000-0000-0000-000000000211'
from generate_series(1, 6) n;

create function pg_temp.patient(n int) returns bigint language sql as $$
  select id from public.patients where full_name = 'Visit Patient ' || n
$$;
create function pg_temp.room(name text) returns bigint language sql as $$
  select id from public.rooms where rooms.name = room.name
$$;
create function pg_temp.open_visit(n int) returns public.queue_entries language sql as $$
  select * from public.queue_entries where patient_id = pg_temp.patient(n) and status <> 'done'
$$;

-- Patients 1 and 2 wait for Consultant Room 1; 3 is at the lab; 4 was sent yesterday.
insert into public.queue_entries (patient_id, room_id, sent_by) values
  (pg_temp.patient(1), pg_temp.room('Consultant Room 1'), '00000000-0000-0000-0000-000000000211'),
  (pg_temp.patient(2), pg_temp.room('Consultant Room 1'), '00000000-0000-0000-0000-000000000211'),
  (pg_temp.patient(3), pg_temp.room('Laboratory'),        '00000000-0000-0000-0000-000000000211');
insert into public.queue_entries (patient_id, room_id, sent_by, created_at) values
  (pg_temp.patient(4), pg_temp.room('Consultant Room 2'), '00000000-0000-0000-0000-000000000211', now() - interval '2 days');
-- Patient 6 is being seen in Consultant Room 3 right now.
insert into public.queue_entries (patient_id, room_id, sent_by, status, called_at) values
  (pg_temp.patient(6), pg_temp.room('Consultant Room 3'), '00000000-0000-0000-0000-000000000211', 'in_consultation', now());


-- ===== 1. Calling in the next patient ends the one before, in that room only =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000212"}', true);
set local role authenticated;
update public.queue_entries set status = 'in_consultation', called_at = now()
 where patient_id = pg_temp.patient(1);
update public.queue_entries set status = 'in_consultation', called_at = now()
 where patient_id = pg_temp.patient(2);
reset role;
do $$
declare first public.queue_entries;
begin
  select * into first from public.queue_entries where patient_id = pg_temp.patient(1);
  if first.status <> 'done' or first.finish_reason <> 'next_called' or first.finished_at is null then
    raise exception 'FAIL 1: calling in the next patient did not end the one before';
  end if;
  if (pg_temp.open_visit(2)).status <> 'in_consultation' then
    raise exception 'FAIL 1: the patient called in was ended too';
  end if;
  if (pg_temp.open_visit(3)).status is distinct from 'waiting'
     or (pg_temp.open_visit(6)).status is distinct from 'in_consultation' then
    raise exception 'FAIL 1: a patient in another room was ended';
  end if;
end $$;
\echo 'PASS 1: calling in the next patient ends the one before, in that room only'


-- ===== 2. The room's own Finish stamps the time and "finished" =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000212"}', true);
set local role authenticated;
update public.queue_entries set status = 'done' where patient_id = pg_temp.patient(2) and status <> 'done';
reset role;
do $$
begin
  if not exists (select 1 from public.queue_entries
                 where patient_id = pg_temp.patient(2) and finish_reason = 'finished' and finished_at is not null) then
    raise exception 'FAIL 2: Finish visit did not stamp the time and "finished"';
  end if;
  begin
    update public.queue_entries set finish_reason = null where patient_id = pg_temp.patient(2);
    raise exception 'FAIL 2: an ended visit was left without a reason';
  exception when check_violation then null;
  end;
end $$;
\echo 'PASS 2: Finish stamps the time and the reason'


-- ===== 3. Move: the old visit ends, a new one starts; twice is once =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000211"}', true);
set local role authenticated;
do $$
declare
  moved bigint;
  again bigint;
begin
  moved := public.move_patient((pg_temp.open_visit(3)).id, pg_temp.room('Consultant Room 1'), 'Doctor asked for him');
  again := public.move_patient((select id from public.queue_entries where patient_id = pg_temp.patient(3) and finish_reason = 'moved'),
                               pg_temp.room('Consultant Room 1'), 'Doctor asked for him');
  if moved is distinct from again then
    raise exception 'FAIL 3: two taps on Move made two visits';
  end if;
  if (select count(*) from public.queue_entries where patient_id = pg_temp.patient(3) and status <> 'done') <> 1
     or (pg_temp.open_visit(3)).room_id <> pg_temp.room('Consultant Room 1') then
    raise exception 'FAIL 3: the patient is not open in the new room only';
  end if;
  if not exists (select 1 from public.queue_entries
                 where patient_id = pg_temp.patient(3) and room_id = pg_temp.room('Laboratory')
                   and finish_reason = 'moved' and finished_at is not null) then
    raise exception 'FAIL 3: the lab visit did not end as moved';
  end if;
end $$;
reset role;
-- Without the patients tick, no Move.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000213"}', true);
set local role authenticated;
do $$
begin
  perform public.move_patient(1, 1, null);
  raise exception 'FAIL 3: somebody without the patients tick moved a patient';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 3: Move ends the old visit and starts one new visit; others cannot'


-- ===== 4. Has left: the Front Desk only (and admins) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000212"}', true);
set local role authenticated;
do $$
begin
  perform public.mark_left((pg_temp.open_visit(3)).id);
  raise exception 'FAIL 4: a doctor marked that a patient has left';
exception when insufficient_privilege then null;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000211"}', true);
set local role authenticated;
do $$
declare visit bigint := (pg_temp.open_visit(3)).id;
begin
  if public.mark_left(visit) <> 'left' then
    raise exception 'FAIL 4: the Front Desk could not mark that the patient has left';
  end if;
  if public.mark_left(visit) <> 'already_ended' then
    raise exception 'FAIL 4: Has left worked twice';
  end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.queue_entries
                 where patient_id = pg_temp.patient(3) and finish_reason = 'left' and finished_at is not null) then
    raise exception 'FAIL 4: Has left did not stamp the time and the reason';
  end if;
end $$;
\echo 'PASS 4: Has left is for the Front Desk, once, with the time'


-- ===== 5. The end of the day ends yesterday's open visits, not today's =====
insert into public.queue_entries (patient_id, room_id, sent_by)
values (pg_temp.patient(5), pg_temp.room('Pharmacy'), '00000000-0000-0000-0000-000000000211');
do $$
begin
  if private.close_old_visits() <> 1 then
    raise exception 'FAIL 5: the end of the day did not end exactly yesterday''s visit';
  end if;
  if not exists (select 1 from public.queue_entries where patient_id = pg_temp.patient(4) and finish_reason = 'end_of_day') then
    raise exception 'FAIL 5: yesterday''s visit is not marked as ended at the end of the day';
  end if;
  if (pg_temp.open_visit(5)).id is null then
    raise exception 'FAIL 5: today''s visit was ended';
  end if;
end $$;
\echo 'PASS 5: the end of the day ends yesterday''s visits and keeps today''s'


-- ===== 6. Nothing for somebody signed out; the nightly job is not a door =====
do $$
begin
  if has_function_privilege('anon', 'public.move_patient(bigint, bigint, text)', 'execute')
     or has_function_privilege('anon', 'public.mark_left(bigint)', 'execute')
     or has_function_privilege('authenticated', 'private.close_old_visits()', 'execute') then
    raise exception 'FAIL 6: a door is open to somebody it should not be';
  end if;
end $$;
\echo 'PASS 6: nothing for somebody signed out; only the nightly job ends the day'

rollback;
