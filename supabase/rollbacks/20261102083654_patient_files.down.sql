-- =============================================================================
-- Undo for 20261102083654_patient_files.sql
--
-- Removes files on the record and "Register from old file": the functions,
-- the patient_files table, and the old file mark on patients. Date of birth
-- and sex become required again, which fails on purpose while any patient
-- from an old file still has them empty: fill them in first.
--
-- On the live database this loses the list of attached files (the files
-- themselves stay in R2), so it needs Anthony's explicit yes in writing.
-- =============================================================================

drop function if exists public.add_patient_file(bigint, text, text, text, integer);
drop function if exists public.remove_patient_file(bigint, text);
drop function if exists private.add_patient_file(bigint, text, text, text, integer);
drop function if exists private.remove_patient_file(bigint, text);

drop table if exists public.patient_files;

alter table public.patients drop constraint if exists patients_details_or_old_file;
alter table public.patients alter column date_of_birth set not null;
alter table public.patients alter column sex set not null;
alter table public.patients drop column if exists from_old_file;
