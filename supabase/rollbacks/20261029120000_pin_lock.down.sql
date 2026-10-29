-- =============================================================================
-- Undo for 20261029120000_pin_lock.sql
--
-- Removes the PIN functions. Leaves pgcrypto in place, because Supabase
-- ships it and other things may use it. Stored PINs stay in the staff
-- table (the columns belong to the foundation), they just cannot be used.
-- =============================================================================

drop function if exists public.i_have_a_pin();
drop function if exists private.i_have_a_pin();
drop function if exists public.check_my_pin(text);
drop function if exists public.set_my_pin(text);
drop function if exists private.check_my_pin(text);
drop function if exists private.set_my_pin(text);
