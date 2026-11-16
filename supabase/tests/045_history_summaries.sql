-- =============================================================================
-- tests for history_summaries (requests 215 and 216, 2026-11-16).
--
-- What this proves: the Front Desk sees the money for the period, split by
-- category (the card by Individual, Family, Antenatal) and by cash, POS and
-- transfer, with voided payments left out; "only mine" leaves out another
-- person's payments; the Lab and the Pharmacy get counts and no money, and
-- cannot ask for money; a doctor gets only their own work; a period over
-- 400 days, or back to front, is refused.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000451', 't045-desk1@test.rhema'),
  ('00000000-0000-0000-0000-000000000452', 't045-desk2@test.rhema'),
  ('00000000-0000-0000-0000-000000000453', 't045-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000454', 't045-pharm@test.rhema'),
  ('00000000-0000-0000-0000-000000000455', 't045-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000456', 't045-nurse2@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000451', 'T45 Desk1',  't045-desk1@test.rhema',  'front_desk'),
  ('00000000-0000-0000-0000-000000000452', 'T45 Desk2',  't045-desk2@test.rhema',  'front_desk'),
  ('00000000-0000-0000-0000-000000000453', 'T45 Lab',    't045-lab@test.rhema',    'laboratory'),
  ('00000000-0000-0000-0000-000000000454', 'T45 Pharm',  't045-pharm@test.rhema',  'pharmacy'),
  ('00000000-0000-0000-0000-000000000455', 'T45 Nurse',  't045-nurse@test.rhema',  'nurse'),
  ('00000000-0000-0000-0000-000000000456', 'T45 Nurse2', 't045-nurse2@test.rhema', 'nurse');

create temporary table t45 (name text primary key, id bigint);
grant all on t45 to authenticated;

-- Desk 1: an antenatal patient pays the card by cash, and a lab payment by
-- POS. Desk 2: an individual patient pays consultation by transfer.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000451"}', true);
set local role authenticated;
insert into public.patients (full_name, date_of_birth, sex, category) values ('T45 Ante', '1990-01-01', 'female', 'antenatal');
insert into t45 select 'ante', id from public.patients where full_name = 'T45 Ante';
select public.take_payment((select id from t45 where name = 'ante'), 'registration_card', '[{"label":"Card","amount":2000}]', 'cash');
select public.take_payment((select id from t45 where name = 'ante'), 'lab_test', '[{"label":"PCV","amount":1500}]', 'pos');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000452"}', true);
set local role authenticated;
insert into public.patients (full_name, date_of_birth, sex) values ('T45 Indiv', '1985-01-01', 'male');
insert into t45 select 'indiv', id from public.patients where full_name = 'T45 Indiv';
select public.take_payment((select id from t45 where name = 'indiv'), 'consultation', '[{"label":"Consultation","amount":5000}]', 'transfer');
reset role;


-- ===== 1. The Front Desk sees the money, by category and by mode =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000451"}', true);
set local role authenticated;
do $$
declare
  all_of jsonb := public.money_summary(now() - interval '1 hour', now() + interval '1 minute', false, null);
  mine jsonb := public.money_summary(now() - interval '1 hour', now() + interval '1 minute', true, null);
begin
  -- The Front Desk asking for everybody still gets only their own.
  if (all_of ->> 'total')::numeric <> 3500 then
    raise exception 'FAIL 1: the Front Desk saw another person''s money: %', all_of ->> 'total';
  end if;
  if not (all_of -> 'by_category') @> '[{"key":"card_antenatal","amount":2000}]'::jsonb then
    raise exception 'FAIL 1: the antenatal card is not its own category: %', all_of -> 'by_category';
  end if;
  if not (all_of -> 'by_mode') @> '[{"key":"cash","amount":2000}]'::jsonb
     or (all_of -> 'by_mode') @> '[{"key":"transfer"}]'::jsonb then
    raise exception 'FAIL 1: the totals by mode are wrong: %', all_of -> 'by_mode';
  end if;
  if (mine ->> 'total')::numeric <> 3500 then
    raise exception 'FAIL 1: only mine is wrong: %', mine ->> 'total';
  end if;
  if jsonb_array_length(mine -> 'registered') <> 1 then
    raise exception 'FAIL 1: only mine shows another desk''s registration';
  end if;
end $$;
reset role;
\echo 'PASS 1: the Front Desk sees only its own money, by category and mode'


-- ===== 1b. An admin sees everybody, or one person =====
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000457', 't045-admin@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000457', 'T45 Admin', 't045-admin@test.rhema', 'admin');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000457"}', true);
set local role authenticated;
do $$
begin
  if (public.money_summary(now() - interval '1 hour', now() + interval '1 minute', false, null) ->> 'total')::numeric < 8500 then
    raise exception 'FAIL 1b: the admin does not see everybody';
  end if;
  if (public.money_summary(now() - interval '1 hour', now() + interval '1 minute', false,
        '00000000-0000-0000-0000-000000000452') ->> 'total')::numeric <> 5000 then
    raise exception 'FAIL 1b: the admin cannot see one person''s money';
  end if;
end $$;
reset role;
\echo 'PASS 1b: an admin sees everybody, or one person they choose'


-- ===== 1c. The shift starts at the last email sign in =====
update auth.users set last_sign_in_at = now() - interval '30 hours'
where id = '00000000-0000-0000-0000-000000000451';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000451"}', true);
set local role authenticated;
do $$
begin
  if public.my_shift_start() is null or public.my_shift_start() > now() - interval '29 hours' then
    raise exception 'FAIL 1c: the shift start is not the last sign in';
  end if;
end $$;
reset role;
\echo 'PASS 1c: the shift starts at the last email sign in'


-- ===== 2. A voided payment is left out =====
update public.payments set voided_at = now(), voided_by = '00000000-0000-0000-0000-000000000451', void_reason = 'test'
where patient_id = (select id from t45 where name = 'indiv');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000452"}', true);
set local role authenticated;
do $$
begin
  if (public.money_summary(now() - interval '1 hour', now() + interval '1 minute', true, null) ->> 'total')::numeric <> 0 then
    raise exception 'FAIL 2: a voided payment was counted';
  end if;
end $$;
reset role;
\echo 'PASS 2: a voided payment is left out'


-- ===== 3. The Lab and the Pharmacy get counts, never money =====
do $$
declare person text;
begin
  foreach person in array array['00000000-0000-0000-0000-000000000453', '00000000-0000-0000-0000-000000000454', '00000000-0000-0000-0000-000000000455'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', person)::text, true);
    set local role authenticated;
    begin
      perform public.money_summary(now() - interval '1 hour', now(), false, null);
      raise exception 'FAIL 3: % saw the money', person;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000453"}', true);
set local role authenticated;
do $$
declare got jsonb := public.lab_summary(now() - interval '1 day', now());
begin
  if got ? 'total' or got::text like '%amount%' then
    raise exception 'FAIL 3: the Lab summary carries money';
  end if;
  begin
    perform public.pharmacy_summary(now() - interval '1 day', now());
    raise exception 'FAIL 3: the Lab saw the Pharmacy numbers';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000454"}', true);
set local role authenticated;
do $$
begin
  perform public.pharmacy_summary(now() - interval '1 day', now());
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000451"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.lab_summary(now() - interval '1 day', now());
    raise exception 'FAIL 3: the Front Desk saw the Lab numbers';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pharmacy_summary(now() - interval '1 day', now());
    raise exception 'FAIL 3: the Front Desk saw the Pharmacy numbers';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 3: the Lab and the Pharmacy get counts, never money'


-- ===== 4. A nurse sees only her own work =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000455"}', true);
set local role authenticated;
select public.open_record((select id from t45 where name = 'ante'));
insert into public.nursing_notes (patient_id, note) values ((select id from t45 where name = 'ante'), 'T45 note');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000456"}', true);
set local role authenticated;
select public.open_record((select id from t45 where name = 'indiv'));
insert into public.nursing_notes (patient_id, note) values ((select id from t45 where name = 'indiv'), 'T45 other note');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000455"}', true);
set local role authenticated;
do $$
declare got jsonb := public.my_summary(now() - interval '1 hour', now() + interval '1 minute');
begin
  if (got ->> 'patients')::int <> 1 or (got -> 'counts' ->> 'nursing')::int <> 1 then
    raise exception 'FAIL 4: her own work is wrong: %', got;
  end if;
  if got::text like '%amount%' or got::text like '%total%' then
    raise exception 'FAIL 4: her summary carries money';
  end if;
end $$;
reset role;
\echo 'PASS 4: a nurse sees only her own work, and no money'


-- ===== 5. A period over 400 days, or back to front, is refused =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000451"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.money_summary(now() - interval '500 days', now(), false, null);
    raise exception 'FAIL 5: a period of 500 days was answered';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.my_summary(now(), now() - interval '1 day');
    raise exception 'FAIL 5: a back to front period was answered';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
\echo 'PASS 5: a period over 400 days, or back to front, is refused'

rollback;
