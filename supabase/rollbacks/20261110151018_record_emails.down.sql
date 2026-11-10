-- =============================================================================
-- Undo for 20261110151018_record_emails.sql
--
-- Removes the list of record emails. The list is lost, but each send is also
-- in the activity log, which stays. Only needed if the feature is taken out.
-- =============================================================================

drop table if exists public.record_emails;
