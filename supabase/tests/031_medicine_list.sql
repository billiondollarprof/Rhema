-- =============================================================================
-- 031_medicine_list.sql: tests for the medicine list.
--
-- What this is: proves the starter list is there, only the Pharmacy makes a
-- medicine standard, a doctor's or nurse's own addition is pending and seen
-- only by them and the Pharmacy, a repeat adds nothing new, and nobody
-- deletes or edits what they should not.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000311', 't031-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-000000000312', 't031-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000313', 't031-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000314', 't031-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000315', 't031-doctor2@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000311', 'T31 Pharmacy', 't031-pharmacy@test.rhema', 'pharmacy'),
  ('00000000-0000-0000-0000-000000000312', 'T31 Doctor',   't031-doctor@test.rhema',   'doctor'),
  ('00000000-0000-0000-0000-000000000313', 'T31 Nurse',    't031-nurse@test.rhema',    'nurse'),
  ('00000000-0000-0000-0000-000000000314', 'T31 Desk',     't031-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-000000000315', 'T31 Doctor2',  't031-doctor2@test.rhema',  'doctor');


-- ===== 1. Rights, and the starter list =====
do $$
begin
  if has_table_privilege('anon', 'public.medicine_list', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL 1: the public has rights on medicine_list';
  end if;
  if has_table_privilege('authenticated', 'public.medicine_list', 'INSERT, DELETE, TRUNCATE') then
    raise exception 'FAIL 1: signed in users can add or delete lines by hand';
  end if;
  if (select count(*) from public.medicine_list where source = 'starter' and status = 'standard') < 100 then
    raise exception 'FAIL 1: the starter list is missing';
  end if;
  if not exists (select 1 from public.medicine_list where name = 'Paracetamol' and strength = '500 mg tablet' and status = 'standard') then
    raise exception 'FAIL 1: Paracetamol 500 mg is not in the starter list';
  end if;
end $$;
\echo 'PASS 1: nobody adds or deletes by hand, and the starter list is there'


-- ===== 2. A doctor's own addition is pending, and seen by the doctor only =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000312"}', true);
set local role authenticated;
create temporary table made (id bigint);
grant all on made to authenticated;
insert into made select public.add_medicine('Zzmed Forte', '5 mg tablet', 'medicine');
insert into made select public.add_medicine('  zzmed   forte ', '5 MG tablet', 'medicine');
do $$
begin
  if (select count(distinct id) from made) <> 1 then
    raise exception 'FAIL 2: the same medicine typed twice made two lines';
  end if;
  if (select status from public.medicine_list where id = (select min(id) from made)) <> 'pending' then
    raise exception 'FAIL 2: a doctor''s addition was not pending';
  end if;
  if not exists (select 1 from public.medicine_list where name = 'Zzmed Forte') then
    raise exception 'FAIL 2: the doctor cannot see their own addition';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000313"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.medicine_list where name = 'Zzmed Forte') then
    raise exception 'FAIL 2: a nurse can see a doctor''s pending medicine';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000315"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.medicine_list where name = 'Zzmed Forte') then
    raise exception 'FAIL 2: another doctor can see a doctor''s pending medicine';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000311"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.medicine_list where name = 'Zzmed Forte' and status = 'pending') then
    raise exception 'FAIL 2: the Pharmacy cannot see the pending medicine';
  end if;
end $$;
reset role;
\echo 'PASS 2: a doctor''s addition is pending, once, and seen by that doctor and the Pharmacy only'


-- ===== 3. Only the Pharmacy confirms, and then everybody sees it =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000312"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.confirm_medicine((select min(id) from made));
    raise exception 'FAIL 3: a doctor confirmed a medicine';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.medicine_list set status = 'standard' where name = 'Zzmed Forte';
    raise exception 'FAIL 3: a doctor set a status by hand';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000311"}', true);
set local role authenticated;
select public.confirm_medicine((select min(id) from made));
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000313"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.medicine_list where name = 'Zzmed Forte' and status = 'standard' and confirmed_by is not null) then
    raise exception 'FAIL 3: a confirmed medicine is not standard for the nurse';
  end if;
end $$;
reset role;
\echo 'PASS 3: only the Pharmacy confirms, and then everybody sees it'


-- ===== 4. Adding something that is already standard adds nothing =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000313"}', true);
set local role authenticated;
do $$
declare
  before_count integer := (select count(*) from public.medicine_list);
  got bigint;
begin
  got := public.add_medicine('paracetamol', '500 mg TABLET', 'medicine');
  if (select count(*) from public.medicine_list) <> before_count then
    raise exception 'FAIL 4: a standard medicine was added again';
  end if;
  if (select status from public.medicine_list where id = got) <> 'standard' then
    raise exception 'FAIL 4: the standard line was not returned';
  end if;
end $$;
reset role;
\echo 'PASS 4: adding a standard medicine again adds nothing'


-- ===== 5. The Pharmacy adds standard at once, and covers a pending twin =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000313"}', true);
set local role authenticated;
select public.add_medicine('Yymed', '10 mg', 'medicine');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000311"}', true);
set local role authenticated;
select public.add_medicine('Yymed', '10 mg', 'medicine');
select public.add_medicine('Syringe test', '3 ml', 'item');
do $$
begin
  if (select count(*) from public.medicine_list where name = 'Yymed' and status = 'standard' and is_active) <> 1 then
    raise exception 'FAIL 5: the Pharmacy''s addition is not standard';
  end if;
  if exists (select 1 from public.medicine_list where name = 'Yymed' and status = 'pending' and is_active) then
    raise exception 'FAIL 5: a pending twin is still active';
  end if;
  if (select kind from public.medicine_list where name = 'Syringe test') <> 'item' then
    raise exception 'FAIL 5: an item was not saved as an item';
  end if;
end $$;
reset role;
\echo 'PASS 5: the Pharmacy adds standard, and a pending twin is covered'


-- ===== 6. Only the Pharmacy edits and switches off; nobody deletes =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000313"}', true);
set local role authenticated;
do $$
declare changed integer;
begin
  update public.medicine_list set strength = '999 mg' where name = 'Yymed';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL 6: a nurse edited the list'; end if;
  begin
    delete from public.medicine_list where name = 'Yymed';
    raise exception 'FAIL 6: a nurse deleted a line';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000311"}', true);
set local role authenticated;
update public.medicine_list set is_active = false where name = 'Yymed';
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000313"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.medicine_list where name = 'Yymed') then
    raise exception 'FAIL 6: a switched off medicine still shows to a nurse';
  end if;
end $$;
reset role;
\echo 'PASS 6: only the Pharmacy edits and switches off; nobody deletes'


-- ===== 7. The Front Desk sees nothing and adds nothing =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000314"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.medicine_list) <> 0 then
    raise exception 'FAIL 7: the Front Desk can read the list';
  end if;
  begin
    perform public.add_medicine('Nope', '1 mg', 'medicine');
    raise exception 'FAIL 7: the Front Desk added a medicine';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 7: the Front Desk sees and adds nothing'


-- ===== 8. Confirming the starter list =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000312"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.confirm_starter_medicines();
    raise exception 'FAIL 8: a doctor confirmed the starter list';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000311"}', true);
set local role authenticated;
select public.confirm_starter_medicines();
reset role;
do $$
begin
  if exists (select 1 from public.medicine_list where source = 'starter') then
    raise exception 'FAIL 8: starter lines are still unconfirmed';
  end if;
  if not exists (select 1 from public.activity_log where table_name = 'medicine_list') then
    raise exception 'FAIL 8: the list is not in the activity log';
  end if;
end $$;
\echo 'PASS 8: only the Pharmacy confirms the starter list, and it is logged'


-- ===== 9. Two taps at the same moment cannot list one thing twice =====
-- The functions look first; these two rules are the safety net under them.
do $$
begin
  begin
    insert into public.medicine_list (name, strength, status, source)
    values ('PARACETAMOL', '500 mg tablet', 'standard', 'pharmacy');
    raise exception 'FAIL 9: a standard medicine was listed twice';
  exception when unique_violation then null;
  end;
  insert into public.medicine_list (name, strength, status, source, added_by)
  values ('Xxmed', '1 mg', 'pending', 'staff', '00000000-0000-0000-0000-000000000312');
  begin
    insert into public.medicine_list (name, strength, status, source, added_by)
    values ('XXMED', '1 MG', 'pending', 'staff', '00000000-0000-0000-0000-000000000312');
    raise exception 'FAIL 9: a pending medicine was listed twice for one person';
  exception when unique_violation then null;
  end;
end $$;
\echo 'PASS 9: the same thing is never listed twice'

rollback;
