-- Undo for 20261109060336_admin_office_room.sql: takes the Admin Office
-- away, only while nobody is in it and no message or call names it.
delete from public.rooms r
where r.name = 'Admin Office' and r.kind = 'office'
  and not exists (select 1 from public.staff s where s.room_id = r.id);
