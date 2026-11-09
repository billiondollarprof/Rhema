-- =============================================================================
-- 026_antenatal_booking_and_consent.sql: tests for the antenatal booking,
-- the operation consent and the dispensed notice.
--
-- What this is: proves only medical staff with the record open read or
-- write any of it; the writer is always the person signed in; a consent
-- needs its tick; a double tap saves once; and only the prescribing doctor
-- marks a dispensed notice seen.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'an-matron@test.rhema'),
  ('00000000-0000-0000-0000-0000000000c2', 'an-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000c3', 'an-nurse@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'Booking Matron', 'an-matron@test.rhema', 'matron'),
  ('00000000-0000-0000-0000-0000000000c2', 'Booking Desk',   'an-desk@test.rhema',   'front_desk'),
  ('00000000-0000-0000-0000-0000000000c3', 'Booking Nurse',  'an-nurse@test.rhema',  'nurse');
insert into public.patients (full_name, date_of_birth, sex, category, created_by)
values ('Booking Made Up', '1995-05-05', 'female', 'antenatal', '00000000-0000-0000-0000-0000000000c2');
create temporary table t (patient bigint);
insert into t select id from public.patients where full_name = 'Booking Made Up';
grant select on t to authenticated;


-- ===== 1. Before the record is open, the matron writes nothing ================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
do $$
begin
  insert into public.antenatal_tests (patient_id, test, result) select patient, 'pcv', '34%' from t;
  raise exception 'FAIL 1: a test was saved without opening the record';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 1: nothing is saved before the record is opened'


-- ===== 2. With the record open, the matron fills the booking ==================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
select public.open_record((select patient from t));
insert into public.antenatal_bookings (patient_id, kin_occupation, kin_religion, kin_tribe, abortions,
  parity, documented_delivery, documented_answered_by, documented_answered_at)
  select patient, 'Trader', 'Christian', 'Ijaw', 1, 'Para 1+0', false,
         '00000000-0000-0000-0000-0000000000c1', now() from t;
insert into public.antenatal_tests (patient_id, test, result, tested_on) select patient, 'pcv', '34%', current_date from t;
insert into public.previous_pregnancies (patient_id, born_on, duration, delivery_method, baby_sex, baby_died, age_at_death, cause_of_death)
  select patient, '2023-06-26', 'Term', 'SVD', 'male', true, 'Stillbirth', 'Prolonged labour' from t;
insert into public.operation_consents (patient_id, consenting_name, operation, relationship, consent_ticked, consented_on,
  witness_name, witness_ticked, witnessed_on)
  select patient, 'Made Up Husband', 'Caesarean section', 'Husband', true, current_date, 'Made Up Witness', true, current_date from t;
reset role;
do $$
begin
  if (select count(*) from public.antenatal_bookings) <> 1
     or (select count(*) from public.antenatal_tests) <> 1
     or (select count(*) from public.previous_pregnancies) <> 1
     or (select count(*) from public.operation_consents) <> 1 then
    raise exception 'FAIL 2: the booking was not all saved';
  end if;
  if not exists (select 1 from public.activity_log where table_name = 'operation_consents') then
    raise exception 'FAIL 2: the consent is not in the activity log';
  end if;
end $$;
\echo 'PASS 2: with the record open the booking, a test, a pregnancy and a consent save, logged'


-- ===== 3. A double tap saves once =============================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
insert into public.antenatal_tests (patient_id, test, result, tested_on) select patient, 'pcv', '34%', current_date from t;
reset role;
do $$
begin
  if (select count(*) from public.antenatal_tests) <> 1 then
    raise exception 'FAIL 3: a double tap saved the test twice';
  end if;
end $$;
\echo 'PASS 3: a double tap saves once'


-- ===== 4. A consent needs its tick; nobody writes in another name =============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
do $$
begin
  insert into public.operation_consents (patient_id, consenting_name, operation, consent_ticked, consented_on)
    select patient, 'Made Up', 'Surgery', false, current_date from t;
  raise exception 'FAIL 4: a consent was saved without its tick';
exception when check_violation then null;
end $$;
do $$
begin
  insert into public.antenatal_tests (patient_id, test, result, recorded_by)
    select patient, 'rvs', 'Negative', '00000000-0000-0000-0000-0000000000c3' from t;
  raise exception 'FAIL 4: a test was saved in another person''s name';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  update public.operation_consents set operation = 'Changed';
  raise exception 'FAIL 4: a consent was changed after it was saved';
exception when insufficient_privilege then null;
end $$;
reset role;
do $$
begin
  if has_column_privilege('authenticated', 'public.operation_consents', 'operation', 'update')
     or has_column_privilege('authenticated', 'public.operation_consents', 'consent_ticked', 'update')
     or has_column_privilege('authenticated', 'public.antenatal_tests', 'result', 'update') then
    raise exception 'FAIL 4: a saved consent or result can be rewritten from the app';
  end if;
end $$;
\echo 'PASS 4: a consent needs its tick, cannot be changed; nobody writes in another name'


-- ===== 5. The front desk sees none of it ======================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.antenatal_bookings) or exists (select 1 from public.operation_consents)
     or exists (select 1 from public.previous_pregnancies) or exists (select 1 from public.antenatal_tests) then
    raise exception 'FAIL 5: the front desk read the booking';
  end if;
end $$;
reset role;
\echo 'PASS 5: the front desk sees none of it'


-- ===== 6. Only the prescribing doctor marks a dispensed notice seen ===========
do $$
declare
  rx bigint;
begin
  insert into public.prescriptions (patient_id, prescribed_by, status)
    select patient, '00000000-0000-0000-0000-0000000000c1', 'dispensed' from t
    returning id into rx;
  perform set_config('test.rx', rx::text, true);
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', true);
set local role authenticated;
do $$
begin
  if public.mark_dispense_seen(current_setting('test.rx')::bigint) then
    raise exception 'FAIL 6: another person marked the notice seen';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
do $$
begin
  if not public.mark_dispense_seen(current_setting('test.rx')::bigint) then
    raise exception 'FAIL 6: the prescribing doctor could not mark it seen';
  end if;
end $$;
reset role;
do $$
begin
  if has_function_privilege('anon', 'public.mark_dispense_seen(bigint)', 'execute') then
    raise exception 'FAIL 6: somebody signed out may mark notices';
  end if;
end $$;
\echo 'PASS 6: only the prescribing doctor marks a dispensed notice seen'

rollback;
