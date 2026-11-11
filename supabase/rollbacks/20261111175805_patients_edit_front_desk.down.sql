-- =============================================================================
-- Undo for 20261111175805_patients_edit_front_desk.sql
--
-- Puts the earlier rule back: anybody who may see patients may change them.
-- Nothing saved is lost.
-- =============================================================================

drop policy patients_update on public.patients;
create policy patients_update on public.patients
  for update to authenticated
  using ((select private.has_permission('patients')))
  with check ((select private.has_permission('patients')));
