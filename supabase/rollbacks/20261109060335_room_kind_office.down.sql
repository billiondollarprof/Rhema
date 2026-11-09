-- Undo for 20261109060335_room_kind_office.sql. Postgres cannot take a value
-- out of a type. The value stays, unused once the Admin Office room is gone
-- (see the undo for 20261109060336_admin_office_room.sql). Nothing to run.
select 1;
