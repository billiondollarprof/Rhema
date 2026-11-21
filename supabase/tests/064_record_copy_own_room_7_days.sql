-- =============================================================================
-- 064_record_copy_own_room_7_days.sql: tests for record_copy_own_room_7_days
-- (request 230c, 2026-11-20).
--
-- What this proves:
--   1. A nurse copies the patients seen in her own room in the last 7 days,
--      and one still in her room from longer ago; never another room's, never
--      one seen 8 days ago and finished.
--   2. At most 50, the newest first.
--   3. The copy is in the activity log, once within 11 hours.
--   4. Nobody without medical access, and nothing for somebody with no room.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000641', 't064-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000642', 't064-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000643', 't064-roomless@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000641', 'T64 Nurse',    't064-nurse@test.rhema',    'nurse',      true),
  ('00000000-0000-0000-0000-000000000642', 'T64 Desk',     't064-desk@test.rhema',     'front_desk', false),
  ('00000000-0000-0000-0000-000000000643', 'T64 Roomless', 't064-roomless@test.rhema', 'nurse',      true);
update public.staff set can_medical = false where id = '00000000-0000-0000-0000-000000000642';
insert into public.rooms (name, kind) values ('T64 Mine', 'nursing'), ('T64 Other', 'nursing');
update public.staff set room_id = (select id from public.rooms where name = 'T64 Mine')
 where id = '00000000-0000-0000-0000-000000000641';
update public.staff set room_id = null where id = '00000000-0000-0000-0000-000000000643';

insert into public.patients (full_name, date_of_birth, sex, created_by)
select 'T64 ' || name, '1990-01-01', 'female', '00000000-0000-0000-0000-000000000642'
from unnest(array['Mine 2 days', 'Mine 8 days', 'Mine open 10 days', 'Other room']) as name;
-- 55 more seen in my room over the last 3 days, for the limit of 50.
insert into public.patients (full_name, date_of_birth, sex, created_by)
select 'T64 Many ' || n, '1990-01-01', 'male', '00000000-0000-0000-0000-000000000642'
from generate_series(1, 55) as n;

insert into public.queue_entries (patient_id, room_id, sent_by, status, finished_at, created_at)
select p.id, r.id, '00000000-0000-0000-0000-000000000642', x.status::public.queue_status,
       case when x.status = 'done' then now() - x.age + interval '1 hour' end, now() - x.age
from (values
  ('T64 Mine 2 days',       'T64 Mine',  'done',    interval '2 days'),
  ('T64 Mine 8 days',       'T64 Mine',  'done',    interval '8 days'),
  ('T64 Mine open 10 days', 'T64 Mine',  'waiting', interval '10 days'),
  ('T64 Other room',        'T64 Other', 'done',    interval '1 day')
) as x(patient, room, status, age)
join public.patients p on p.full_name = x.patient
join public.rooms r on r.name = x.room;
insert into public.queue_entries (patient_id, room_id, sent_by, status, finished_at, created_at)
select p.id, r.id, '00000000-0000-0000-0000-000000000642', 'done',
       now() - interval '3 days' + (substring(p.full_name from '[0-9]+$')::int * interval '1 minute') + interval '1 hour',
       now() - interval '3 days' + (substring(p.full_name from '[0-9]+$')::int * interval '1 minute')
from public.patients p, public.rooms r
where p.full_name like 'T64 Many %' and r.name = 'T64 Mine';


-- ===== 1 and 2. My room, 7 days, open ones, at most 50 newest =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000641"}', true);
set local role authenticated;
do $$
declare
  copied bigint[] := public.copy_room_visits();
begin
  if cardinality(copied) <> 50 then
    raise exception 'FAIL 2: expected 50 copied, got %', cardinality(copied);
  end if;
  if copied[1] <> (select id from public.patients where full_name = 'T64 Mine 2 days') then
    raise exception 'FAIL 2: the newest is not first';
  end if;
  if (select id from public.patients where full_name = 'T64 Other room') = any (copied) then
    raise exception 'FAIL 1: another room''s patient was copied';
  end if;
  if (select id from public.patients where full_name = 'T64 Mine 8 days') = any (copied) then
    raise exception 'FAIL 1: a patient seen 8 days ago and finished was copied';
  end if;
end $$;
reset role;
\echo 'PASS 1: only my room, the last 7 days'
\echo 'PASS 2: at most 50, the newest first'


-- ===== 1b. A visit still open in my room is copied when there is room =====
delete from public.queue_entries
where patient_id in (select id from public.patients where full_name like 'T64 Many %');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000641"}', true);
set local role authenticated;
do $$
begin
  if not (select id from public.patients where full_name = 'T64 Mine open 10 days') = any (public.copy_room_visits()) then
    raise exception 'FAIL 1: a visit still open in my room was not copied';
  end if;
  if (select id from public.patients where full_name = 'T64 Mine 8 days') = any (public.copy_room_visits()) then
    raise exception 'FAIL 1: a patient seen 8 days ago and finished was copied';
  end if;
end $$;
reset role;
\echo 'PASS 1b: a visit still open in my room is copied'


-- ===== 3. In the activity log, once within 11 hours =====
do $$
declare mine bigint := (select id from public.patients where full_name = 'T64 Mine 2 days');
begin
  if (select count(*) from public.record_openings where patient_id = mine and purpose = 'offline_copy') <> 1 then
    raise exception 'FAIL 3: the copy was not logged once';
  end if;
  if not exists (select 1 from public.activity_log where patient_id = mine and action = 'offline_copy') then
    raise exception 'FAIL 3: the copy is not in the activity log';
  end if;
end $$;
\echo 'PASS 3: logged once within 11 hours'


-- ===== 4. Nobody without medical access; nothing without a room =====
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000642"}', true);
  set local role authenticated;
  begin
    perform public.copy_room_visits();
    reset role;
    raise exception 'FAIL 4: the Front Desk copied records';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000643"}', true);
  set local role authenticated;
  if cardinality(public.copy_room_visits()) <> 0 then
    reset role;
    raise exception 'FAIL 4: somebody with no room copied records';
  end if;
  reset role;
end $$;
\echo 'PASS 4: nobody without medical access; nothing without a room'

rollback;
