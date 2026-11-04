-- =============================================================================
-- 020_messages_general_tags_edits.sql: tests for the General chat, tags and
-- changing a message (requests 142 and 144).
--
-- What this is: proves General is read by everybody; a room still sees
-- what its own people send, and a third room does not; a reply tags the
-- person replied to; a tag must be somebody who can read the conversation;
-- only the sender changes a message, only for 15 minutes, and the old
-- wording is kept where the app cannot read it; the old send still works.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: two at the Front Desk, a matron, a doctor, a lab person =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000201', 't020-desk1@test.rhema'),
  ('00000000-0000-0000-0000-000000000202', 't020-desk2@test.rhema'),
  ('00000000-0000-0000-0000-000000000203', 't020-matron@test.rhema'),
  ('00000000-0000-0000-0000-000000000204', 't020-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000205', 't020-lab@test.rhema');
insert into public.staff (id, full_name, email, role, room_id) values
  ('00000000-0000-0000-0000-000000000201', 'Desk One',   't020-desk1@test.rhema',  'front_desk', (select id from public.rooms where name = 'Front Desk')),
  ('00000000-0000-0000-0000-000000000202', 'Desk Two',   't020-desk2@test.rhema',  'front_desk', (select id from public.rooms where name = 'Front Desk')),
  ('00000000-0000-0000-0000-000000000203', 'Matron One', 't020-matron@test.rhema', 'matron',     (select id from public.rooms where name = 'Matron''s Office')),
  ('00000000-0000-0000-0000-000000000204', 'Doctor One', 't020-doctor@test.rhema', 'doctor',     (select id from public.rooms where name = 'Consultant Room 1')),
  ('00000000-0000-0000-0000-000000000205', 'Lab One',    't020-lab@test.rhema',    'laboratory', (select id from public.rooms where name = 'Laboratory'));

create temporary table t (name text primary key, id bigint);
grant select, insert, update on t to authenticated;

-- Each person, as a short command.
create function pg_temp.act(person text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000020' || person)::text, true);
$$;


-- ===== 1. General is read by everybody =====
select pg_temp.act('1');
set local role authenticated;
insert into t values ('general', public.send_message_to(null, null, true, 'Staff meeting at 4.', gen_random_uuid(), null, null));
reset role;
do $$
declare person text;
begin
  foreach person in array array['2', '3', '4', '5'] loop
    perform pg_temp.act(person);
    set local role authenticated;
    if not exists (select 1 from public.messages where id = (select id from t where name = 'general')) then
      raise exception 'FAIL 1: person % could not read General', person;
    end if;
    reset role;
  end loop;
end $$;
\echo 'PASS 1: General is read by everybody'


-- ===== 2. A room still sees what its people send; a third room does not =====
select pg_temp.act('1');
set local role authenticated;
insert into t values ('to_lab', public.send_message_to('laboratory', (select id from public.rooms where name = 'Laboratory'), false, 'Is the result ready?', gen_random_uuid(), null, null));
reset role;
do $$
begin
  perform pg_temp.act('2');
  set local role authenticated;
  if not exists (select 1 from public.messages where id = (select id from t where name = 'to_lab')) then
    raise exception 'FAIL 2: a Front Desk colleague could not read what the Front Desk sent';
  end if;
  reset role;
  perform pg_temp.act('5');
  set local role authenticated;
  if not exists (select 1 from public.messages where id = (select id from t where name = 'to_lab')) then
    raise exception 'FAIL 2: the Laboratory could not read a message sent to it';
  end if;
  reset role;
  perform pg_temp.act('4');
  set local role authenticated;
  if exists (select 1 from public.messages where id = (select id from t where name = 'to_lab')) then
    raise exception 'FAIL 2: Consultant Room 1 read a message between the Front Desk and the Lab';
  end if;
  reset role;
end $$;
\echo 'PASS 2: a room sees its own people''s messages; a third room does not'


-- ===== 3. A reply tags the person replied to; a tag must be able to read =====
select pg_temp.act('5');
set local role authenticated;
insert into t values ('reply', public.send_message_to('front_desk', (select id from public.rooms where name = 'Front Desk'), false, 'Yes, it is ready.', gen_random_uuid(), (select id from t where name = 'to_lab'), null));
reset role;
do $$
begin
  if (select mention_staff from public.messages where id = (select id from t where name = 'reply'))
     is distinct from '00000000-0000-0000-0000-000000000201' then
    raise exception 'FAIL 3: a reply did not tag the person replied to';
  end if;
  -- The doctor is not at the Front Desk: tagging them there is refused.
  perform pg_temp.act('5');
  set local role authenticated;
  begin
    perform public.send_message_to('front_desk', (select id from public.rooms where name = 'Front Desk'), false,
      'Doctor, see this.', gen_random_uuid(), null, '00000000-0000-0000-0000-000000000204');
    raise exception 'FAIL 3: somebody who cannot read the conversation was tagged';
  exception when invalid_parameter_value then null;
  end;
  -- Consultant Room 1 cannot reply to a message it cannot read.
  reset role;
  perform pg_temp.act('4');
  set local role authenticated;
  begin
    -- Sent to the Front Desk, where the person replied to sits, so only the
    -- "may read it" rule can stop it.
    perform public.send_message_to('front_desk', (select id from public.rooms where name = 'Front Desk'), false,
      'Replying to what I cannot see.', gen_random_uuid(), (select id from t where name = 'to_lab'), null);
    raise exception 'FAIL 3: somebody replied to a message they cannot read';
  exception when invalid_parameter_value then null;
  end;
  -- Tagging a colleague in a group works when they are in a room of that kind.
  perform public.send_message_to('front_desk', null, false, 'Desk Two, please call me.',
    gen_random_uuid(), null, '00000000-0000-0000-0000-000000000202');
  reset role;
end $$;
\echo 'PASS 3: a reply tags its sender; a tag must be somebody who can read it'


-- ===== 4. Change your own message, for 15 minutes; the old wording is kept =====
select pg_temp.act('1');
set local role authenticated;
do $$
declare
  mine bigint := (select id from t where name = 'to_lab');
begin
  if public.edit_message(mine, 'Is the malaria result ready?') <> 'edited' then
    raise exception 'FAIL 4: the sender could not change their message';
  end if;
  if public.edit_message(mine, 'Is the malaria result ready?') <> 'same' then
    raise exception 'FAIL 4: the same wording twice was saved twice';
  end if;
  begin
    perform public.edit_message(mine, '   ');
    raise exception 'FAIL 4: a message was emptied';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform count(*) from public.message_edits;
    raise exception 'FAIL 4: the app could read the old wording';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if (select body from public.messages where id = (select id from t where name = 'to_lab')) <> 'Is the malaria result ready?'
     or (select edited_at from public.messages where id = (select id from t where name = 'to_lab')) is null then
    raise exception 'FAIL 4: the change or its "edited" mark was not saved';
  end if;
  if (select count(*) from public.message_edits where old_body = 'Is the result ready?') <> 1 then
    raise exception 'FAIL 4: the old wording was not kept once';
  end if;
  if not exists (select 1 from public.activity_log where table_name = 'message_edits') then
    raise exception 'FAIL 4: the change is not in the activity log';
  end if;
end $$;
-- Somebody else cannot change it, a colleague included.
select pg_temp.act('2');
set local role authenticated;
do $$
begin
  perform public.edit_message((select id from t where name = 'to_lab'), 'Changed by a colleague');
  raise exception 'FAIL 4: somebody changed another person''s message';
exception when insufficient_privilege then null;
end $$;
reset role;
-- After 15 minutes, not even the sender.
update public.messages set created_at = now() - interval '16 minutes' where id = (select id from t where name = 'to_lab');
select pg_temp.act('1');
set local role authenticated;
do $$
begin
  perform public.edit_message((select id from t where name = 'to_lab'), 'Too late');
  raise exception 'FAIL 4: a message was changed after 15 minutes';
exception when invalid_parameter_value then null;
end $$;
reset role;
\echo 'PASS 4: only the sender changes a message, for 15 minutes; the old wording is kept'


-- ===== 5. The old send still works; nothing by hand; nothing signed out =====
select pg_temp.act('3');
set local role authenticated;
do $$
begin
  if public.send_message('nursing', null, 'All nurses, a meeting at 3.', gen_random_uuid()) is null then
    raise exception 'FAIL 5: the old four part send stopped working';
  end if;
  begin
    update public.messages set body = 'by hand';
    raise exception 'FAIL 5: a message was changed by hand';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.messages (from_room_id, to_kind, to_room_id, to_everyone, body, client_key)
    values (5, 'nursing', null, true, 'bad shape', gen_random_uuid());
    raise exception 'FAIL 5: a message was written by hand';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  begin
    insert into public.messages (sent_by, from_room_id, to_kind, to_room_id, to_everyone, body, client_key)
    values ('00000000-0000-0000-0000-000000000203', 5, 'nursing', null, true, 'bad shape', gen_random_uuid());
    raise exception 'FAIL 5: General with a room kind was accepted';
  exception when check_violation then null;
  end;
  if has_function_privilege('anon', 'public.send_message_to(public.room_kind, bigint, boolean, text, uuid, bigint, uuid)', 'execute')
     or has_function_privilege('anon', 'public.edit_message(bigint, text)', 'execute') then
    raise exception 'FAIL 5: somebody not signed in may send or change messages';
  end if;
end $$;
\echo 'PASS 5: the old send works; nothing by hand; nothing for somebody signed out'

rollback;
