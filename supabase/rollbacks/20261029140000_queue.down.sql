-- =============================================================================
-- Undo for 20261029140000_queue.sql
--
-- Removes the queue table and its status list. Only before real patients
-- exist: on the live database this would lose the queue history, so it
-- needs Anthony's explicit yes in writing.
-- =============================================================================

drop function if exists public.patients_seen(text);
drop table if exists public.queue_entries;
drop type if exists public.queue_status;
