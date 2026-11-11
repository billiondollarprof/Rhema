-- =============================================================================
-- Undo for 20261111160643_vital_extras.sql
--
-- Removes the "Other" vital sign readings, the measures and the function.
-- Every reading in them is lost, so only before they have been used. The
-- ordinary vital signs are not touched.
-- =============================================================================

drop table if exists public.vital_extras;
drop function if exists public.use_vital_measure(text, text);
drop function if exists private.use_vital_measure(text, text);
-- The read rule on measures looks at the users table, so it goes first.
drop policy if exists vital_measures_read on public.vital_measures;
drop table if exists public.vital_measure_users;
drop table if exists public.vital_measures;
drop function if exists private.vital_key(text);
