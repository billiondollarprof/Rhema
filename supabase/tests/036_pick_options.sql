-- =============================================================================
-- 036_pick_options.sql: tests for the short pick lists (doses, how often,
-- allergens, reactions, conditions).
--
-- What this is: proves the starter lists are there; a line typed by one person
-- is only theirs; a second person typing the same one makes it standard; the
-- same thing in another spelling is one line; a person removes only their own
-- typed line; and the Front Desk sees and does nothing.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000361', 't036-nurse1@test.rhema'),
  ('00000000-0000-0000-0000-000000000362', 't036-nurse2@test.rhema'),
  ('00000000-0000-0000-0000-000000000363', 't036-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000364', 't036-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000365', 't036-pharmacy@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000361', 'T36 Nurse1',   't036-nurse1@test.rhema',   'nurse'),
  ('00000000-0000-0000-0000-000000000362', 'T36 Nurse2',   't036-nurse2@test.rhema',   'nurse'),
  ('00000000-0000-0000-0000-000000000363', 'T36 Doctor',   't036-doctor@test.rhema',   'doctor'),
  ('00000000-0000-0000-0000-000000000364', 'T36 Desk',     't036-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-000000000365', 'T36 Pharmacy', 't036-pharmacy@test.rhema', 'pharmacy');


-- ===== 1. Rights and the starter lists =====
do $$
begin
  if has_table_privilege('anon', 'public.pick_options', 'SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('anon', 'public.pick_option_users', 'SELECT, INSERT, UPDATE, DELETE') then
    raise exception 'FAIL 1: the public has rights on the pick lists';
  end if;
  if has_table_privilege('authenticated', 'public.pick_options', 'INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.pick_option_users', 'INSERT, UPDATE, DELETE') then
    raise exception 'FAIL 1: signed in users write the pick lists by hand';
  end if;
  if (select count(*) from public.pick_options where list = 'dose' and standard) < 20
     or (select count(*) from public.pick_options where list = 'frequency' and standard) < 10
     or (select count(*) from public.pick_options where list = 'allergen' and standard) < 20
     or (select count(*) from public.pick_options where list = 'reaction' and standard) < 10
     or (select count(*) from public.pick_options where list = 'condition' and standard) < 15 then
    raise exception 'FAIL 1: a starter list is missing lines';
  end if;
  if not exists (select 1 from public.pick_options where list = 'frequency' and label = 'Twice daily' and standard) then
    raise exception 'FAIL 1: Twice daily is not in the how often list';
  end if;
end $$;
\echo 'PASS 1: nobody writes the lists by hand, and the starter lists are there'


-- ===== 2. A line typed by one nurse is only hers =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000361"}', true);
set local role authenticated;
create temporary table got (label text);
grant all on got to authenticated;
insert into got select public.use_pick_option('allergen', 'Mango');
do $$
begin
  if (select label from got) <> 'Mango' then
    raise exception 'FAIL 2: the words did not come back';
  end if;
  if not exists (select 1 from public.pick_options where label = 'Mango') then
    raise exception 'FAIL 2: the nurse cannot see her own line';
  end if;
  if exists (select 1 from public.pick_options where label = 'Mango' and standard) then
    raise exception 'FAIL 2: one person made a line standard';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000363"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.pick_options where label = 'Mango') then
    raise exception 'FAIL 2: another person can see one nurse''s typed line';
  end if;
end $$;
reset role;
\echo 'PASS 2: a typed line is only the typist''s'


-- ===== 3. A second person types the same one (other spelling): standard =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000362"}', true);
set local role authenticated;
delete from got;
insert into got select public.use_pick_option('allergen', '  mango. ');
do $$
begin
  if (select label from got) <> 'Mango' then
    raise exception 'FAIL 3: another spelling did not come back as the same words';
  end if;
end $$;
do $$
begin
  -- Each person sees only their own "who uses this" line.
  if (select count(*) from public.pick_option_users) <> 1 then
    raise exception 'FAIL 3: a person can see other people''s lines in the users list';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000363"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.pick_options where label = 'Mango' and standard) then
    raise exception 'FAIL 3: a line two people typed is not standard for everybody';
  end if;
  if (select count(*) from public.pick_options where key = 'mango') <> 1 then
    raise exception 'FAIL 3: the same thing is listed twice';
  end if;
end $$;
reset role;
\echo 'PASS 3: when a second person types it, it becomes standard, once'


-- ===== 4. The same person twice does not make it standard =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000361"}', true);
set local role authenticated;
select public.use_pick_option('dose', '7 ml');
select public.use_pick_option('dose', '7 ML');
do $$
begin
  if (select standard from public.pick_options where label = '7 ml') then
    raise exception 'FAIL 4: one person typing it twice made it standard';
  end if;
end $$;
reset role;
\echo 'PASS 4: the same person twice does not make it standard'


-- ===== 5. An existing standard line comes back as it is =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000361"}', true);
set local role authenticated;
do $$
declare before_count integer := (select count(*) from public.pick_options);
begin
  if public.use_pick_option('frequency', 'TWICE   daily') <> 'Twice daily' then
    raise exception 'FAIL 5: a standard line did not come back in its own words';
  end if;
  if (select count(*) from public.pick_options) <> before_count then
    raise exception 'FAIL 5: a standard line was added again';
  end if;
end $$;
reset role;
\echo 'PASS 5: typing something that is standard adds nothing'


-- ===== 6. A person removes only their own typed line =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000361"}', true);
set local role authenticated;
select public.forget_pick_option('dose', '7 ml');
select public.forget_pick_option('frequency', 'Twice daily');
do $$
begin
  if exists (select 1 from public.pick_options where label = '7 ml') then
    raise exception 'FAIL 6: a person cannot remove their own typed line';
  end if;
  if not exists (select 1 from public.pick_options where label = 'Twice daily' and standard) then
    raise exception 'FAIL 6: a standard line was removed';
  end if;
end $$;
reset role;
\echo 'PASS 6: a person removes their own typed line, never a standard one'


-- ===== 7. A wrong list is refused; the Front Desk sees and does nothing =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000365"}', true);
set local role authenticated;
do $$
begin
  perform public.use_pick_option('dose', 'Pharmacy typed dose');
  begin
    perform public.use_pick_option('colour', 'Blue');
    raise exception 'FAIL 7: a list that does not exist was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000364"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.pick_options) <> 0 then
    raise exception 'FAIL 7: the Front Desk can read the lists';
  end if;
  begin
    perform public.use_pick_option('dose', 'Nope');
    raise exception 'FAIL 7: the Front Desk typed a line';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.activity_log where table_name = 'pick_options') then
    raise exception 'FAIL 7: the lines are not in the activity log';
  end if;
end $$;
\echo 'PASS 7: a wrong list is refused, the Front Desk does nothing, and it is logged'

rollback;
