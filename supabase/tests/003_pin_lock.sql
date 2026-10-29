-- =============================================================================
-- 003_pin_lock.sql: tests for the PIN behind the lock screen.
--
-- What this is: proves a person can set and check only their own PIN, that
-- the PIN is stored scrambled, that 5 wrong tries stop it working, and that
-- somebody who is not signed in can do nothing.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'nurse1@test.rhema'),
  ('00000000-0000-0000-0000-0000000000e2', 'nurse2@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'Test Nurse One', 'nurse1@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-0000000000e2', 'Test Nurse Two', 'nurse2@test.rhema', 'nurse');


-- ===== 1. Before a PIN is set, the answer is no_pin ==========================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1"}', true);
set local role authenticated;
do $$
begin
  if public.i_have_a_pin() then raise exception 'FAIL 1: a new nurse already has a PIN'; end if;
  if public.check_my_pin('1234') <> 'no_pin' then raise exception 'FAIL 1: expected no_pin'; end if;
end $$;
\echo 'PASS 1: a new person has no PIN'


-- ===== 2. A PIN must be 4 digits =============================================
do $$
begin
  perform public.set_my_pin('12a4');
  raise exception 'FAIL 2: a PIN with a letter was accepted';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
\echo 'PASS 2: a bad PIN is refused'


-- ===== 3. Set it, then the right PIN says ok and a wrong one says wrong ======
select public.set_my_pin('4821');
do $$
begin
  if not public.i_have_a_pin() then raise exception 'FAIL 3: the PIN was not saved'; end if;
  if public.check_my_pin('4821') <> 'ok' then raise exception 'FAIL 3: the right PIN failed'; end if;
  if public.check_my_pin('0000') <> 'wrong' then raise exception 'FAIL 3: a wrong PIN passed'; end if;
  if public.check_my_pin('4821') <> 'ok' then raise exception 'FAIL 3: a right PIN after a wrong one failed'; end if;
end $$;
reset role;
\echo 'PASS 3: the right PIN opens, a wrong one does not'


-- ===== 4. The PIN is stored scrambled, never as the digits ===================
do $$
begin
  if (select pin_hash from public.staff where email = 'nurse1@test.rhema') like '%4821%' then
    raise exception 'FAIL 4: the PIN is stored as plain digits';
  end if;
end $$;
\echo 'PASS 4: the PIN is stored scrambled'


-- ===== 5. Nurse Two cannot use or change Nurse One's PIN =====================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2"}', true);
set local role authenticated;
do $$
begin
  if public.check_my_pin('4821') <> 'no_pin' then
    raise exception 'FAIL 5: Nurse Two''s check reached Nurse One''s PIN';
  end if;
end $$;
select public.set_my_pin('1111');
reset role;
do $$
begin
  if extensions.crypt('4821', (select pin_hash from public.staff where email = 'nurse1@test.rhema'))
     <> (select pin_hash from public.staff where email = 'nurse1@test.rhema') then
    raise exception 'FAIL 5: Nurse Two changed Nurse One''s PIN';
  end if;
end $$;
\echo 'PASS 5: each person only ever touches their own PIN'


-- ===== 6. Five wrong tries in a row stop the PIN working =====================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1"}', true);
set local role authenticated;
do $$
declare
  i integer;
  answer text;
begin
  for i in 1..5 loop
    answer := public.check_my_pin('9999');
  end loop;
  if answer <> 'locked' then raise exception 'FAIL 6: 5 wrong tries did not lock (got %)', answer; end if;
  if public.check_my_pin('4821') <> 'locked' then
    raise exception 'FAIL 6: the right PIN still worked after 5 wrong tries';
  end if;
end $$;

-- Setting a new PIN (after signing in again with an email code) unlocks it.
select public.set_my_pin('2580');
do $$
begin
  if public.check_my_pin('2580') <> 'ok' then raise exception 'FAIL 6: a new PIN did not unlock'; end if;
end $$;
reset role;
\echo 'PASS 6: 5 wrong tries lock the PIN until a new one is set'


-- ===== 7. Somebody not signed in can do nothing ==============================
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  perform public.check_my_pin('4821');
  raise exception 'FAIL 7: somebody not signed in could check a PIN';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 7: people who are not signed in cannot touch PINs'

rollback;
\echo 'ALL PIN TESTS PASSED'
