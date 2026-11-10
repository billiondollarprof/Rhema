-- =============================================================================
-- Undo for 20261110141814_doctor_notes_front_desk_registers_med_edit.sql
--
-- Puts the earlier rules back: anybody with the record open writes
-- consultation notes, anybody who may see patients registers one, and the
-- medicine name, dose and how often are no longer editable. Nothing saved is
-- lost.
-- =============================================================================

drop trigger if exists medications_guard_edit on public.patient_medications;
drop function if exists private.guard_medication_edit();
revoke update (medicine, dose, how_often) on public.patient_medications from authenticated;

drop policy patients_insert on public.patients;
create policy patients_insert on public.patients
  for insert to authenticated
  with check ((select private.has_permission('patients')) and created_by = (select auth.uid()));

drop policy consultation_update on public.consultation_notes;
create policy consultation_update on public.consultation_notes for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and (voided_by is null or voided_by = (select auth.uid())));

drop policy consultation_insert on public.consultation_notes;
create policy consultation_insert on public.consultation_notes for insert to authenticated
  with check (private.can_use_record(patient_id) and written_by = (select auth.uid()));

drop function if exists private.is_front_desk();
