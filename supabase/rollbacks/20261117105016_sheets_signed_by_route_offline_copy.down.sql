-- =============================================================================
-- Undo sheets_signed_by_route_offline_copy: back to how it was before.
-- =============================================================================
drop function public.log_offline_view(bigint, timestamptz);
drop function public.copy_open_visits();
drop function private.log_offline_view(bigint, timestamptz);
drop function private.copy_open_visits();

drop trigger openings_activity on public.record_openings;
create trigger openings_activity after insert on public.record_openings
  for each row execute function private.write_activity();
drop function private.write_opening_activity();
revoke insert (patient_id, staff_id) on public.record_openings from authenticated;
grant insert on public.record_openings to authenticated;
alter table public.record_openings drop column purpose;

drop trigger consultation_notes_signed_by on public.consultation_notes;
drop trigger vital_signs_signed_by on public.vital_signs;
drop trigger medications_given_signed_by on public.medications_given;
drop function private.check_signed_by();
drop index public.consultation_notes_signed_by_idx;
drop index public.vital_signs_signed_by_idx;
drop index public.medications_given_signed_by_idx;
alter table public.consultation_notes drop column signed_by;
alter table public.vital_signs drop column signed_by;
alter table public.medications_given drop column signed_by;

alter table public.medications_given drop column route;
alter table public.patient_medications drop column route;
