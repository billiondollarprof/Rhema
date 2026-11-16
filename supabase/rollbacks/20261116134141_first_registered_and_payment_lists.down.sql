-- =============================================================================
-- Undo for first_registered_and_payment_lists.sql
--
-- Removes the two read rules and the month column. Dropping the column loses
-- the months typed on Register from old file, so on live this needs
-- Anthony's explicit yes in writing.
-- =============================================================================

drop policy if exists pick_options_read_lab_tests_for_payment on public.pick_options;
drop policy if exists medicine_list_read_for_payment on public.medicine_list;
alter table public.patients drop column if exists first_registered_on;
