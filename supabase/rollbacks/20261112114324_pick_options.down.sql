-- =============================================================================
-- Undo for 20261112114324_pick_options.sql
--
-- Removes the pick lists and the lines people typed. Records are not touched:
-- what was saved on them is the words, kept on the record itself.
-- =============================================================================

drop function if exists public.forget_pick_option(text, text);
drop function if exists public.use_pick_option(text, text);
drop function if exists private.forget_pick_option(text, text);
drop function if exists private.use_pick_option(text, text);
-- The read rule on the options looks at the users table, so it goes first.
drop policy if exists pick_options_read on public.pick_options;
drop table if exists public.pick_option_users;
drop table if exists public.pick_options;
