-- =============================================================================
-- Undo 20261119011959_antenatal_details_into_booking.sql: removes the two
-- Front Desk functions and puts back the eight (empty) patient columns.
-- What the Front Desk saved stays in the antenatal booking.
-- =============================================================================

drop function if exists public.save_antenatal_details(bigint, jsonb);
drop function if exists public.antenatal_details(bigint);
drop function if exists private.save_antenatal_details(bigint, jsonb);
drop function if exists private.antenatal_details(bigint);
drop function if exists private.may_fill_antenatal(bigint);

alter table public.patients
  add column if not exists marital_status       text check (char_length(marital_status) <= 80),
  add column if not exists religion             text check (char_length(religion) <= 80),
  add column if not exists education_level      text check (char_length(education_level) <= 80),
  add column if not exists occupation           text check (char_length(occupation) <= 80),
  add column if not exists next_of_kin_occupation      text check (char_length(next_of_kin_occupation) <= 80),
  add column if not exists next_of_kin_religion        text check (char_length(next_of_kin_religion) <= 80),
  add column if not exists next_of_kin_education_level text check (char_length(next_of_kin_education_level) <= 80),
  add column if not exists next_of_kin_age             smallint check (next_of_kin_age between 0 and 130);
grant update (marital_status, religion, education_level, occupation,
              next_of_kin_occupation, next_of_kin_religion,
              next_of_kin_education_level, next_of_kin_age)
  on public.patients to authenticated;
