-- =============================================================================
-- Undo 20261120040440_consultants_void_own_notes_only.sql: any consultant
-- with a consultation room may void any consultation note again.
-- =============================================================================

drop policy consultation_update on public.consultation_notes;
create policy consultation_update on public.consultation_notes for update to authenticated
  using (private.can_use_record(patient_id) and (select private.has_consulting_room()))
  with check (
    private.can_use_record(patient_id)
    and (select private.has_consulting_room())
    and (voided_by is null or voided_by = (select auth.uid()))
  );
