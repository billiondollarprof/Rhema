-- =============================================================================
-- 20261110130716_old_file_without_phone.sql
--
-- What this is: a patient registered from an old file may now have no phone
-- number, as well as no date of birth and no sex. Only the name is needed.
--
-- Why: Anthony, 2026-11-10: "in the register from old file section, allow
-- them to submit even without date of birth or phone number... Name of
-- patient is enough, the rest says (optional), including the attachment of
-- file. But for the new patients, it is needed."
--
-- Rules:
--   - A patient who is NOT from an old file still needs a date of birth and
--     a sex, exactly as before.
--   - A phone number, when there is one, still has to be 11 digits (the
--     check on the column is untouched).
--   - Nothing is added, nothing is removed from the data. One rule on the
--     patients table is replaced by a looser one.
--
-- Never: let a new patient be saved without a date of birth and a sex.
-- =============================================================================


-- ===== 1. The rule on patients =====

-- Before: no date of birth or sex was allowed only for an old file patient
-- who had a phone number. Now an old file patient needs nothing more.
alter table public.patients drop constraint patients_details_or_old_file;
alter table public.patients
  add constraint patients_details_or_old_file check (
    (date_of_birth is not null and sex is not null)
    or from_old_file
  );
