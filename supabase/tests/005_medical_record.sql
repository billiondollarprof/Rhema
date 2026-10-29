-- =============================================================================
-- 005_medical_record.sql: tests for the medical record.
--
-- What this is: proves the record's rules hold in the database itself:
-- only medical staff, only after opening the record (in the last 12 hours),
-- every opening logged, nothing deleted, writers always real, and medicine
-- statuses that move forward with a log line each time.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: a nurse, a second nurse, a front desk, an admin, a patient =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'mr-nurse@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a2', 'mr-nurse2@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a3', 'mr-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a4', 'mr-admin@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Record Nurse',  'mr-nurse@test.rhema',  'nurse'),
  ('00000000-0000-0000-0000-0000000000a2', 'Record Nurse 2','mr-nurse2@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-0000000000a3', 'Record Desk',   'mr-desk@test.rhema',   'front_desk'),
  ('00000000-0000-0000-0000-0000000000a4', 'Record Admin',  'mr-admin@test.rhema',  'admin');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Record Made Up', '1988-08-08', 'female', '00000000-0000-0000-0000-0000000000a3');

create temporary table t (patient bigint);
insert into t select id from public.patients where full_name = 'Record Made Up';
grant select on t to authenticated;


-- ===== 1. Before opening the record, a nurse sees and adds nothing =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  insert into public.allergies (patient_id, allergen) select patient, 'Penicillin' from t;
  raise exception 'FAIL 1: an allergy was added without opening the record';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 1: nothing can be added before the record is opened'


-- ===== 2. The front desk cannot open a medical record at all =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
do $$
begin
  perform public.open_record((select patient from t));
  raise exception 'FAIL 2: the front desk opened a medical record';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 2: the front desk cannot open a medical record'


-- ===== 3. The nurse opens it, then records allergy, vitals and a medicine ===
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
select public.open_record((select patient from t));
insert into public.allergies (patient_id, allergen, reaction, severe) select patient, 'Penicillin', 'Rash', true from t;
insert into public.vital_signs (patient_id, systolic, diastolic, pulse, temperature_c) select patient, 120, 80, 72, 36.8 from t;
insert into public.patient_medications (patient_id, medicine, dose, how_often) select patient, 'Metformin', '500 mg', 'Twice daily' from t;
insert into public.nursing_notes (patient_id, note) select patient, 'Comfortable, eating well' from t;
do $$
begin
  if (select count(*) from public.allergies) <> 1 or (select count(*) from public.vital_signs) <> 1 then
    raise exception 'FAIL 3: the nurse could not read what she recorded';
  end if;
end $$;
reset role;
\echo 'PASS 3: after opening, the nurse records and reads the record'


-- ===== 4. Opening is logged, and the admin sees it in the activity log =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.record_openings where staff_id = '00000000-0000-0000-0000-0000000000a1') <> 1 then
    raise exception 'FAIL 4: the admin cannot see who opened the record';
  end if;
  if (select count(*) from public.activity_log where table_name = 'record_openings') < 1 then
    raise exception 'FAIL 4: the opening is not in the activity log';
  end if;
end $$;
reset role;
\echo 'PASS 4: every opening is logged and the admin sees it'


-- ===== 5. A second nurse who has not opened it sees nothing ================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.allergies) + (select count(*) from public.vital_signs)
     + (select count(*) from public.patient_medications) + (select count(*) from public.nursing_notes) <> 0 then
    raise exception 'FAIL 5: a nurse who did not open the record could read it';
  end if;
end $$;
reset role;
\echo 'PASS 5: the record stays closed to anyone who did not open it'


-- ===== 6. Medicine statuses: suspend (orange), resume, stop (red), final ===
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
select public.change_medication_status((select id from public.patient_medications where medicine = 'Metformin'), 'suspended', 'Sugar too low this morning');
select public.change_medication_status((select id from public.patient_medications where medicine = 'Metformin'), 'active', 'Back to normal');
select public.change_medication_status((select id from public.patient_medications where medicine = 'Metformin'), 'stopped', 'Doctor changed the treatment');
do $$
begin
  if (select count(*) from public.medication_status_log) <> 4 then
    raise exception 'FAIL 6: expected 4 status lines (added, suspended, active, stopped), got %',
      (select count(*) from public.medication_status_log);
  end if;
  if not exists (select 1 from public.medication_status_log
                 where new_status = 'suspended' and reason = 'Sugar too low this morning'
                   and changed_by = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'FAIL 6: the suspension was not logged with its reason and the nurse';
  end if;
end $$;
do $$
begin
  perform public.change_medication_status((select id from public.patient_medications where medicine = 'Metformin'), 'active', 'Try again');
  raise exception 'FAIL 6: a stopped medicine was restarted';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
do $$
begin
  insert into public.medication_status_log (medication_id, patient_id, new_status)
  select id, patient_id, 'active' from public.patient_medications limit 1;
  raise exception 'FAIL 6: the status log was written by hand';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 6: suspend, resume and stop are logged with who and why; stopped is final'


-- ===== 7. A dose given: the exact time and who gave it, never somebody else
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
insert into public.medications_given (patient_id, medicine, dose, given_at)
select patient, 'Paracetamol', '1 g', now() - interval '20 minutes' from t;
do $$
begin
  insert into public.medications_given (patient_id, medicine, given_by)
  select patient, 'Paracetamol', '00000000-0000-0000-0000-0000000000a2' from t;
  raise exception 'FAIL 7: a dose was recorded in another nurse''s name';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  insert into public.medications_given (patient_id, medicine, given_at)
  select patient, 'Paracetamol', now() + interval '2 hours' from t;
  raise exception 'FAIL 7: a dose was recorded in the future';
exception when check_violation then null;
end $$;
reset role;
\echo 'PASS 7: each dose carries its real time and the real nurse'


-- ===== 8. Nothing is deleted or rewritten; a mistake is voided with a reason
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  delete from public.nursing_notes;
  raise exception 'FAIL 8: a nursing note was deleted';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  update public.nursing_notes set note = 'Changed afterwards';
  raise exception 'FAIL 8: a nursing note was rewritten';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  update public.allergies set voided_at = now(), voided_by = '00000000-0000-0000-0000-0000000000a1';
  raise exception 'FAIL 8: an allergy was voided without a reason';
exception when check_violation then null;
end $$;
update public.allergies set voided_at = now(), voided_by = '00000000-0000-0000-0000-0000000000a1',
  void_reason = 'Entered on the wrong patient';
reset role;
\echo 'PASS 8: nothing is deleted or rewritten; voiding needs a reason'


-- ===== 9. After 12 hours the record closes again ===========================
-- Move the nurse's opening back 13 hours (as the database owner), then ask.
update public.record_openings set opened_at = now() - interval '13 hours'
where staff_id = '00000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.vital_signs) <> 0 then
    raise exception 'FAIL 9: the record stayed open after 12 hours';
  end if;
end $$;
reset role;
\echo 'PASS 9: the record closes 12 hours after it was opened'


-- ===== 10. Nobody signed in gets anything =================================
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  perform 1 from public.vital_signs;
  raise exception 'FAIL 10: somebody not signed in read vital signs';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 10: the public gets nothing'

-- ===== 11. The fixed patients rule: voiding a patient needs a reason =======
do $$
begin
  update public.patients set voided_at = now() where full_name = 'Record Made Up';
  raise exception 'FAIL 11: a patient was voided without a reason';
exception when check_violation then null;
end $$;
\echo 'PASS 11: a patient cannot be voided without a reason'

-- ===== 12. Losing the medical permission closes an open record at once =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
set local role authenticated;
select public.open_record((select patient from t));
do $$
begin
  if (select count(*) from public.nursing_notes) <> 1 then
    raise exception 'FAIL 12: the second nurse could not read after opening';
  end if;
end $$;
reset role;
-- The admin takes away her medical record permission (as the owner here).
update public.staff set can_medical = false where email = 'mr-nurse2@test.rhema';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.nursing_notes) <> 0 then
    raise exception 'FAIL 12: the record stayed open after the medical permission was taken away';
  end if;
end $$;
reset role;
\echo 'PASS 12: taking away the medical permission closes an open record at once'

rollback;
\echo 'ALL MEDICAL RECORD TESTS PASSED'
