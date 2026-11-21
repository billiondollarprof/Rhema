-- =============================================================================
-- Undo 20261120162058_record_copy_own_room_7_days.sql: the device copy goes
-- back to copy_open_visits (every open visit) once the screens call it again.
-- =============================================================================

drop function public.copy_room_visits();
drop function private.copy_room_visits();
