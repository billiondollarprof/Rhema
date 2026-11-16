-- =============================================================================
-- Undo for 20261116125814_lab_prices_and_saved_choices.sql
--
-- Removes the price proposals and the words added inside lab tests. Prices
-- already made standard stay in price_list. On live this loses the waiting
-- proposals and the added words, so it needs Anthony's explicit yes in writing.
-- =============================================================================

drop function if exists public.add_lab_choice(text, text, text);
drop function if exists private.add_lab_choice(text, text, text);
drop table if exists public.lab_field_choices;
drop function if exists public.save_pick_option_for_everybody(text, text);
drop function if exists private.save_pick_option_for_everybody(text, text);
drop function if exists private.apply_due_prices();
drop function if exists public.decide_price(bigint, boolean);
drop function if exists private.decide_price(bigint, boolean);
drop function if exists public.propose_price(text, numeric);
drop function if exists private.propose_price(text, numeric);
drop function if exists private.make_price_standard(bigint, text, uuid);
drop table if exists public.price_changes;
