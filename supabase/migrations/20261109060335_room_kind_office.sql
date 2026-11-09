-- =============================================================================
-- 20261109060335_room_kind_office.sql
--
-- What this is: a new kind of room, "office", for the admin's own room.
--
-- Why: Anthony, 2026-11-08: "Everyone should have a room, including the
-- admin." Messages go from room to room, so somebody with no room cannot
-- send or receive any. He chose option A (2026-11-09): every member of
-- staff has a room, and admins get an Admin Office.
--
-- Rules:
--   - Only adds a value. Nothing that exists changes.
--   - Postgres lets a new value be used only after this file is saved, so
--     the room itself is added by the next migration.
--
-- Never: rename or remove a kind that rooms already use.
-- =============================================================================

alter type public.room_kind add value if not exists 'office';
