-- =============================================================================
-- Undo 20261118211434_antenatal_registration_details.sql: removes the eight
-- antenatal details. WARNING: what was typed in them is lost.
-- =============================================================================

alter table public.patients
  drop column if exists marital_status,
  drop column if exists religion,
  drop column if exists education_level,
  drop column if exists occupation,
  drop column if exists next_of_kin_occupation,
  drop column if exists next_of_kin_religion,
  drop column if exists next_of_kin_education_level,
  drop column if exists next_of_kin_age;
