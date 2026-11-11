-- =============================================================================
-- Undo for 20261111160406_medicine_list.sql
--
-- Removes the medicine list and its functions. Anything the Pharmacy typed in
-- is lost, so only before the hospital has used it. Prescriptions and
-- medicines already written on records keep their own words.
-- =============================================================================

drop function if exists public.confirm_starter_medicines();
drop function if exists public.confirm_medicine(bigint);
drop function if exists public.add_medicine(text, text, text);
drop function if exists private.confirm_starter_medicines();
drop function if exists private.confirm_medicine(bigint);
drop function if exists private.add_medicine(text, text, text);
drop table if exists public.medicine_list;
drop function if exists private.can_see_medicines();
drop function if exists private.is_pharmacist();
