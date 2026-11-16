-- =============================================================================
-- 042_lab_prices_and_saved_choices.sql: tests for lab price proposals, saving
-- Other for everybody, and words added inside a lab test (requests 208, 209).
--
-- What this proves: the Laboratory proposes and the old price stays until
-- the admin approves; a refused price never becomes standard; 72 hours with
-- no answer makes it standard; a newer proposal replaces a waiting one; the
-- same proposal twice in 3 minutes is refused; a nurse or the Front Desk
-- cannot propose; only an admin decides; Other saved for everybody is
-- standard at once; words added inside a test are kept, by the lab only.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000421', 't042-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000422', 't042-admin@test.rhema'),
  ('00000000-0000-0000-0000-000000000423', 't042-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000424', 't042-desk@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000421', 'T42 Lab',   't042-lab@test.rhema',   'laboratory'),
  ('00000000-0000-0000-0000-000000000422', 'T42 Admin', 't042-admin@test.rhema', 'admin'),
  ('00000000-0000-0000-0000-000000000423', 'T42 Nurse', 't042-nurse@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-000000000424', 'T42 Desk',  't042-desk@test.rhema',  'front_desk');


-- ===== 1. Nobody writes the tables by hand =====
do $$
begin
  if has_table_privilege('authenticated', 'public.price_changes', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('authenticated', 'public.lab_field_choices', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('anon', 'public.price_changes', 'SELECT')
     or has_table_privilege('anon', 'public.lab_field_choices', 'SELECT') then
    raise exception 'FAIL 1: a table can be written by hand, or read by the public';
  end if;
  if has_function_privilege('authenticated', 'private.apply_due_prices()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.make_price_standard(bigint, text, uuid)', 'EXECUTE') then
    raise exception 'FAIL 1: signed in users can make prices standard directly';
  end if;
end $$;
\echo 'PASS 1: nobody writes the tables by hand'


-- ===== 2. The lab proposes; the old price stays until approved =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000422"}', true);
set local role authenticated;
select public.set_price('lab_test', 'PCV', 1000);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000421"}', true);
set local role authenticated;
select public.propose_price('PCV', 1500);
reset role;
do $$
begin
  if (select amount from public.price_list where item = 'PCV') <> 1000 then
    raise exception 'FAIL 2: a proposed price became standard before the admin answered';
  end if;
  if (select count(*) from public.price_changes where item = 'PCV' and status = 'waiting') <> 1 then
    raise exception 'FAIL 2: the proposal is not waiting';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000422"}', true);
set local role authenticated;
select public.decide_price((select id from public.price_changes where item = 'PCV' and status = 'waiting'), true);
reset role;
do $$
begin
  if (select amount from public.price_list where item = 'PCV') <> 1500 then
    raise exception 'FAIL 2: the approved price is not standard';
  end if;
  if (select status from public.price_changes where item = 'PCV') <> 'approved' then
    raise exception 'FAIL 2: the proposal is not marked approved';
  end if;
end $$;
\echo 'PASS 2: the old price stays until the admin approves the new one'


-- ===== 3. A refused price never becomes standard, even after 72 hours =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000421"}', true);
set local role authenticated;
select public.propose_price('Widal Test', 3000);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000422"}', true);
set local role authenticated;
select public.decide_price((select id from public.price_changes where item = 'Widal Test'), false);
reset role;
update public.price_changes set proposed_at = now() - interval '80 hours' where item = 'Widal Test';
select private.apply_due_prices();
do $$
begin
  if exists (select 1 from public.price_list where item = 'Widal Test') then
    raise exception 'FAIL 3: a refused price became standard';
  end if;
end $$;
\echo 'PASS 3: a refused price never becomes standard'


-- ===== 4. 72 hours with no answer: standard on its own; not before =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000421"}', true);
set local role authenticated;
select public.propose_price('Genotype', 2500);
select public.propose_price('Urinalysis', 1200);
reset role;
update public.price_changes set proposed_at = now() - interval '73 hours' where item = 'Genotype';
update public.price_changes set proposed_at = now() - interval '70 hours' where item = 'Urinalysis';
do $$
begin
  if private.apply_due_prices() <> 1 then
    raise exception 'FAIL 4: the wrong number of prices became standard';
  end if;
  if (select amount from public.price_list where item = 'Genotype') <> 2500
     or (select status from public.price_changes where item = 'Genotype') <> 'automatic' then
    raise exception 'FAIL 4: a price waiting 73 hours did not become standard';
  end if;
  if exists (select 1 from public.price_list where item = 'Urinalysis') then
    raise exception 'FAIL 4: a price waiting 70 hours became standard too early';
  end if;
end $$;
\echo 'PASS 4: after 72 hours with no answer the price is standard, not before'


-- ===== 5. A newer proposal replaces a waiting one; a double tap is refused =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000421"}', true);
set local role authenticated;
select public.propose_price('urinalysis', 1300);
do $$
begin
  begin
    perform public.propose_price('Urinalysis', 1300);
    raise exception 'FAIL 5: the same proposal twice in 3 minutes was saved';
  exception when unique_violation then null;
  end;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.price_changes where lower(item) = 'urinalysis' and status = 'waiting') <> 1 then
    raise exception 'FAIL 5: more than one proposal waits for the same test';
  end if;
  if (select amount from public.price_changes where lower(item) = 'urinalysis' and status = 'waiting') <> 1300 then
    raise exception 'FAIL 5: the newer proposal is not the one waiting';
  end if;
end $$;
\echo 'PASS 5: a newer proposal replaces the waiting one; a double tap is refused'


-- ===== 6. A nurse and the Front Desk cannot propose; the lab cannot decide =====
do $$
declare person text;
begin
  foreach person in array array['00000000-0000-0000-0000-000000000423', '00000000-0000-0000-0000-000000000424'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', person)::text, true);
    set local role authenticated;
    begin
      perform public.propose_price('PCV', 1);
      raise exception 'FAIL 6: % proposed a lab price', person;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000421"}', true);
  set local role authenticated;
  begin
    perform public.decide_price((select id from public.price_changes where status = 'waiting' limit 1), true);
    raise exception 'FAIL 6: the lab approved its own price';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;
\echo 'PASS 6: only the lab or an admin proposes, only an admin decides'


-- ===== 7. Other saved for everybody is standard at once =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000421"}', true);
set local role authenticated;
select public.save_pick_option_for_everybody('lab_test', 'Serum Zinc');
reset role;
do $$
begin
  if not (select standard from public.pick_options where list = 'lab_test' and label = 'Serum Zinc') then
    raise exception 'FAIL 7: a line saved for everybody is not standard';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000424"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.save_pick_option_for_everybody('lab_test', 'Front desk test');
    raise exception 'FAIL 7: the Front Desk added to the lab test list';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 7: Other saved for everybody is standard at once, within the list rules'


-- ===== 8. Words added inside a test: lab only, kept once, read by medical =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000421"}', true);
set local role authenticated;
select public.add_lab_choice('Widal Test', 'S. typhi D, O antigen', '1/1280');
select public.add_lab_choice('widal test', 's. typhi d, o antigen', '1/1280 ');
reset role;
do $$
begin
  if (select count(*) from public.lab_field_choices where label = '1/1280') <> 1 then
    raise exception 'FAIL 8: the added words are missing or kept twice';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000423"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.lab_field_choices) then
    raise exception 'FAIL 8: a nurse cannot read the added words';
  end if;
  begin
    perform public.add_lab_choice('PCV', 'Result', 'AA');
    raise exception 'FAIL 8: a nurse added words to a lab test';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000424"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.lab_field_choices) then
    raise exception 'FAIL 8: the Front Desk reads the words added to lab tests';
  end if;
end $$;
reset role;
\echo 'PASS 8: words added inside a test are kept once, by the lab only'

rollback;
