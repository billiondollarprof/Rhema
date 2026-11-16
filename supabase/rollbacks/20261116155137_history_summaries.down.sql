-- =============================================================================
-- Undo for 20261116155137_history_summaries.sql
--
-- Removes the four read only History functions. Nothing is stored by them,
-- so nothing is lost.
-- =============================================================================

drop function if exists public.my_summary(timestamptz, timestamptz);
drop function if exists public.pharmacy_summary(timestamptz, timestamptz);
drop function if exists public.lab_summary(timestamptz, timestamptz);
drop function if exists public.money_summary(timestamptz, timestamptz, boolean);
drop function if exists private.my_summary(timestamptz, timestamptz);
drop function if exists private.pharmacy_summary(timestamptz, timestamptz);
drop function if exists private.lab_summary(timestamptz, timestamptz);
drop function if exists private.money_summary(timestamptz, timestamptz, boolean);
drop function if exists private.check_period(timestamptz, timestamptz);
