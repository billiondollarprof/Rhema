-- =============================================================================
-- 037_pick_lists_registration_lab.sql: tests for the registration lists and
-- the lab test list.
--
-- What this is: proves each list is used only by the people whose work it is:
-- the Front Desk the registration lists, the Laboratory and medical staff the
-- lab test list, and that the Front Desk and the Laboratory still cannot read
-- the medical lists.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000371', 't037-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000372', 't037-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000373', 't037-nurse@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000371', 'T37 Desk',  't037-desk@test.rhema',  'front_desk'),
  ('00000000-0000-0000-0000-000000000372', 'T37 Lab',   't037-lab@test.rhema',   'laboratory'),
  ('00000000-0000-0000-0000-000000000373', 'T37 Nurse', 't037-nurse@test.rhema', 'nurse');


-- ===== 1. The registration lists are there, Delta first =====
do $$
begin
  if (select count(*) from public.pick_options where list = 'state' and standard) <> 37 then
    raise exception 'FAIL 1: the State list does not have 36 States and the FCT';
  end if;
  if (select label from public.pick_options where list = 'state' and position = 1) <> 'Delta' then
    raise exception 'FAIL 1: Delta is not first in the State list';
  end if;
  if (select label from public.pick_options where list = 'lga' and position = 1) <> 'Sapele' then
    raise exception 'FAIL 1: Sapele is not first in the local government list';
  end if;
  if (select count(*) from public.pick_options where list = 'relationship' and standard) < 20 then
    raise exception 'FAIL 1: the relationship list is missing lines';
  end if;
end $$;
\echo 'PASS 1: the registration lists are there, with Delta and Sapele first'


-- ===== 2. The Front Desk uses the registration lists, not the medical ones =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000371"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.pick_options where list = 'relationship') < 20 then
    raise exception 'FAIL 2: the Front Desk cannot read the relationship list';
  end if;
  if public.use_pick_option('town', 'Ogiame Street area') <> 'Ogiame Street area' then
    raise exception 'FAIL 2: the Front Desk cannot add a town';
  end if;
  if (select count(*) from public.pick_options where list in ('dose', 'allergen', 'lab_test')) <> 0 then
    raise exception 'FAIL 2: the Front Desk can read a medical list';
  end if;
  begin
    perform public.use_pick_option('lab_test', 'Not mine');
    raise exception 'FAIL 2: the Front Desk added a lab test';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 2: the Front Desk uses the registration lists and not the medical ones'


-- ===== 3. The Laboratory uses the lab test list, not the medical ones =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000372"}', true);
set local role authenticated;
do $$
begin
  if public.use_pick_option('lab_test', 'Semen analysis') <> 'Semen analysis' then
    raise exception 'FAIL 3: the Laboratory cannot add a lab test';
  end if;
  if not exists (select 1 from public.pick_options where list = 'lab_test' and label = 'Semen analysis') then
    raise exception 'FAIL 3: the Laboratory cannot see its own lab test';
  end if;
  if (select count(*) from public.pick_options where list in ('dose', 'allergen', 'condition')) <> 0 then
    raise exception 'FAIL 3: the Laboratory can read a medical list';
  end if;
  begin
    perform public.use_pick_option('dose', 'Not mine');
    raise exception 'FAIL 3: the Laboratory added a dose';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 3: the Laboratory uses the lab test list and not the medical ones'


-- ===== 4. A nurse typing the same lab test makes it standard =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000373"}', true);
set local role authenticated;
do $$
begin
  if public.use_pick_option('lab_test', 'semen ANALYSIS') <> 'Semen analysis' then
    raise exception 'FAIL 4: the same lab test came back in other words';
  end if;
  if not exists (select 1 from public.pick_options where list = 'lab_test' and label = 'Semen analysis' and standard) then
    raise exception 'FAIL 4: a lab test two people typed is not standard';
  end if;
  -- A nurse still has the medical lists.
  if (select count(*) from public.pick_options where list = 'dose') < 20 then
    raise exception 'FAIL 4: a nurse lost the dose list';
  end if;
end $$;
reset role;
\echo 'PASS 4: a lab test typed by two people is standard, and a nurse keeps the medical lists'


-- ===== 5. Somebody without patient access cannot read the registration lists =====
update public.staff set can_patients = false where id = '00000000-0000-0000-0000-000000000372';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000372"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.pick_options where list in ('relationship', 'state', 'lga', 'town')) <> 0 then
    raise exception 'FAIL 5: somebody without patient access reads the registration lists';
  end if;
end $$;
reset role;
\echo 'PASS 5: the registration lists need patient access'

rollback;
