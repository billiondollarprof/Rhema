-- =============================================================================
-- remove_live_test_patients.sql
--
-- What this is: deletes the 8 test patients made on the live site while the
-- staff were learning the app, with every record that points at them.
--
-- Why: Anthony, 2026-11-16 (request 205): "remove all the test patients
-- added before today." A read only look listed 8 (RMC-000001 to RMC-000008,
-- added 9 to 15 November) and he confirmed: "all 8 are test patients."
--
-- How it stays safe:
--   - It matches each patient by BOTH its number AND the exact moment it was
--     added, so it can only ever find these 8. On the testing database the
--     same numbers exist but were added at other moments, so nothing there
--     matches and nothing is deleted.
--   - It finds 0 (testing) or exactly 8 (live). Any other count stops it with
--     an error and nothing is deleted, because the whole file is one
--     transaction.
--   - Only rows that belong to these patients are deleted, children first.
--   - The live backup of 2026-11-16 08:00 UTC holds them, if ever needed.
--
-- Never: run again with other patients by editing the list. A new deletion
-- is a new request, a new read only look and a new yes from Anthony.
-- =============================================================================

do $$
declare
  found_ids bigint[];
  family_ids bigint[];
begin
  -- ===== 1. The 8 patients, by number and the exact moment added =====
  select array_agg(p.id), array_agg(distinct p.family_id) filter (where p.family_id is not null)
  into found_ids, family_ids
  from public.patients p
  join (values
    ('RMC-000001', '2026-11-09 06:52:17.697637+00'::timestamptz),
    ('RMC-000002', '2026-11-09 07:01:55.741384+00'),
    ('RMC-000003', '2026-11-09 12:45:42.55639+00'),
    ('RMC-000004', '2026-11-11 06:39:24.986263+00'),
    ('RMC-000005', '2026-11-12 11:58:45.699638+00'),
    ('RMC-000006', '2026-11-13 14:41:16.944535+00'),
    ('RMC-000007', '2026-11-13 16:07:25.967309+00'),
    ('RMC-000008', '2026-11-15 09:27:00.536751+00')
  ) as target (patient_number, created_at)
    on target.patient_number = p.patient_number and target.created_at = p.created_at;

  if found_ids is null then
    raise notice 'No live test patients here (this is not the live database). Nothing deleted.';
    return;
  end if;
  if array_length(found_ids, 1) <> 8 then
    raise exception 'Expected the 8 test patients, found %. Nothing deleted.', array_length(found_ids, 1);
  end if;

  -- ===== 2. Records that point at other records of these patients =====
  delete from public.payment_lines
    where payment_id in (select id from public.payments where patient_id = any (found_ids));
  delete from public.lab_results where patient_id = any (found_ids)
    or request_id in (select id from public.lab_requests where patient_id = any (found_ids));
  delete from public.prescription_items
    where prescription_id in (select id from public.prescriptions where patient_id = any (found_ids));
  delete from public.medication_status_log where patient_id = any (found_ids)
    or medication_id in (select id from public.patient_medications where patient_id = any (found_ids));
  delete from public.medications_given where patient_id = any (found_ids)
    or medication_id in (select id from public.patient_medications where patient_id = any (found_ids));

  -- ===== 3. The patients' own records =====
  delete from public.lab_requests         where patient_id = any (found_ids);
  delete from public.prescriptions        where patient_id = any (found_ids);
  delete from public.payments             where patient_id = any (found_ids);
  delete from public.patient_medications  where patient_id = any (found_ids);
  delete from public.allergies            where patient_id = any (found_ids);
  delete from public.antenatal_bookings   where patient_id = any (found_ids);
  delete from public.antenatal_tests      where patient_id = any (found_ids);
  delete from public.antenatal_visits     where patient_id = any (found_ids);
  delete from public.attention_calls      where patient_id = any (found_ids);
  delete from public.conditions           where patient_id = any (found_ids);
  delete from public.consultation_notes   where patient_id = any (found_ids);
  delete from public.medical_profiles     where patient_id = any (found_ids);
  delete from public.nursing_notes        where patient_id = any (found_ids);
  delete from public.operation_consents   where patient_id = any (found_ids);
  delete from public.patient_files        where patient_id = any (found_ids);
  delete from public.previous_pregnancies where patient_id = any (found_ids);
  delete from public.queue_entries        where patient_id = any (found_ids);
  delete from public.record_emails        where patient_id = any (found_ids);
  delete from public.record_openings      where patient_id = any (found_ids);
  delete from public.vital_extras         where patient_id = any (found_ids);
  delete from public.vital_signs          where patient_id = any (found_ids);
  delete from public.activity_log         where patient_id = any (found_ids);

  -- ===== 4. The patients, then a family left with nobody in it =====
  delete from public.patients where id = any (found_ids);
  if family_ids is not null then
    delete from public.families f
    where f.id = any (family_ids)
      and not exists (select 1 from public.patients p where p.family_id = f.id);
  end if;

  raise notice 'Deleted the 8 live test patients and their records.';
end $$;
