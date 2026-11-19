-- =============================================================================
-- Undo 20261119132802_front_desk_takes_vitals.sql: only clinical staff with
-- the record open add vital signs again, and the shared signer check is back.
-- Readings the Front Desk already saved stay in the record.
-- =============================================================================

drop trigger vital_signs_signed_by on public.vital_signs;
create trigger vital_signs_signed_by before insert on public.vital_signs
  for each row execute function private.check_signed_by();
drop function private.check_vitals_signed_by();

drop policy vitals_read_own_front_desk on public.vital_signs;

drop policy vitals_insert on public.vital_signs;
create policy vitals_insert on public.vital_signs for insert to authenticated
  with check (private.can_use_record(patient_id) and recorded_by = (select auth.uid()));
