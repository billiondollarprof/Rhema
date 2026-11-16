-- =============================================================================
-- first_registered_and_payment_lists.sql
--
-- What this is, two parts:
--   1. The month an old file was first opened at the hospital, kept on the
--      patient (first_registered_on, the 1st of that month).
--   2. The Front Desk may READ the standard medicine list and the standard
--      lab tests the hospital added, to pick what a payment is for.
--
-- Why: Anthony, 2026-11-16 (request 211): "for older patients, please add a
-- month picker because they're registering the patients month by month"
-- and "when a patient was registered first should also show". And: "when
-- they choose payment for pharmacy or lab, they should also have a picker to
-- select what particular test or medication... for rush hour where the
-- doctor may not have time to reach for the computer to request for test."
--
-- Rules:
--   - The month is optional, never in the future, and not before 1950.
--   - The Front Desk reads only standard, active medicine lines and standard
--     lab tests: names, no patient. It still writes neither list.
--
-- Never: let the Front Desk see a medicine line somebody typed that is still
-- waiting for the Pharmacy, or anything about a patient through these lists.
-- =============================================================================


-- ===== 1. The month an old file was first opened =====
alter table public.patients
  add column first_registered_on date
  check (first_registered_on is null
         or (first_registered_on >= date '1950-01-01' and first_registered_on <= current_date));


-- ===== 2. The Front Desk reads the standard lists, to pick from =====
create policy medicine_list_read_for_payment on public.medicine_list
  for select to authenticated
  using ((select private.can_take_payment()) and status = 'standard' and is_active);

create policy pick_options_read_lab_tests_for_payment on public.pick_options
  for select to authenticated
  using ((select private.can_take_payment()) and list = 'lab_test' and standard);
