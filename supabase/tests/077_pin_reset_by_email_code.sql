-- =============================================================================
-- 077_pin_reset_by_email_code.sql: tests for resetting a PIN (request 259).
--
-- What this is: proves my_pin_state() answers none, set and locked for the
-- person asking only; a first PIN needs nothing more; replacing a PIN that
-- exists needs an email code sign in in the last 15 minutes; a reset clears
-- the lock; nobody can touch another person's PIN; somebody not signed in
-- can do nothing.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: made up staff =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000771', 't077-one@test.rhema'),
  ('00000000-0000-0000-0000-000000000772', 't077-two@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000771', 'Test One', 't077-one@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-000000000772', 'Test Two', 't077-two@test.rhema', 'nurse');

-- Claims for person One: no sign in time, a fresh one (now), and an old one
-- (2 hours ago). The time is in seconds, as Supabase writes it.
create temporary table claims (name text primary key, value text);
insert into claims values
  ('plain', '{"sub":"00000000-0000-0000-0000-000000000771"}'),
  ('fresh', json_build_object('sub', '00000000-0000-0000-0000-000000000771',
            'amr', json_build_array(json_build_object('method', 'otp',
            'timestamp', extract(epoch from now())::bigint)))::text),
  ('old',   json_build_object('sub', '00000000-0000-0000-0000-000000000771',
            'amr', json_build_array(json_build_object('method', 'otp',
            'timestamp', extract(epoch from now() - interval '2 hours')::bigint)))::text),
  ('two_fresh', json_build_object('sub', '00000000-0000-0000-0000-000000000772',
            'amr', json_build_array(json_build_object('method', 'otp',
            'timestamp', extract(epoch from now())::bigint)))::text);
grant select on claims to authenticated, anon;


-- ===== 1. A new person: state none, and the first PIN needs nothing more =====
select set_config('request.jwt.claims', (select value from claims where name = 'plain'), true);
set local role authenticated;
do $$
begin
  if public.my_pin_state() <> 'none' then raise exception 'FAIL 1: a new person is not none'; end if;
end $$;
select public.set_my_pin('4821');
do $$
begin
  if public.my_pin_state() <> 'set' then raise exception 'FAIL 1: after a first PIN, not set'; end if;
end $$;
reset role;
\echo 'PASS 1: none, then a first PIN with no email code needed, then set'


-- ===== 2. Replacing a PIN without a fresh email code is refused ==============
set local role authenticated;
do $$
begin
  perform public.set_my_pin('1111');
  raise exception 'FAIL 2: a PIN was replaced with no sign in time';
exception when insufficient_privilege then
  if sqlerrm <> 'fresh_sign_in_needed' then raise; end if;
end $$;
reset role;
select set_config('request.jwt.claims', (select value from claims where name = 'old'), true);
set local role authenticated;
do $$
begin
  perform public.set_my_pin('1111');
  raise exception 'FAIL 2: a PIN was replaced with a sign in 2 hours old';
exception when insufficient_privilege then
  if sqlerrm <> 'fresh_sign_in_needed' then raise; end if;
end $$;
do $$
begin
  if public.check_my_pin('4821') <> 'ok' then raise exception 'FAIL 2: the old PIN changed'; end if;
end $$;
reset role;
\echo 'PASS 2: no new PIN over an old one without a fresh email code'


-- ===== 3. Five wrong tries: state locked; a fresh code lets a new PIN in =====
set local role authenticated;
do $$
declare
  i integer;
begin
  for i in 1..5 loop
    perform public.check_my_pin('9999');
  end loop;
  if public.my_pin_state() <> 'locked' then raise exception 'FAIL 3: not locked after 5 tries'; end if;
end $$;
-- Locked, and an old sign in still cannot reset it.
do $$
begin
  perform public.set_my_pin('2580');
  raise exception 'FAIL 3: a locked PIN was reset with an old sign in';
exception when insufficient_privilege then
  if sqlerrm <> 'fresh_sign_in_needed' then raise; end if;
end $$;
reset role;
select set_config('request.jwt.claims', (select value from claims where name = 'fresh'), true);
set local role authenticated;
select public.set_my_pin('2580');
do $$
begin
  if public.my_pin_state() <> 'set' then raise exception 'FAIL 3: still locked after a reset'; end if;
  if public.check_my_pin('2580') <> 'ok' then raise exception 'FAIL 3: the new PIN does not open'; end if;
  if public.check_my_pin('4821') <> 'wrong' then raise exception 'FAIL 3: the old PIN still opens'; end if;
end $$;
reset role;
\echo 'PASS 3: locked after 5 tries, and a fresh email code lets a new PIN in'


-- ===== 4. Person Two never sees or touches person One's PIN ==================
select set_config('request.jwt.claims', (select value from claims where name = 'two_fresh'), true);
set local role authenticated;
do $$
begin
  if public.my_pin_state() <> 'none' then raise exception 'FAIL 4: Two sees One''s PIN state'; end if;
end $$;
select public.set_my_pin('7777');
reset role;
do $$
begin
  if extensions.crypt('2580', (select pin_hash from public.staff where email = 't077-one@test.rhema'))
     <> (select pin_hash from public.staff where email = 't077-one@test.rhema') then
    raise exception 'FAIL 4: Two changed One''s PIN';
  end if;
end $$;
\echo 'PASS 4: each person only ever touches their own PIN'


-- ===== 5. Somebody not signed in can do nothing ==============================
do $$
begin
  if has_function_privilege('anon', 'public.my_pin_state()', 'execute')
     or has_function_privilege('anon', 'private.my_pin_state()', 'execute')
     or has_function_privilege('anon', 'private.signed_in_at()', 'execute') then
    raise exception 'FAIL 5: somebody not signed in may run the PIN functions';
  end if;
end $$;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  perform public.my_pin_state();
  raise exception 'FAIL 5: somebody not signed in could ask the PIN state';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.set_my_pin('1234');
  raise exception 'FAIL 5: somebody not signed in could set a PIN';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 5: people who are not signed in cannot touch PINs'

rollback;
\echo 'ALL PIN RESET TESTS PASSED'
