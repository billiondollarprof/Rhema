-- =============================================================================
-- 20261109060336_admin_office_room.sql
--
-- What this is: the Admin Office room, so the admin has a room like
-- everybody else, and can send and receive messages.
--
-- Why: Anthony, 2026-11-09, option A: "A is okay." Every member of staff has
-- a room; admins get an Admin Office. Each person sees General and their
-- own room's messages, the admin included (no extra reading rights).
--
-- Rules:
--   - One row, added only if no room has that name yet, so running it twice
--     changes nothing.
--   - The admin can rename it or add more offices in Admin, Rooms.
--
-- Never: give the office any rights. A room is a place, not a permission.
-- =============================================================================

insert into public.rooms (name, kind)
select 'Admin Office', 'office'
where not exists (select 1 from public.rooms where name = 'Admin Office');
