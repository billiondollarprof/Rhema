-- Undo messages_general_tags_edits: no General chat, no tags, no edits.
-- General messages are removed first, because the old shape cannot hold them.

drop function if exists public.edit_message(bigint, text);
drop function if exists public.send_message_to(public.room_kind, bigint, boolean, text, uuid, bigint, uuid);
drop function if exists private.edit_message(bigint, text);

create or replace function private.send_message(
  to_kind public.room_kind, to_room bigint, body text, client_key uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_room bigint := private.my_room();
  earlier bigint;
  new_message bigint;
begin
  if not private.is_active_staff() then
    raise exception 'Only active staff can send messages' using errcode = '42501';
  end if;
  if my_room is null then
    raise exception 'Choose your room first' using errcode = '22023';
  end if;
  if to_room is not null and not exists (
    select 1 from public.rooms where id = to_room and kind = to_kind and is_active
  ) then
    raise exception 'That room cannot get messages' using errcode = '22023';
  end if;
  if to_room = my_room then
    raise exception 'You cannot message your own room' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('message:' || client_key::text));
  select id into earlier from public.messages m where m.client_key = send_message.client_key;
  if earlier is not null then
    return earlier;
  end if;
  insert into public.messages (from_room_id, to_kind, to_room_id, body, client_key)
  values (my_room, to_kind, to_room, trim(body), client_key)
  returning id into new_message;
  return new_message;
end;
$$;

drop function if exists private.send_message_to(public.room_kind, bigint, boolean, text, uuid, bigint, uuid);

create or replace function private.can_read_message(sender uuid, from_room bigint, kind public.room_kind, to_room bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_staff() and (
    sender = (select auth.uid())
    or from_room = private.my_room()
    or private.is_called(kind, to_room)
  )
$$;

drop table if exists public.message_edits;

delete from public.messages where to_everyone;
alter table public.messages drop constraint if exists messages_target_shape;
drop index if exists public.messages_everyone_idx;
drop index if exists public.messages_mention_idx;
drop index if exists public.messages_reply_idx;
alter table public.messages
  drop column if exists edited_at,
  drop column if exists mention_staff,
  drop column if exists reply_to,
  drop column if exists to_everyone;
alter table public.messages alter column to_kind set not null;
