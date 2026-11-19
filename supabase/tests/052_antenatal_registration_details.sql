-- =============================================================================
-- tests for antenatal_registration_details (request 227g).
--
-- The eight patient columns that migration added were a copy of what the
-- antenatal booking already keeps, and were removed by
-- 20261119011959_antenatal_details_into_booking (Anthony's yes, 2026-11-19).
-- What this proves now: none of them is left on the patient. The details
-- themselves are tested in 053.
--
-- Runs inside one transaction that is rolled back.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients'
      and column_name in ('marital_status', 'religion', 'education_level', 'occupation',
        'next_of_kin_occupation', 'next_of_kin_religion', 'next_of_kin_education_level',
        'next_of_kin_age')
  ) then
    raise exception 'FAIL 1: a copied antenatal column is still on the patient';
  end if;
end $$;
\echo 'PASS 1: no copied antenatal column left on the patient'

rollback;
