-- =============================================================================
-- Undo for 20261116201525_download_our_data.sql
--
-- Removes the two download functions. Nothing is stored by them except the
-- activity log lines, which stay.
-- =============================================================================

drop function if exists public.export_may_read(text);
drop function if exists public.export_everything(text);
drop function if exists private.export_may_read(text);
drop function if exists private.export_everything(text);
