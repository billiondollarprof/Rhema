-- =============================================================================
-- Undo for 20261102105521_patient_files_preview.sql
--
-- Back to: files seen only with the opened medical record, no opening log,
-- and no deleting. Files already deleted stay deleted.
-- =============================================================================

drop function if exists public.open_patient_file(text);
drop function if exists public.delete_patient_file(text);
drop function if exists private.open_patient_file(text);
drop function if exists private.delete_patient_file(text);

drop policy if exists patient_files_read on public.patient_files;
create policy patient_files_read on public.patient_files
  for select to authenticated
  using ((select private.can_use_record(patient_id)));
