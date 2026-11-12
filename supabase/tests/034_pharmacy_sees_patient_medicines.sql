-- =============================================================================
-- 034_pharmacy_sees_patient_medicines.sql: tests for the Pharmacy's view of a
-- patient's medicines.
--
-- What this is: proves only the Pharmacy asks, it gets the medicines in every
-- state (and no removed ones), each ask is logged, and the Pharmacy still
-- cannot read the medical record tables themselves.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000341', 't034-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-000000000342', 't034-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000343', 't034-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000344', 't034-doctor@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000341', 'T34 Pharmacy', 't034-pharmacy@test.rhema', 'pharmacy'),
  ('00000000-0000-0000-0000-000000000342', 'T34 Nurse',    't034-nurse@test.rhema',    'nurse'),
  ('00000000-0000-0000-0000-000000000343', 'T34 Desk',     't034-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-000000000344', 'T34 Doctor',   't034-doctor@test.rhema',   'doctor');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T34 Patient', '1990-01-01', 'female', '00000000-0000-0000-0000-000000000343');
create temporary table t (patient bigint);
insert into t select id from public.patients where full_name = 'T34 Patient';
grant select on t to authenticated;

-- Four medicines: current, suspended, stopped (with a reason), and removed.
-- The status log names who changed a medicine, so the setup acts as the doctor.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000344"}', true);
-- Written in the wrong order on purpose: the stopped one first.
insert into public.patient_medications (patient_id, medicine, dose, how_often, added_by) values
  ((select patient from t), 'Ibuprofen 400 mg tablet', '1 tablet', 'When needed', '00000000-0000-0000-0000-000000000344'),
  ((select patient from t), 'Metformin 500 mg tablet', '1 tablet', 'Twice daily', '00000000-0000-0000-0000-000000000344'),
  ((select patient from t), 'Typed by mistake', null, null, '00000000-0000-0000-0000-000000000344'),
  ((select patient from t), 'Amlodipine 5 mg tablet', '1 tablet', 'Once daily', '00000000-0000-0000-0000-000000000344');
select set_config('rhema.status_reason', 'Side effects', true);
update public.patient_medications set status = 'suspended' where medicine like 'Metformin%';
select set_config('rhema.status_reason', 'Finished the course', true);
update public.patient_medications set status = 'stopped' where medicine like 'Ibuprofen%';
update public.patient_medications
  set voided_at = now(), void_reason = 'Entered by mistake', voided_by = '00000000-0000-0000-0000-000000000344'
  where medicine = 'Typed by mistake';
-- Something else on the record that must never come back.
insert into public.allergies (patient_id, allergen, recorded_by)
  values ((select patient from t), 'Penicillin', '00000000-0000-0000-0000-000000000344');


-- ===== 1. The Pharmacy gets the medicines in every state, not the removed one =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000341"}', true);
set local role authenticated;
create temporary table got (answer jsonb);
grant all on got to authenticated;
insert into got select public.patient_medicines_for_pharmacy((select patient from t));
reset role;
do $$
declare answer jsonb := (select answer from got);
begin
  if jsonb_array_length(answer) <> 3 then
    raise exception 'FAIL 1: expected 3 medicines (current, suspended, stopped), got %', jsonb_array_length(answer);
  end if;
  if answer::text like '%Typed by mistake%' then
    raise exception 'FAIL 1: a removed medicine was returned';
  end if;
  if (answer -> 0 ->> 'status') <> 'active' or (answer -> 1 ->> 'status') <> 'suspended' or (answer -> 2 ->> 'status') <> 'stopped' then
    raise exception 'FAIL 1: the medicines are not in the order current, suspended, stopped';
  end if;
  if (answer -> 2 ->> 'last_reason') is distinct from 'Finished the course' then
    raise exception 'FAIL 1: the reason a medicine was stopped is missing';
  end if;
  if (answer -> 1 ->> 'last_reason') is distinct from 'Side effects' then
    raise exception 'FAIL 1: the reason a medicine was suspended is missing';
  end if;
  -- A medicine that was never changed has no "last change" (its creation is not one).
  if (answer -> 0 ->> 'last_change') is not null then
    raise exception 'FAIL 1: a current medicine shows a change it never had';
  end if;
  if answer::text like '%Penicillin%' then
    raise exception 'FAIL 1: something from outside the medicines came back';
  end if;
end $$;
\echo 'PASS 1: the Pharmacy gets current, suspended and stopped medicines, with reasons, and nothing else'


-- ===== 2. Each ask is written to the activity log =====
do $$
begin
  if not exists (
    select 1 from public.activity_log
    where table_name = 'patient_medications' and action = 'read'
      and patient_id = (select patient from t)
      and actor_id = '00000000-0000-0000-0000-000000000341'
  ) then
    raise exception 'FAIL 2: the Pharmacy''s look at the medicines is not in the activity log';
  end if;
end $$;
\echo 'PASS 2: the look is in the activity log'


-- ===== 3. Nobody else asks =====
do $$
declare who text;
begin
  foreach who in array array['000000000342', '000000000343', '000000000344'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    begin
      perform public.patient_medicines_for_pharmacy((select patient from t));
      reset role;
      raise exception 'FAIL 3: somebody who is not the Pharmacy asked';
    exception when insufficient_privilege then
      reset role;
    end;
  end loop;
end $$;
do $$
begin
  if has_function_privilege('anon', 'public.patient_medicines_for_pharmacy(bigint)', 'execute')
     or has_function_privilege('anon', 'private.patient_medicines_for_pharmacy(bigint)', 'execute') then
    raise exception 'FAIL 3: the public can run the Pharmacy''s medicines function';
  end if;
end $$;
\echo 'PASS 3: only the Pharmacy asks'


-- ===== 4. The Pharmacy still cannot read the record itself =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000341"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.patient_medications) <> 0
     or (select count(*) from public.allergies) <> 0
     or (select count(*) from public.consultation_notes) <> 0 then
    raise exception 'FAIL 4: the Pharmacy can read the medical record tables';
  end if;
  begin
    perform public.patient_medicines_for_pharmacy(999999999);
    raise exception 'FAIL 4: a patient that does not exist was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
\echo 'PASS 4: the Pharmacy still cannot read the record, and an unknown patient is refused'

rollback;
