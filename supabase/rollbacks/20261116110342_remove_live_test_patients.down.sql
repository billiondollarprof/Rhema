-- =============================================================================
-- Undo for remove_live_test_patients.sql
--
-- There is no undo in SQL: the deleted rows are gone. If they are ever needed,
-- they are in the live backup of 2026-11-16 08:00 UTC (backup.yml). This file
-- does nothing on purpose, so the undo and redo check still runs.
-- =============================================================================

select 1;
