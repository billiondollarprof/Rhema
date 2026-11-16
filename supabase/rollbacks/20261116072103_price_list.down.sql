-- =============================================================================
-- Undo for 20261116072103_price_list.sql
--
-- Removes the price list and set_price. The prices the admin typed are lost,
-- so on live this needs Anthony's explicit yes in writing.
-- =============================================================================

drop function if exists public.set_price(text, text, numeric);
drop function if exists private.set_price(text, text, numeric);
drop table if exists public.price_list;
