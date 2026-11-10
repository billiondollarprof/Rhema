-- =============================================================================
-- Undo for 20261110130716_old_file_without_phone.sql
--
-- Puts the old rule back: an old file patient needs a phone number when
-- there is no date of birth and sex. If any old file patient was saved
-- without a phone number since, this will refuse to run, and those patients
-- would need a phone number first (that needs Anthony's explicit yes).
-- =============================================================================

alter table public.patients drop constraint patients_details_or_old_file;
alter table public.patients
  add constraint patients_details_or_old_file check (
    (date_of_birth is not null and sex is not null)
    or (from_old_file and phone is not null)
  );
