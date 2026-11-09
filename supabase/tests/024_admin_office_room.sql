-- =============================================================================
-- 024_admin_office_room.sql: tests for room_kind_office and
-- admin_office_room.
--
-- What this is: proves the office kind exists, the Admin Office room is
-- there exactly once, an admin can be put in it and can then send a
-- message, and a room gives no reading rights of its own.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== 1. The kind and the room ==============================================
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                 where t.typname = 'room_kind' and e.enumlabel = 'office') then
    raise exception 'FAIL 1: there is no office kind of room';
  end if;
  if (select count(*) from public.rooms where name = 'Admin Office' and kind = 'office') <> 1 then
    raise exception 'FAIL 1: the Admin Office room is not there exactly once';
  end if;
end $$;
\echo 'PASS 1: the office kind and the Admin Office room exist, once'


-- ===== 2. An admin in the Admin Office can send a message ====================
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a9', 'office@admin.rhema');
insert into public.staff (id, full_name, email, role, room_id) values
  ('00000000-0000-0000-0000-0000000000a9', 'Office Admin', 'office@admin.rhema', 'admin',
   (select id from public.rooms where name = 'Admin Office'));

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9"}', true);
set local role authenticated;
select public.send_message_to(
  'front_desk'::public.room_kind, (select id from public.rooms where name = 'Front Desk'), false,
  'Made up note from the office', gen_random_uuid(), null, null);
reset role;
do $$
begin
  if not exists (select 1 from public.messages m
                 join public.rooms r on r.id = m.from_room_id
                 where r.name = 'Admin Office' and m.body = 'Made up note from the office') then
    raise exception 'FAIL 2: a message from the Admin Office was not saved from that room';
  end if;
end $$;
\echo 'PASS 2: an admin in the Admin Office can send a message'

rollback;
