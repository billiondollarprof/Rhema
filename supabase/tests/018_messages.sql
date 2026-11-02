-- =============================================================================
-- 018_messages.sql: tests for messages, ticks and announcements.
--
-- What this is: proves a message goes from a room to a room and only those
-- rooms read it; a group message reaches every room of that kind; the same
-- key twice is one message; reads make the second tick and only for people
-- who may read; announcements need the permission and everybody reads
-- them; anything older than a year is deleted; nothing for signed out.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a0a1', 'ms-desk@test.rhema'),
  ('00000000-0000-0000-0000-00000000a0a2', 'ms-lab@test.rhema'),
  ('00000000-0000-0000-0000-00000000a0a3', 'ms-pharm@test.rhema'),
  ('00000000-0000-0000-0000-00000000a0a4', 'ms-nurse@test.rhema'),
  ('00000000-0000-0000-0000-00000000a0a5', 'ms-noroom@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-00000000a0a1', 'Ms Desk',   'ms-desk@test.rhema',   'front_desk'),
  ('00000000-0000-0000-0000-00000000a0a2', 'Ms Lab',    'ms-lab@test.rhema',    'laboratory'),
  ('00000000-0000-0000-0000-00000000a0a3', 'Ms Pharm',  'ms-pharm@test.rhema',  'pharmacy'),
  ('00000000-0000-0000-0000-00000000a0a4', 'Ms Nurse',  'ms-nurse@test.rhema',  'nurse'),
  ('00000000-0000-0000-0000-00000000a0a5', 'Ms Noroom', 'ms-noroom@test.rhema', 'doctor');
update public.staff s set room_id = r.id from public.rooms r
where (s.email, r.name) in (('ms-desk@test.rhema', 'Front Desk'),
                            ('ms-lab@test.rhema', 'Laboratory'),
                            ('ms-pharm@test.rhema', 'Pharmacy'),
                            ('ms-nurse@test.rhema', 'Nursing Station 1'));

create temporary table t (msg bigint);
grant select, insert, update on t to authenticated;
insert into t values (null);


-- ===== 1. Front Desk to Laboratory: only those two rooms read it =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a1"}', true);
set local role authenticated;
update t set msg = public.send_message('laboratory', (select id from public.rooms where name = 'Laboratory'),
  'Is the malaria result ready?', '11111111-aaaa-4aaa-8aaa-111111111111');
do $$
begin
  if public.send_message('laboratory', (select id from public.rooms where name = 'Laboratory'),
       'Is the malaria result ready?', '11111111-aaaa-4aaa-8aaa-111111111111') <> (select msg from t) then
    raise exception 'FAIL 1: the same message sent twice was saved twice';
  end if;
end $$;
reset role;
do $$
declare
  person text;
  sees int;
begin
  foreach person in array array['00000000-0000-0000-0000-00000000a0a2', '00000000-0000-0000-0000-00000000a0a3'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', person)::text, true);
    set local role authenticated;
    select count(*) into sees from public.messages;
    reset role;
    if person = '00000000-0000-0000-0000-00000000a0a2' and sees <> 1 then
      raise exception 'FAIL 1: the Laboratory could not read its message';
    end if;
    if person = '00000000-0000-0000-0000-00000000a0a3' and sees <> 0 then
      raise exception 'FAIL 1: the Pharmacy read a message meant for the Laboratory';
    end if;
  end loop;
end $$;
\echo 'PASS 1: room to room; only those rooms read it; the same key twice is one message'


-- ===== 2. Two ticks: the Laboratory reads it; the sender cannot fake it =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a1"}', true);
set local role authenticated;
do $$
begin
  if public.mark_messages_read(array[(select msg from t)]) <> 0 then
    raise exception 'FAIL 2: the sender marked their own message read';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a3"}', true);
set local role authenticated;
do $$
begin
  if public.mark_messages_read(array[(select msg from t)]) <> 0 then
    raise exception 'FAIL 2: the Pharmacy marked a message it cannot read';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a2"}', true);
set local role authenticated;
do $$
begin
  if public.mark_messages_read(array[(select msg from t)]) <> 1 then
    raise exception 'FAIL 2: the Laboratory could not mark it read';
  end if;
  perform public.mark_messages_read(array[(select msg from t)]);
end $$;
reset role;
do $$
begin
  if (select count(*) from public.message_reads) <> 1 then
    raise exception 'FAIL 2: expected exactly one read';
  end if;
end $$;
\echo 'PASS 2: only somebody who may read it, not the sender, marks it read, once'


-- ===== 3. A group: every room of a kind; no room, no sending; not your own room =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a2"}', true);
set local role authenticated;
select public.send_message('nursing', null, 'Samples collected', '22222222-aaaa-4aaa-8aaa-222222222222');
do $$
begin
  begin
    perform public.send_message('laboratory', (select id from public.rooms where name = 'Laboratory'),
      'Hello me', '33333333-aaaa-4aaa-8aaa-333333333333');
    raise exception 'FAIL 3: a room messaged itself';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a4"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.messages where body = 'Samples collected') then
    raise exception 'FAIL 3: a nursing station did not get the group message';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a5"}', true);
set local role authenticated;
do $$
begin
  perform public.send_message('front_desk', null, 'Hi', '44444444-aaaa-4aaa-8aaa-444444444444');
  raise exception 'FAIL 3: somebody with no room sent a message';
exception when invalid_parameter_value then null;
end $$;
reset role;
\echo 'PASS 3: a group reaches every room of its kind; no room or own room is refused'


-- ===== 4. Announcements: the permission to send; everybody reads =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a1"}', true);
set local role authenticated;
do $$
begin
  perform public.send_announcement('Staff meeting at 4', null, '55555555-aaaa-4aaa-8aaa-555555555555');
  raise exception 'FAIL 4: the Front Desk announced without the permission';
exception when insufficient_privilege then null;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a4"}', true);
set local role authenticated;
select public.send_announcement('Staff meeting at 4', null, '55555555-aaaa-4aaa-8aaa-555555555555');
select public.send_announcement('Staff meeting at 4', null, '55555555-aaaa-4aaa-8aaa-555555555555');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a3"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.announcements) <> 1 then
    raise exception 'FAIL 4: everybody should read exactly one announcement';
  end if;
  if (select show_until from public.announcements) <> current_date + 7 then
    raise exception 'FAIL 4: an announcement does not show for 7 days by default';
  end if;
  perform public.mark_announcement_read((select id from public.announcements));
end $$;
reset role;
\echo 'PASS 4: only the Announce permission sends; once per key; everybody reads'


-- ===== 5. Older than a year is deleted; nothing by hand; nothing signed out =====
update public.messages set created_at = now() - interval '13 months' where body = 'Samples collected';
do $$
begin
  if private.forget_old_messages() <> 1 then
    raise exception 'FAIL 5: expected one old message deleted';
  end if;
  if exists (select 1 from public.messages where body = 'Samples collected') then
    raise exception 'FAIL 5: a message older than a year is still there';
  end if;
  if not exists (select 1 from public.messages where body = 'Is the malaria result ready?') then
    raise exception 'FAIL 5: a recent message was deleted';
  end if;
  if has_function_privilege('anon', 'public.send_message(public.room_kind, bigint, text, uuid)', 'execute')
     or has_function_privilege('authenticated', 'private.forget_old_messages()', 'execute') then
    raise exception 'FAIL 5: the wrong people may call these';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a0a1"}', true);
set local role authenticated;
do $$
begin
  insert into public.messages (from_room_id, to_kind, body, client_key)
  values (1, 'laboratory', 'by hand', '66666666-aaaa-4aaa-8aaa-666666666666');
  raise exception 'FAIL 5: a message was written by hand';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 5: a year old is deleted, recent kept; nothing by hand or signed out'

rollback;
