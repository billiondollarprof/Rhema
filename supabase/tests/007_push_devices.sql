-- =============================================================================
-- 007_push_devices.sql: tests for Call attention step 2 (push).
--
-- What this is: proves a person can only add, see and remove their own
-- devices; that a call sends the push to the devices of the people called
-- and nobody else, once per device, never to the caller's own device; that
-- the message carries rooms only, never names; and that nothing is sent
-- until the Worker address and secret are in Vault.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000b01', 'p-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000b02', 'p-desk-noroom@test.rhema'),
  ('00000000-0000-0000-0000-000000000b03', 'p-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000b04', 'p-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000b05', 'p-gone@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000b01', 'Push Desk Person',  'p-desk@test.rhema',        'front_desk'),
  ('00000000-0000-0000-0000-000000000b02', 'Push Desk NoRoom',  'p-desk-noroom@test.rhema', 'front_desk'),
  ('00000000-0000-0000-0000-000000000b03', 'Push Doctor Person','p-doctor@test.rhema',      'doctor'),
  ('00000000-0000-0000-0000-000000000b04', 'Push Lab Person',   'p-lab@test.rhema',         'laboratory'),
  ('00000000-0000-0000-0000-000000000b05', 'Push Gone Person',  'p-gone@test.rhema',        'front_desk');
update public.staff s set room_id = r.id from public.rooms r
where (s.email, r.name) in (('p-desk@test.rhema', 'Front Desk'),
                            ('p-doctor@test.rhema', 'Consultant Room 1'),
                            ('p-lab@test.rhema', 'Laboratory'),
                            ('p-gone@test.rhema', 'Front Desk'));

-- Turn on alerts as one person, for one made up push address.
create function pg_temp.turn_on(person uuid, endpoint text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', person)::text, true);
  set local role authenticated;
  perform public.register_push_device(endpoint, repeat('k', 87), repeat('a', 22));
  reset role;
end $$;

-- The push requests queued for the test address.
create function pg_temp.pushes() returns setof jsonb
language sql as $$
  select convert_from(body, 'UTF8')::jsonb from net.http_request_queue
  where url = 'https://push-test.invalid/api/push/attention' order by id;
$$;

-- Make a call as one person.
create function pg_temp.call_as(person uuid, kind public.room_kind, room bigint default null) returns text
language plpgsql as $$
declare result text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', person)::text, true);
  set local role authenticated;
  result := public.call_attention(kind, room);
  reset role;
  return result;
end $$;


-- ===== 1. Nobody holds rights they should not have =====
do $$
begin
  if has_table_privilege('authenticated', 'public.push_devices', 'INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL 1: signed in users can write push_devices directly';
  end if;
  if has_table_privilege('anon', 'public.push_devices', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL 1: the public has rights on push_devices';
  end if;
end $$;
\echo 'PASS 1: nobody holds rights to write devices directly'


-- ===== 2. You add your own device, once, and only you can see it =====
select pg_temp.turn_on('00000000-0000-0000-0000-000000000b01', 'https://push.example/desk-phone');
select pg_temp.turn_on('00000000-0000-0000-0000-000000000b01', 'https://push.example/desk-phone');
do $$
begin
  if (select count(*) from public.push_devices where endpoint = 'https://push.example/desk-phone') <> 1 then
    raise exception 'FAIL 2: turning on twice made two rows';
  end if;
  if (select staff_id from public.push_devices where endpoint = 'https://push.example/desk-phone')
     <> '00000000-0000-0000-0000-000000000b01' then
    raise exception 'FAIL 2: the device was saved under the wrong person';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b04"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.push_devices) <> 0 then
    raise exception 'FAIL 2: another person can see a device that is not theirs';
  end if;
end $$;
reset role;
\echo 'PASS 2: you add your own device once, and nobody else can see it'


-- ===== 3. Not signed in, or no longer active: cannot turn alerts on =====
update public.staff set is_active = false where email = 'p-gone@test.rhema';
do $$
begin
  begin
    perform pg_temp.turn_on('00000000-0000-0000-0000-000000000b05', 'https://push.example/gone');
    raise exception 'FAIL 3: somebody who has left turned alerts on';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role anon;
do $$
begin
  begin
    perform public.register_push_device('https://push.example/anon', repeat('k', 87), repeat('a', 22));
    raise exception 'FAIL 3: somebody not signed in turned alerts on';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 3: nobody signed out or no longer active can turn alerts on'


-- ===== 4. Until Vault has the Worker address and secret, nothing is sent =====
do $$
begin
  if pg_temp.call_as('00000000-0000-0000-0000-000000000b03', 'front_desk') <> 'sent' then
    raise exception 'FAIL 4: the call itself was not saved';
  end if;
  if (select count(*) from pg_temp.pushes()) <> 0 then
    raise exception 'FAIL 4: a push was queued before the Worker address and secret were set';
  end if;
end $$;
\echo 'PASS 4: nothing is sent until the Worker address and secret are set'


-- ===== 5. A call sends one push, to the right devices only =====
select vault.create_secret('https://push-test.invalid', 'rhema_push_url');
select vault.create_secret('test-secret-not-real', 'rhema_push_secret');
-- The second front desk person shares the desk computer, and has a phone.
select pg_temp.turn_on('00000000-0000-0000-0000-000000000b02', 'https://push.example/desk-phone');
select pg_temp.turn_on('00000000-0000-0000-0000-000000000b02', 'https://push.example/noroom-phone');
-- The lab and the doctor have devices too; neither should get this call.
select pg_temp.turn_on('00000000-0000-0000-0000-000000000b04', 'https://push.example/lab-pc');
select pg_temp.turn_on('00000000-0000-0000-0000-000000000b03', 'https://push.example/doctor-phone');
-- The person who left still has an old device row from before.
insert into public.push_devices (staff_id, endpoint, p256dh, auth_key)
values ('00000000-0000-0000-0000-000000000b05', 'https://push.example/gone-phone', repeat('k', 87), repeat('a', 22));

-- The doctor in Consultant Room 1 calls the pharmacy first, nobody has a
-- device there, so nothing is sent...
do $$
begin
  perform pg_temp.call_as('00000000-0000-0000-0000-000000000b03', 'pharmacy');
  if (select count(*) from pg_temp.pushes()) <> 0 then
    raise exception 'FAIL 5: a push was queued for a call with no devices to reach';
  end if;
end $$;
-- ...then the lab calls Front Desk.
do $$
declare
  push jsonb;
  endpoints text[];
begin
  perform pg_temp.call_as('00000000-0000-0000-0000-000000000b04', 'front_desk');
  if (select count(*) from pg_temp.pushes()) <> 1 then
    raise exception 'FAIL 5: one call should queue exactly one push request';
  end if;
  select p into push from pg_temp.pushes() p;
  select array_agg(t ->> 'endpoint' order by t ->> 'endpoint') into endpoints
  from jsonb_array_elements(push -> 'targets') t;
  if endpoints <> array['https://push.example/desk-phone', 'https://push.example/noroom-phone'] then
    raise exception 'FAIL 5: wrong devices %', endpoints;
  end if;
  if push ->> 'body' <> 'Laboratory is calling Front Desk' then
    raise exception 'FAIL 5: wrong words "%"', push ->> 'body';
  end if;
  if push::text like '%Push %Person%' or push::text like '%NoRoom%' then
    raise exception 'FAIL 5: a person''s name is in the push';
  end if;
  if (select headers ->> 'X-Rhema-Push-Secret' from net.http_request_queue
      where url = 'https://push-test.invalid/api/push/attention') <> 'test-secret-not-real' then
    raise exception 'FAIL 5: the push is not signed with the shared secret';
  end if;
end $$;
\echo 'PASS 5: a call reaches the devices of the people called, once each, with rooms only'


-- ===== 6. Never the caller's own device, even on a shared computer =====
-- The front desk person calls the lab from the shared desk computer. The
-- lab person has also signed in on that same computer once.
select pg_temp.turn_on('00000000-0000-0000-0000-000000000b04', 'https://push.example/desk-phone');
do $$
declare push jsonb;
begin
  perform pg_temp.call_as('00000000-0000-0000-0000-000000000b01', 'laboratory');
  select p into push from pg_temp.pushes() p offset 1;
  if push::text like '%desk-phone%' then
    raise exception 'FAIL 6: the push went to the caller''s own computer';
  end if;
  if push::text not like '%lab-pc%' then
    raise exception 'FAIL 6: the lab''s own computer did not get the push';
  end if;
end $$;
\echo 'PASS 6: never the caller''s own device'


-- ===== 7. Turning off removes only your own row =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b02"}', true);
set local role authenticated;
select public.forget_push_device('https://push.example/desk-phone');
reset role;
do $$
begin
  if exists (select 1 from public.push_devices
             where staff_id = '00000000-0000-0000-0000-000000000b02' and endpoint = 'https://push.example/desk-phone') then
    raise exception 'FAIL 7: turning off did not remove the row';
  end if;
  if not exists (select 1 from public.push_devices
                 where staff_id = '00000000-0000-0000-0000-000000000b01' and endpoint = 'https://push.example/desk-phone') then
    raise exception 'FAIL 7: turning off removed another person''s row on the same computer';
  end if;
end $$;
\echo 'PASS 7: turning off removes only your own row'


-- ===== 8. The card on the screen still follows the same rule =====
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b02"}', true);
  set local role authenticated;
  if not exists (select 1 from public.attention_calls where to_kind = 'front_desk') then
    raise exception 'FAIL 8: the front desk person with no room cannot see a call to Front Desk';
  end if;
  reset role;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000b03"}', true);
  set local role authenticated;
  if exists (select 1 from public.attention_calls where to_kind = 'laboratory') then
    raise exception 'FAIL 8: the doctor can see a call meant for the lab';
  end if;
  reset role;
end $$;
\echo 'PASS 8: who sees a call on the screen is unchanged'



-- ===== 9. pg_net is never labelled in the public schema =====
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net' and extnamespace = 'public'::regnamespace) then
    raise exception 'FAIL 9: pg_net is in the public schema (the security advisor flags it)';
  end if;
end $$;
\echo 'PASS 9: pg_net is not in the public schema'

rollback;
