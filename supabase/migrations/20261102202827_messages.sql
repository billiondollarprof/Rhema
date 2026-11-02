-- =============================================================================
-- messages: room to room messages with read ticks, announcements, and a
-- one year limit (request 123: "messages, notification, announcements").
--
-- Why: Anthony, 2026-11-02: "messages should... send from a room to a
-- room... from front desk to lab, from lab to pharmacy, you know, just the
-- way you also call attention... matron one, matron two... by office or by
-- room"; groups too. "Let it just be a normal message that they can just
-- type." Ticks like WhatsApp: one tick sent, two ticks read; for a group,
-- two ticks when everyone has read. Kept 1 year (his choice, 2026-11-02),
-- then deleted.
--
-- Rules:
--   - A message is from the sender's room to one room, or to every room of
--     a kind (a group), exactly like Call attention (private.is_called).
--   - Who can read: the sender, everybody now in the sending room, and
--     everybody the message is for.
--   - A message sent twice (a double tap, or a resend after no network)
--     is saved once: each carries a key made on the device.
--   - Announcements: only staff with the Announce permission send them;
--     every active staff member reads them; they show on Home until the
--     sender's date (7 days unless chosen).
--   - Messages, reads and announcements older than 1 year are deleted by
--     private.forget_old_messages(), run every night after the backup.
--
-- Never: let anybody read a room's messages who is not in it, or keep a
-- message more than a year.
-- =============================================================================


-- ===== 1. Messages =====

create table public.messages (
  id           bigint generated always as identity primary key,
  sent_by      uuid not null default auth.uid() references public.staff (id),
  from_room_id bigint not null references public.rooms (id),
  -- Like Call attention: the kind of room, and the one room (null = all of that kind).
  to_kind      public.room_kind not null,
  to_room_id   bigint references public.rooms (id),
  body         text not null check (length(trim(body)) between 1 and 2000),
  -- Made on the device; the same key twice is the same message.
  client_key   uuid not null unique,
  created_at   timestamptz not null default now()
);

create index messages_from_idx on public.messages (from_room_id, created_at desc);
create index messages_to_idx   on public.messages (to_room_id, created_at desc);
create index messages_kind_idx on public.messages (to_kind, created_at desc);
create index messages_sender_idx on public.messages (sent_by);

create table public.message_reads (
  message_id bigint not null references public.messages (id) on delete cascade,
  staff_id   uuid not null references public.staff (id),
  read_at    timestamptz not null default now(),
  primary key (message_id, staff_id)
);

create index message_reads_staff_idx on public.message_reads (staff_id);

revoke all on public.messages, public.message_reads from anon, authenticated;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
grant select on public.messages, public.message_reads to authenticated;

-- The signed in person's room right now.
create function private.my_room()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$ select room_id from public.staff where id = (select auth.uid()) and is_active $$;

revoke execute on function private.my_room() from public, anon;
grant  execute on function private.my_room() to authenticated;

create function private.can_read_message(sender uuid, from_room bigint, kind public.room_kind, to_room bigint)
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

revoke execute on function private.can_read_message(uuid, bigint, public.room_kind, bigint) from public, anon;
grant  execute on function private.can_read_message(uuid, bigint, public.room_kind, bigint) to authenticated;

create policy messages_read on public.messages
  for select to authenticated
  using (private.can_read_message(sent_by, from_room_id, to_kind, to_room_id));

create policy message_reads_read on public.message_reads
  for select to authenticated
  using (exists (
    select 1 from public.messages m
    where m.id = message_id
      and private.can_read_message(m.sent_by, m.from_room_id, m.to_kind, m.to_room_id)
  ));

create trigger messages_activity
  after insert on public.messages
  for each row execute function private.write_activity();


-- ===== 2. Send a message =====
-- Answers the message's id (the same id for the same key again).

create function private.send_message(
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


-- ===== 3. Mark messages read (two ticks) =====
-- Only messages this person may read and did not send. Answers how many.

create function private.mark_messages_read(ids bigint[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  marked integer;
begin
  insert into public.message_reads (message_id, staff_id)
  select m.id, auth.uid()
  from public.messages m
  where m.id = any (ids)
    and m.sent_by <> auth.uid()
    and private.can_read_message(m.sent_by, m.from_room_id, m.to_kind, m.to_room_id)
  on conflict do nothing;
  get diagnostics marked = row_count;
  return marked;
end;
$$;


-- ===== 4. Announcements =====

create table public.announcements (
  id          bigint generated always as identity primary key,
  sent_by     uuid not null default auth.uid() references public.staff (id),
  body        text not null check (length(trim(body)) between 1 and 2000),
  show_until  date not null default (current_date + 7),
  client_key  uuid not null unique,
  created_at  timestamptz not null default now()
);

create index announcements_time_idx on public.announcements (created_at desc);
create index announcements_sender_idx on public.announcements (sent_by);

create table public.announcement_reads (
  announcement_id bigint not null references public.announcements (id) on delete cascade,
  staff_id        uuid not null references public.staff (id),
  read_at         timestamptz not null default now(),
  primary key (announcement_id, staff_id)
);

create index announcement_reads_staff_idx on public.announcement_reads (staff_id);

revoke all on public.announcements, public.announcement_reads from anon, authenticated;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
grant select on public.announcements, public.announcement_reads to authenticated;

create policy announcements_read on public.announcements
  for select to authenticated
  using ((select private.is_active_staff()));

create policy announcement_reads_read on public.announcement_reads
  for select to authenticated
  using ((select private.is_active_staff()));

create trigger announcements_activity
  after insert on public.announcements
  for each row execute function private.write_activity();

create function private.send_announcement(body text, show_until date, client_key uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  earlier bigint;
  new_one bigint;
begin
  if not private.has_permission('announce') then
    raise exception 'Only staff with the Announce permission can announce' using errcode = '42501';
  end if;
  if show_until is not null and (show_until < current_date or show_until > current_date + 90) then
    raise exception 'Choose a date within the next 90 days' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('announcement:' || client_key::text));
  select id into earlier from public.announcements a where a.client_key = send_announcement.client_key;
  if earlier is not null then
    return earlier;
  end if;
  insert into public.announcements (body, show_until, client_key)
  values (trim(body), coalesce(show_until, current_date + 7), client_key)
  returning id into new_one;
  return new_one;
end;
$$;

create function private.mark_announcement_read(announcement bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.announcement_reads (announcement_id, staff_id)
  select a.id, auth.uid() from public.announcements a
  where a.id = announcement and private.is_active_staff()
  on conflict do nothing
$$;


-- ===== 5. One year, then deleted =====
-- Run every night by the backup job, after the backup is saved.

create function private.forget_old_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone integer;
  more integer;
begin
  delete from public.messages where created_at < now() - interval '1 year';
  get diagnostics gone = row_count;
  delete from public.announcements where created_at < now() - interval '1 year';
  get diagnostics more = row_count;
  return gone + more;
end;
$$;

revoke execute on function private.forget_old_messages() from public, anon, authenticated;


-- ===== 6. The doors the app calls, and who may call them =====

revoke execute on function private.send_message(public.room_kind, bigint, text, uuid) from public, anon;
revoke execute on function private.mark_messages_read(bigint[]) from public, anon;
revoke execute on function private.send_announcement(text, date, uuid) from public, anon;
revoke execute on function private.mark_announcement_read(bigint) from public, anon;
grant  execute on function private.send_message(public.room_kind, bigint, text, uuid) to authenticated;
grant  execute on function private.mark_messages_read(bigint[]) to authenticated;
grant  execute on function private.send_announcement(text, date, uuid) to authenticated;
grant  execute on function private.mark_announcement_read(bigint) to authenticated;

create function public.send_message(to_kind public.room_kind, to_room bigint, body text, client_key uuid)
returns bigint language sql security invoker set search_path = ''
as $$ select private.send_message(to_kind, to_room, body, client_key) $$;

create function public.mark_messages_read(ids bigint[])
returns integer language sql security invoker set search_path = ''
as $$ select private.mark_messages_read(ids) $$;

create function public.send_announcement(body text, show_until date, client_key uuid)
returns bigint language sql security invoker set search_path = ''
as $$ select private.send_announcement(body, show_until, client_key) $$;

create function public.mark_announcement_read(announcement bigint)
returns void language sql security invoker set search_path = ''
as $$ select private.mark_announcement_read(announcement) $$;

revoke execute on function public.send_message(public.room_kind, bigint, text, uuid) from public, anon;
revoke execute on function public.mark_messages_read(bigint[]) from public, anon;
revoke execute on function public.send_announcement(text, date, uuid) from public, anon;
revoke execute on function public.mark_announcement_read(bigint) from public, anon;
grant  execute on function public.send_message(public.room_kind, bigint, text, uuid) to authenticated;
grant  execute on function public.mark_messages_read(bigint[]) to authenticated;
grant  execute on function public.send_announcement(text, date, uuid) to authenticated;
grant  execute on function public.mark_announcement_read(bigint) to authenticated;


-- ===== 7. Live updates (where Supabase runs them) =====
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.message_reads, public.announcements;
  end if;
end $$;
