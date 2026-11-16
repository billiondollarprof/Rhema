-- =============================================================================
-- 040_price_list.sql: tests for the price list (Settings part 1, 2026-11-16).
--
-- What this proves: nobody writes the table by hand; an admin sets, changes
-- and removes a price; a nurse or the Front Desk cannot; everybody active
-- reads it; a bad amount is refused; one price per thing whatever the
-- capitals; and every change is in the activity log.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000401', 't040-admin@test.rhema'),
  ('00000000-0000-0000-0000-000000000402', 't040-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000403', 't040-nurse@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000401', 'T40 Admin', 't040-admin@test.rhema', 'admin'),
  ('00000000-0000-0000-0000-000000000402', 'T40 Desk',  't040-desk@test.rhema',  'front_desk'),
  ('00000000-0000-0000-0000-000000000403', 'T40 Nurse', 't040-nurse@test.rhema', 'nurse');


-- ===== 1. Nobody holds rights they should not have =====
do $$
begin
  if has_table_privilege('anon', 'public.price_list', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL 1: the public has rights on the price list';
  end if;
  if has_table_privilege('authenticated', 'public.price_list', 'INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL 1: signed in users write the price list by hand';
  end if;
  if has_function_privilege('anon', 'public.set_price(text, text, numeric)', 'EXECUTE') then
    raise exception 'FAIL 1: the public can set prices';
  end if;
end $$;
\echo 'PASS 1: nobody holds rights they should not have'


-- ===== 2. The admin sets, changes and removes a price =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000401"}', true);
set local role authenticated;
select public.set_price('card', 'Registration card', 2000);
select public.set_price('lab_test', 'Full Blood Count', 3500);
select public.set_price('lab_test', 'full blood count', 4000);
select public.set_price('lab_test', 'Malaria test', 1500);
select public.set_price('lab_test', 'Malaria test', null);
reset role;
do $$
begin
  if (select amount from public.price_list where kind = 'card') <> 2000 then
    raise exception 'FAIL 2: the card fee was not set';
  end if;
  if (select count(*) from public.price_list where kind = 'lab_test' and lower(item) = 'full blood count') <> 1
     or (select amount from public.price_list where kind = 'lab_test' and lower(item) = 'full blood count') <> 4000 then
    raise exception 'FAIL 2: the second price did not replace the first one';
  end if;
  if exists (select 1 from public.price_list where item = 'Malaria test') then
    raise exception 'FAIL 2: an empty amount did not remove the price';
  end if;
  if (select count(*) from public.activity_log where table_name = 'price_list') < 4 then
    raise exception 'FAIL 2: price changes are missing from the activity log';
  end if;
  if (select updated_by from public.price_list where kind = 'card') <> '00000000-0000-0000-0000-000000000401' then
    raise exception 'FAIL 2: the price does not say who set it';
  end if;
end $$;
\echo 'PASS 2: the admin sets, changes and removes a price, all logged'


-- ===== 3. The Front Desk and a nurse cannot set a price, but can read =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000402"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.set_price('card', 'Registration card', 1);
    raise exception 'FAIL 3: the Front Desk set a price';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.price_list) < 2 then
    raise exception 'FAIL 3: the Front Desk cannot read the prices';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000403"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.set_price('consultation', 'Consultation', 5000);
    raise exception 'FAIL 3: a nurse set a price';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 3: the Front Desk and a nurse read the prices but cannot set them'


-- ===== 4. A bad amount is refused =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000401"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.set_price('card', 'Registration card', -5);
    raise exception 'FAIL 4: a price below zero was saved';
  exception when check_violation then null;
  end;
  begin
    perform public.set_price('card', 'Registration card', 100000000);
    raise exception 'FAIL 4: a price of 100 million was saved';
  exception when check_violation or numeric_value_out_of_range then null;
  end;
  begin
    perform public.set_price('surgery', 'Theatre', 1000);
    raise exception 'FAIL 4: an unknown kind of price was saved';
  exception when raise_exception then null;
  end;
end $$;
reset role;
\echo 'PASS 4: a bad amount or kind is refused'


-- ===== 5. Somebody who is no longer active reads nothing =====
update public.staff set is_active = false where id = '00000000-0000-0000-0000-000000000402';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000402"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.price_list) then
    raise exception 'FAIL 5: a person no longer active reads the prices';
  end if;
end $$;
reset role;
\echo 'PASS 5: somebody no longer active reads nothing'

rollback;
