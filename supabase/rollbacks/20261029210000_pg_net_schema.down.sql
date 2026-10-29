-- =============================================================================
-- Undo for 20261029210000_pg_net_schema.sql
--
-- Nothing to put back on purpose: moving pg_net's label back into "public"
-- would bring the security warning back. The alert trigger works the same
-- either way, because pg_net's working parts live in the "net" schema.
-- =============================================================================

select 1;
