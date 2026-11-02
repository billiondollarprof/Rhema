-- =============================================================================
-- 016_family_profile.sql: tests for the family profile (request 128 step 2).
--
-- What this is: proves start_family gives a FAM number, joins the patient
-- and marks them family; a double tap answers the same family; a member
-- joins; the number cannot be set or changed; nobody without the patients
-- tick or signed out can start one.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f7', 'fm-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000f8', 'fm-lab@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000f7', 'Fm Desk', 'fm-desk@test.rhema', 'front_desk'),
  ('00000000-0000-0000-0000-0000000000f8', 'Fm Lab',  'fm-lab@test.rhema',  'laboratory');
update public.staff set can_patients = false where id = '00000000-0000-0000-0000-0000000000f8';
insert into public.patients (full_name, date_of_birth, sex, phone, created_by)
values ('Fm Mother', '1985-01-01', 'female', '08035550960', '00000000-0000-0000-0000-0000000000f7');

create temporary table t (family bigint);
grant select, insert, update on t to authenticated;
insert into t values (null);


-- ===== 1. Start a family: a FAM number, the mother joins, marked family =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f7"}', true);
set local role authenticated;
update t set family = public.start_family((select id from public.patients where full_name = 'Fm Mother'));
do $$
begin
  if (select family_number from public.families where id = (select family from t)) !~ '^FAM-[0-9]{6}$' then
    raise exception 'FAIL 1: the family did not get a FAM number';
  end if;
  if (select family_id from public.patients where full_name = 'Fm Mother') is distinct from (select family from t)
     or (select category from public.patients where full_name = 'Fm Mother') <> 'family' then
    raise exception 'FAIL 1: the mother did not join the family as family';
  end if;
  -- A double tap answers the same family.
  if public.start_family((select id from public.patients where full_name = 'Fm Mother')) <> (select family from t) then
    raise exception 'FAIL 1: a double tap made a second family';
  end if;
  if (select count(*) from public.families) <> 1 then
    raise exception 'FAIL 1: expected one family';
  end if;
end $$;
\echo 'PASS 1: a FAM number, the mother joins as family, a double tap makes no second family'


-- ===== 2. A member joins when registered =====
insert into public.patients (full_name, date_of_birth, sex, category, family_id, created_by)
values ('Fm Son', '2015-03-03', 'male', 'family', (select family from t), '00000000-0000-0000-0000-0000000000f7');
do $$
begin
  if (select count(*) from public.patients where family_id = (select family from t)) <> 2 then
    raise exception 'FAIL 2: the son did not join the family';
  end if;
end $$;
\echo 'PASS 2: a member joins the family'


-- ===== 3. The number cannot be set or changed =====
do $$
begin
  begin
    update public.families set family_number = 'FAM-999999' where id = (select family from t);
    raise exception 'FAIL 3: a family number was changed';
  exception when raise_exception then
    if sqlerrm <> 'A family number cannot be changed' then raise; end if;
  end;
  insert into public.families (family_number) values ('FAM-123456');
  if exists (select 1 from public.families where family_number = 'FAM-123456') then
    raise exception 'FAIL 3: a family number was set by hand';
  end if;
end $$;
reset role;
\echo 'PASS 3: a family number cannot be set or changed'


-- ===== 4. Without the patients tick, or signed out: no family =====
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Fm Other', '1990-01-01', 'male', '00000000-0000-0000-0000-0000000000f7');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f8"}', true);
set local role authenticated;
do $$
begin
  perform public.start_family((select id from public.patients where full_name = 'Fm Other'));
  raise exception 'FAIL 4: somebody without the patients tick started a family';
exception when insufficient_privilege then null;
end $$;
reset role;
do $$
begin
  if has_function_privilege('anon', 'public.start_family(bigint)', 'execute') then
    raise exception 'FAIL 4: somebody not signed in may start a family';
  end if;
end $$;
\echo 'PASS 4: no family without the patients tick, or signed out'

rollback;
