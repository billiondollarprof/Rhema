-- =============================================================================
-- tests for first_registered_and_payment_lists (request 211, 2026-11-16).
--
-- What this proves: an old file keeps its first month; a month in the future
-- is refused; the Front Desk reads standard medicines and standard lab tests,
-- never a line still waiting, and still cannot write either list; a nurse
-- still reads the lists as before.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000431', 't043-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000432', 't043-nurse@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000431', 'T43 Desk',  't043-desk@test.rhema',  'front_desk'),
  ('00000000-0000-0000-0000-000000000432', 'T43 Nurse', 't043-nurse@test.rhema', 'nurse');

-- A line a nurse typed (waiting for the Pharmacy), and lab tests: one typed by
-- one person (not standard) and one standard.
insert into public.medicine_list (name, strength, kind, status, source, added_by)
values ('Zorbex T43', '5 mg tablet', 'medicine', 'pending', 'staff', '00000000-0000-0000-0000-000000000432');
insert into public.pick_options (list, label, key, standard, source)
values ('lab_test', 'T43 Standard Test', 't43standardtest', true, 'staff'),
       ('lab_test', 'T43 Personal Test', 't43personaltest', false, 'staff');


-- ===== 1. An old file keeps its month; the future is refused =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000431"}', true);
set local role authenticated;
insert into public.patients (full_name, from_old_file, first_registered_on)
values ('T43 Old File', true, '2024-11-01');
do $$
begin
  if (select first_registered_on from public.patients where full_name = 'T43 Old File') <> '2024-11-01' then
    raise exception 'FAIL 1: the month was not kept';
  end if;
  begin
    insert into public.patients (full_name, from_old_file, first_registered_on)
    values ('T43 Future', true, current_date + 40);
    raise exception 'FAIL 1: a month in the future was saved';
  exception when check_violation then null;
  end;
end $$;
reset role;
\echo 'PASS 1: an old file keeps its month; the future is refused'


-- ===== 2. The Front Desk reads only the standard lists =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000431"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.medicine_list) < 100 then
    raise exception 'FAIL 2: the Front Desk cannot read the standard medicines';
  end if;
  if exists (select 1 from public.medicine_list where name = 'Zorbex T43') then
    raise exception 'FAIL 2: the Front Desk sees a line still waiting for the Pharmacy';
  end if;
  if not exists (select 1 from public.pick_options where label = 'T43 Standard Test') then
    raise exception 'FAIL 2: the Front Desk cannot read the standard lab tests';
  end if;
  if exists (select 1 from public.pick_options where label = 'T43 Personal Test')
     or exists (select 1 from public.pick_options where list in ('dose', 'frequency', 'allergen', 'reaction', 'condition')) then
    raise exception 'FAIL 2: the Front Desk sees a personal lab test or a medical list';
  end if;
  begin
    perform public.save_pick_option_for_everybody('lab_test', 'T43 Desk Test');
    raise exception 'FAIL 2: the Front Desk added to the lab test list';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 2: the Front Desk reads only the standard lists, and writes neither'


-- ===== 3. A nurse still reads as before =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000432"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.medicine_list where name = 'Zorbex T43') then
    raise exception 'FAIL 3: the nurse lost her own waiting line';
  end if;
  if not exists (select 1 from public.pick_options where list = 'dose') then
    raise exception 'FAIL 3: the nurse lost the dose list';
  end if;
end $$;
reset role;
\echo 'PASS 3: a nurse reads the lists as before'

rollback;
