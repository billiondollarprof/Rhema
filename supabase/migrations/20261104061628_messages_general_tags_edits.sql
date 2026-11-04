-- =============================================================================
-- messages_general_tags_edits: a General chat for everybody, tagging a
-- person in a message, and changing your own message for 15 minutes.
--
-- Why: requests 142 and 144 (Anthony, 2026-11-04).
--   "there should be a general chat that everybody in the hospital sees."
--   "if the sender's colleagues are also front desk they should also see
--   it... each person's message must carry their name on it." (So a room
--   still sees what its people send, as before.)
--   "reply goes to the office, so any matron in that office during that
--   shift sees it but if you want to be specific, a person can be tagged by
--   mentioning their name or clicking and holding their own previous chat
--   so they know the message is for them."
--   Editing: "yes go with your plan": your own message, for 15 minutes, it
--   shows "edited", and the old wording is kept.
--
-- Rules:
--   - General: to_everyone is true, with no room kind and no room. Every
--     active member of staff reads it.
--   - A tag (mention_staff) names one person who can read the conversation.
--     A reply (reply_to) to somebody else's message tags them by itself.
--   - Only the sender changes a message, and only for 15 minutes after
--     sending. The old wording goes in message_edits, which nobody reads
--     from the app; each change is in the activity log.
--   - The old four part send_message still works, so messages waiting on a
--     device from before this change still send.
--
-- Never: let anybody read a message the rules above do not give them, or
-- change somebody else's message.
-- =============================================================================


-- ===== 1. New columns on messages =====
alter table public.messages alter column to_kind drop not null;
alter table public.messages
  add column to_everyone   boolean not null default false,
  add column reply_to      bigint references public.messages (id) on delete set null,
  add column mention_staff uuid references public.staff (id),
  add column edited_at     timestamptz;

-- General has no room kind and no room; everything else has a room kind.
alter table public.messages add constraint messages_target_shape check (
  (to_everyone and to_kind is null and to_room_id is null)
  or (not to_everyone and to_kind is not null)
);

create index messages_everyone_idx on public.messages (created_at desc) where to_everyone;
create index messages_mention_idx  on public.messages (mention_staff) where mention_staff is not null;
create index messages_reply_idx    on public.messages (reply_to) where reply_to is not null;


-- ===== 2. The old wording of a changed message =====
create table public.message_edits (
  id          bigint generated always as identity primary key,
  message_id  bigint not null references public.messages (id) on delete cascade,
  old_body    text not null,
  edited_by   uuid not null references public.staff (id),
  edited_at   timestamptz not null default now()
);

create index message_edits_message_idx on public.message_edits (message_id);
create index message_edits_staff_idx   on public.message_edits (edited_by);

-- Supabase gives every new table full rights. Take them all away. Nobody
-- reads this table from the app; only the edit function writes to it.
revoke all on public.message_edits from anon, authenticated;
alter table public.message_edits enable row level security;

create trigger message_edits_activity
  after insert on public.message_edits
  for each row execute function private.write_activity();


-- ===== 3. Who reads a message: General is read by everybody =====
-- Same as before, plus: a message with no room kind is General.
create or replace function private.can_read_message(sender uuid, from_room bigint, kind public.room_kind, to_room bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_staff() and (
    kind is null
    or sender = (select auth.uid())
    or from_room = private.my_room()
    or private.is_called(kind, to_room)
  )
$$;


-- ===== 4. Send, with General, a reply and a tag =====
-- Answers the message's id (the same id for the same key again).
create function private.send_message_to(
  to_kind public.room_kind, to_room bigint, to_everyone boolean,
  body text, client_key uuid, reply_to bigint, mention uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
-- The settings share names with columns (reply_to, to_everyone): inside
-- this function those names mean the settings. Columns are written m.name.
#variable_conflict use_variable
declare
  my_room bigint := private.my_room();
  tagged uuid := mention;
  earlier bigint;
  new_message bigint;
begin
  if not private.is_active_staff() then
    raise exception 'Only active staff can send messages' using errcode = '42501';
  end if;
  if my_room is null then
    raise exception 'Choose your room first' using errcode = '22023';
  end if;

  -- a. Where it goes.
  if to_everyone then
    if to_kind is not null or to_room is not null then
      raise exception 'General goes to everybody, not to a room' using errcode = '22023';
    end if;
  else
    if to_kind is null then
      raise exception 'Choose where the message goes' using errcode = '22023';
    end if;
    if to_room is not null and not exists (
      select 1 from public.rooms where id = to_room and kind = to_kind and is_active
    ) then
      raise exception 'That room cannot get messages' using errcode = '22023';
    end if;
    if to_room = my_room then
      raise exception 'You cannot message your own room' using errcode = '22023';
    end if;
  end if;

  -- b. A reply: to a message this person may read. It tags its sender.
  if reply_to is not null then
    if not exists (
      select 1 from public.messages m
      where m.id = reply_to
        and private.can_read_message(m.sent_by, m.from_room_id, m.to_kind, m.to_room_id)
    ) then
      raise exception 'That message cannot be replied to' using errcode = '22023';
    end if;
    if tagged is null then
      select nullif(m.sent_by, (select auth.uid())) into tagged
      from public.messages m where m.id = reply_to;
    end if;
  end if;

  -- c. A tag: an active person who can read this conversation.
  if tagged is not null and not exists (
    select 1
    from public.staff s
    left join public.rooms r on r.id = s.room_id
    where s.id = tagged
      and s.is_active
      and (
        to_everyone
        or (to_room is not null and s.room_id = to_room)
        or (to_room is null and r.kind = to_kind)
      )
  ) then
    raise exception 'That person cannot see this conversation' using errcode = '22023';
  end if;

  -- d. Once per key, even for two taps at the same moment.
  perform pg_advisory_xact_lock(hashtext('message:' || client_key::text));
  select id into earlier from public.messages m where m.client_key = send_message_to.client_key;
  if earlier is not null then
    return earlier;
  end if;
  insert into public.messages (from_room_id, to_kind, to_room_id, to_everyone, body, client_key,
                               reply_to, mention_staff)
  values (my_room, to_kind, to_room, to_everyone, trim(body), client_key, reply_to, tagged)
  returning id into new_message;
  return new_message;
end;
$$;

-- The old four part door keeps working: a room or a group, no tag.
create or replace function private.send_message(
  to_kind public.room_kind, to_room bigint, body text, client_key uuid
)
returns bigint
language sql
security definer
set search_path = ''
as $$ select private.send_message_to(to_kind, to_room, false, body, client_key, null, null) $$;


-- ===== 5. Change your own message, for 15 minutes =====
-- Answers 'edited', or 'same' when the wording did not change.
create function private.edit_message(message bigint, body text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.messages;
  new_body text := trim(coalesce(body, ''));
begin
  if not private.is_active_staff() then
    raise exception 'Only active staff can change messages' using errcode = '42501';
  end if;
  -- Two taps at the same moment wait here for each other.
  select * into found from public.messages where id = message for update;
  if found.id is null or found.sent_by <> (select auth.uid()) then
    raise exception 'You can only change your own messages' using errcode = '42501';
  end if;
  if found.created_at < now() - interval '15 minutes' then
    raise exception 'A message can be changed for 15 minutes after sending' using errcode = '22023';
  end if;
  if length(new_body) not between 1 and 2000 then
    raise exception 'Type the message' using errcode = '22023';
  end if;
  if new_body = found.body then
    return 'same';
  end if;
  insert into public.message_edits (message_id, old_body, edited_by)
  values (found.id, found.body, (select auth.uid()));
  update public.messages set body = new_body, edited_at = now() where id = found.id;
  return 'edited';
end;
$$;


-- ===== 6. The doors the app calls, and who may call them =====
revoke execute on function private.send_message_to(public.room_kind, bigint, boolean, text, uuid, bigint, uuid) from public, anon;
revoke execute on function private.edit_message(bigint, text) from public, anon;
grant  execute on function private.send_message_to(public.room_kind, bigint, boolean, text, uuid, bigint, uuid) to authenticated;
grant  execute on function private.edit_message(bigint, text) to authenticated;

create function public.send_message_to(
  to_kind public.room_kind, to_room bigint, to_everyone boolean,
  body text, client_key uuid, reply_to bigint, mention uuid
)
returns bigint language sql security invoker set search_path = ''
as $$ select private.send_message_to(to_kind, to_room, to_everyone, body, client_key, reply_to, mention) $$;

create function public.edit_message(message bigint, body text)
returns text language sql security invoker set search_path = ''
as $$ select private.edit_message(message, body) $$;

revoke execute on function public.send_message_to(public.room_kind, bigint, boolean, text, uuid, bigint, uuid) from public, anon;
revoke execute on function public.edit_message(bigint, text) from public, anon;
grant  execute on function public.send_message_to(public.room_kind, bigint, boolean, text, uuid, bigint, uuid) to authenticated;
grant  execute on function public.edit_message(bigint, text) to authenticated;
