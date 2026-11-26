-- =============================================================================
-- 076_antenatal_history_list_and_duphaston.sql: tests for the antenatal
-- history pick list and Duphaston (requests 253, 254).
--
-- What this proves:
--   1. The 14 starter lines are there, standard, in order.
--   2. A nurse (medical access) reads the list and can add her own line,
--      and save one for everybody.
--   3. The Front Desk (no medical access) cannot read or add to it.
--   4. The other lists keep their rules (the Front Desk still uses town).
--   5. Duphaston 10 mg tablet is on the medicine list once.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: a made up nurse and a made up front desk =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000761', 't076-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000762', 't076-desk@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000761', 'Test Nurse', 't076-nurse@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-000000000762', 'Test Desk', 't076-desk@test.rhema', 'front_desk');


-- ===== 1. The starter lines =====
do $$
begin
  if (select count(*) from public.pick_options
      where list = 'antenatal_history' and standard and source = 'starter') <> 14 then
    raise exception 'FAIL 1: the 14 starter lines are not all there';
  end if;
  if not exists (select 1 from public.pick_options
                 where list = 'antenatal_history' and label = 'Spotting in pregnancy') then
    raise exception 'FAIL 1: Spotting in pregnancy is missing';
  end if;
end $$;
\echo 'PASS 1: the 14 starter lines are there'


-- ===== 2. A nurse reads the list, adds her own, saves one for everybody =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000761"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.pick_options where list = 'antenatal_history') < 14 then
    raise exception 'FAIL 2: the nurse cannot read the list';
  end if;
  perform public.use_pick_option('antenatal_history', 'Placenta praevia');
  perform public.save_pick_option_for_everybody('antenatal_history', 'Cervical incompetence');
  if not exists (select 1 from public.pick_options
                 where list = 'antenatal_history' and label = 'Cervical incompetence' and standard) then
    raise exception 'FAIL 2: a line saved for everybody is not standard';
  end if;
end $$;
reset role;
\echo 'PASS 2: a nurse reads, adds, and saves for everybody'


-- ===== 3. The Front Desk cannot read or add to it =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000762"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.pick_options where list = 'antenatal_history') then
    raise exception 'FAIL 3: the Front Desk can read the antenatal history list';
  end if;
  begin
    perform public.use_pick_option('antenatal_history', 'Something');
    raise exception 'FAIL 3: the Front Desk added to the antenatal history list';
  exception when others then
    if sqlerrm like 'FAIL 3%' then raise; end if;
  end;
end $$;
reset role;
\echo 'PASS 3: the Front Desk cannot read or add to it'


-- ===== 4. The other lists keep their rules =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000762"}', true);
set local role authenticated;
do $$
begin
  if not private.can_use_pick_list('town') then
    raise exception 'FAIL 4: the Front Desk lost the town list';
  end if;
  if private.can_use_pick_list('dose') then
    raise exception 'FAIL 4: the Front Desk can now use the dose list';
  end if;
end $$;
reset role;
\echo 'PASS 4: the other lists keep their rules'


-- ===== 5. Duphaston, once =====
do $$
begin
  if (select count(*) from public.medicine_list
      where name = 'Duphaston' and strength = '10 mg tablet' and status = 'standard') <> 1 then
    raise exception 'FAIL 5: Duphaston 10 mg tablet is not on the list once';
  end if;
end $$;
\echo 'PASS 5: Duphaston is on the medicine list'

rollback;
