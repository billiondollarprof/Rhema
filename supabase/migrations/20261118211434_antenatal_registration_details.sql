-- =============================================================================
-- 20261118211434_antenatal_registration_details.sql
--
-- What this is: the extra details the antenatal card asks for, kept on the
-- patient: marital status, religion, level of education and occupation;
-- and for the next of kin (usually the husband): occupation, religion,
-- level of education and age.
--
-- Why: Anthony, 2026-11-18 (request 227g): the Front Desk said antenatal
-- registration has details "that are different that antenatal used to
-- enter, that others don't used to enter... once they toggle antenatal,
-- those extra information can populate." His yes to all, the same day.
--
-- Rules:
--   - All optional, plain short text (at most 80 letters), empty for
--     everybody else.
--   - Written like the rest of the patient's details: on registration, and
--     changed only by the Front Desk (the existing patients_update rule).
--   - Read by whoever already reads the patient's details. No new reader.
--
-- Never: make any of these required, or show them anywhere but the
-- patient's details and their edit form.
-- =============================================================================


-- ===== 1. The columns =====
alter table public.patients
  add column marital_status       text check (char_length(marital_status) <= 80),
  add column religion             text check (char_length(religion) <= 80),
  add column education_level      text check (char_length(education_level) <= 80),
  add column occupation           text check (char_length(occupation) <= 80),
  add column next_of_kin_occupation      text check (char_length(next_of_kin_occupation) <= 80),
  add column next_of_kin_religion        text check (char_length(next_of_kin_religion) <= 80),
  add column next_of_kin_education_level text check (char_length(next_of_kin_education_level) <= 80),
  add column next_of_kin_age             smallint check (next_of_kin_age between 0 and 130);


-- ===== 2. Changed like the other details (the Front Desk only, by RLS) =====
grant update (marital_status, religion, education_level, occupation,
              next_of_kin_occupation, next_of_kin_religion,
              next_of_kin_education_level, next_of_kin_age)
  on public.patients to authenticated;
