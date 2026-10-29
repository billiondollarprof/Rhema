-- =============================================================================
-- Undo for 20261029190000_attention_calls_rights.sql
--
-- Nothing to put back on purpose: giving the extra rights back would open a
-- hole. Reading stays granted, exactly as before this file.
-- =============================================================================

grant select on public.attention_calls to authenticated;
