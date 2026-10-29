-- =============================================================================
-- 006_attention_calls.sql: tests for Call attention.
--
-- What this is: proves a call reaches the people on duty in the room called
-- and nobody else, that a double tap sends one call, that nobody can call
-- their own room, and that a call can only be made in your own name and
-- never changed.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: staff in different rooms, and two with no room =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a2', 'a-desk-noroom@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a3', 'a-doctor1@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a4', 'a-doctor2@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a5', 'a-nurse1@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a6', 'a-nurse-noroom@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a7', 'a-lab@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a8', 'a-gone@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a9', 'a-doctor-noroom@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Desk In Room',   'a-desk@test.rhema',         'front_desk'),
  ('00000000-0000-0000-0000-0000000000a2', 'Desk No Room',   'a-desk-noroom@test.rhema',  'front_desk'),
  ('00000000-0000-0000-0000-0000000000a3', 'Doctor Room One','a-doctor1@test.rhema',      'doctor'),
  ('00000000-0000-0000-0000-0000000000a4', 'Doctor Room Two','a-doctor2@test.rhema',      'doctor'),
  ('00000000-0000-0000-0000-0000000000a5', 'Nurse Station',  'a-nurse1@test.rhema',       'nurse'),
  ('00000000-0000-0000-0000-0000000000a6', 'Nurse No Room',  'a-nurse-noroom@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-0000000000a7', 'Lab In Room',    'a-lab@test.rhema',          'laboratory'),
  ('00000000-0000-0000-0000-0000000000a8', 'Gone Desk',      'a-gone@test.rhema',         'front_desk'),
  ('00000000-0000-0000-0000-0000000000a9', 'Doctor No Room', 'a-doctor-noroom@test.rhema', 'doctor');
update public.staff s set room_id = r.id from public.rooms r
where (s.email, r.name) in (('a-desk@test.rhema', 'Front Desk'),
                            ('a-doctor1@test.rhema', 'Consultant Room 1'),
                            ('a-doctor2@test.rhema', 'Consultant Room 2'),
                            ('a-nurse1@test.rhema', 'Nursing Station 1'),
                            ('a-lab@test.rhema', 'Laboratory'),
                            ('a-gone@test.rhema', 'Front Desk'));
update public.staff set is_active = false where email = 'a-gone@test.rhema';

-- How many calls a given person can read.
create function pg_temp.calls_seen_by(person uuid) returns bigint
language plpgsql as $$
declare seen bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', person)::text, true);
  set local role authenticated;
  select count(*) into seen from public.attention_calls;
  reset role;
  return seen;
end $$;


-- ===== 1. Doctor in Room 1 calls Front Desk: everyone on duty there =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
do $$
begin
  if public.call_attention('front_desk') <> 'sent' then
    raise exception 'FAIL 1: the call to Front Desk was not sent';
  end if;
end $$;
reset role;
do $$
begin
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a1') <> 1 then
    raise exception 'FAIL 1: the front desk person in the room did not get the call';
  end if;
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a2') <> 1 then
    raise exception 'FAIL 1: the front desk person with no room did not get the call';
  end if;
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a7') <> 0 then
    raise exception 'FAIL 1: the laboratory saw a call meant for Front Desk';
  end if;
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a4') <> 0 then
    raise exception 'FAIL 1: another doctor saw a call meant for Front Desk';
  end if;
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a9') <> 0 then
    raise exception 'FAIL 1: a doctor with no room saw a call meant for Front Desk';
  end if;
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a8') <> 0 then
    raise exception 'FAIL 1: a front desk person who has left saw the call';
  end if;
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a3') <> 1 then
    raise exception 'FAIL 1: the caller cannot see their own call';
  end if;
  if (select from_room_id from public.attention_calls) <> (select id from public.rooms where name = 'Consultant Room 1') then
    raise exception 'FAIL 1: the caller''s room was not recorded';
  end if;
end $$;
\echo 'PASS 1: a call to Front Desk reaches everyone on duty there, and nobody else'


-- ===== 2. A double tap sends one call =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
do $$
begin
  if public.call_attention('front_desk') <> 'already_sent' then
    raise exception 'FAIL 2: a second tap within 30 seconds was not treated as a double tap';
  end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.attention_calls) <> 1 then
    raise exception 'FAIL 2: a double tap made a second call';
  end if;
end $$;
\echo 'PASS 2: a double tap sends one call'


-- ===== 3. A call to Consultant Room 2 reaches that room only =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
select public.call_attention('consultation', (select id from public.rooms where name = 'Consultant Room 2'));
reset role;
do $$
begin
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a4') <> 1 then
    raise exception 'FAIL 3: the doctor in Room 2 did not get the call';
  end if;
  -- Doctor 1 sees only the call they made themselves, not this one.
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a3') <> 1 then
    raise exception 'FAIL 3: the doctor in Room 1 saw a call meant for Room 2';
  end if;
end $$;
\echo 'PASS 3: a call to one consultant room reaches that room only'


-- ===== 4. Nobody can call their own room, or their own group =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.call_attention('consultation', (select id from public.rooms where name = 'Consultant Room 1'));
    raise exception 'FAIL 4: a doctor called their own room';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.call_attention('nursing');
    raise exception 'FAIL 4: a nursing station called the nursing station group';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
\echo 'PASS 4: nobody can call their own room or their own group'


-- ===== 5. A room of the wrong kind is refused =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.call_attention('consultation', (select id from public.rooms where name = 'Laboratory'));
    raise exception 'FAIL 5: the laboratory was called as a consultant room';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
\echo 'PASS 5: a room of the wrong kind is refused'


-- ===== 6. The lab calls Nursing Station: every station, and a nurse with no room =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7"}', true);
set local role authenticated;
select public.call_attention('nursing');
reset role;
do $$
begin
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a5') <> 1 then
    raise exception 'FAIL 6: the nurse at Nursing Station 1 did not get the call';
  end if;
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a6') <> 1 then
    raise exception 'FAIL 6: the nurse with no room did not get the call';
  end if;
  if pg_temp.calls_seen_by('00000000-0000-0000-0000-0000000000a2') <> 1 then
    raise exception 'FAIL 6: the front desk saw a call meant for nursing';
  end if;
end $$;
\echo 'PASS 6: a call to Nursing Station reaches every station and the nurses with no room'


-- ===== 7. Nobody can write a call directly, change one, or delete one =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.attention_calls (called_by, to_kind)
    values ('00000000-0000-0000-0000-0000000000a4', 'front_desk');
    raise exception 'FAIL 7: a call was written directly, in another person''s name';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.attention_calls set to_kind = 'pharmacy';
    raise exception 'FAIL 7: a call was changed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.attention_calls;
    raise exception 'FAIL 7: a call was deleted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 7: calls are made only through call_attention, and never changed or deleted'


-- ===== 8. Not signed in, or no longer active: no calls =====
set local role anon;
do $$
begin
  begin
    perform public.call_attention('front_desk');
    raise exception 'FAIL 8: somebody not signed in made a call';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.call_attention('front_desk');
    raise exception 'FAIL 8: a member of staff who has left made a call';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.attention_calls) <> 0 then
    raise exception 'FAIL 8: a member of staff who has left can read calls';
  end if;
end $$;
reset role;
\echo 'PASS 8: nobody signed out or no longer active can call or read'


-- ===== 9. Every call goes in the activity log =====
do $$
begin
  if (select count(*) from public.activity_log where table_name = 'attention_calls') <> 3 then
    raise exception 'FAIL 9: the activity log does not hold the 3 calls';
  end if;
end $$;
\echo 'PASS 9: every call goes in the activity log'

rollback;
