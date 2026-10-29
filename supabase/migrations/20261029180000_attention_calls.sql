-- =============================================================================
-- 20261029180000_attention_calls.sql
--
-- What this is: "Call attention". One row each time somebody taps a room in
-- the bell list: who called, from which room, which room or group they
-- called, and when. The app listens for new rows and rings the bell on the
-- screens of whoever is on duty there.
--
-- Why: Anthony, 2026-10-29. The call goes to a ROOM, never to a person.
--   - Front Desk, Nursing Station, Laboratory and Pharmacy are groups. They
--     share one computer, so one tap rings everyone on duty there. Calling
--     "Nursing Station" rings every nursing station.
--   - Consultant and Matron open a second list of their rooms (Consultant
--     Room 1, 2, 3; each matron's office), and the call goes to that room.
--   - "Whoever is on duty in that room is who you need." A person who wants
--     one named colleague uses messages or the phone instead.
--
-- Who is "on duty there" (private.is_called):
--   1. staff whose room, set by the admin, is the room called; or
--   2. for a group call, staff whose room is any room of that kind; or
--   3. staff with no room set, whose role matches the kind of room called
--      (front desk, nurse to nursing, matron, pharmacy, laboratory).
--      Doctors are never matched this way: a doctor with no room is not on
--      duty in Consultant Room 2.
--
-- Rules:
--   - A call is always made in the caller's own name, through
--     call_attention(). Nobody can insert, change or delete a row directly.
--   - Only the caller and the people called can read a call.
--   - The same person calling the same place twice within 15 seconds is
--     taken as a double tap: the second tap sends nothing new.
--   - Nobody can call their own room.
--
-- Never: put a patient's name or anything clinical in a call. There is no
-- note field on purpose. A call says "come", nothing else.
-- =============================================================================


-- ===== 1. The table =====

create table public.attention_calls (
  id            bigint generated always as identity primary key,
  called_by     uuid not null references public.staff (id),
  -- The caller's room at the moment of the call. Null if they have none.
  from_room_id  bigint references public.rooms (id),
  -- The kind of room called, e.g. front_desk or consultation.
  to_kind       public.room_kind not null,
  -- The one room called. Null means every room of that kind (a group call).
  to_room_id    bigint references public.rooms (id),
  created_at    timestamptz not null default now()
);

create index attention_calls_time_idx   on public.attention_calls (created_at desc);
create index attention_calls_caller_idx on public.attention_calls (called_by, created_at desc);
create index attention_calls_room_idx   on public.attention_calls (to_room_id);
create index attention_calls_from_idx   on public.attention_calls (from_room_id);

alter table public.attention_calls enable row level security;


-- ===== 2. Is the signed in person one of the people called? =====

create function private.is_called(called_kind public.room_kind, called_room bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    left join public.rooms r on r.id = s.room_id
    where s.id = (select auth.uid())
      and s.is_active
      and (
        -- 1. Their room is the room called.
        (called_room is not null and s.room_id = called_room)
        -- 2. A group call, and their room is of that kind.
        or (called_room is null and r.kind = called_kind)
        -- 3. No room set, and their role matches the kind called.
        or (s.room_id is null and called_kind::text = case s.role::text
              when 'front_desk' then 'front_desk'
              when 'nurse'      then 'nursing'
              when 'matron'     then 'matron'
              when 'pharmacy'   then 'pharmacy'
              when 'laboratory' then 'laboratory'
            end)
      )
  );
$$;

revoke execute on function private.is_called(public.room_kind, bigint) from public, anon;
grant  execute on function private.is_called(public.room_kind, bigint) to authenticated;


-- ===== 3. Making a call =====
-- Returns 'sent', 'already_sent' (a double tap), or raises an error for a
-- call that makes no sense (a closed room, the wrong kind, your own room).

create function private.call_attention(called_kind public.room_kind, called_room bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_room bigint;
begin
  if not (select private.is_active_staff()) then
    raise exception 'Only active staff can call attention' using errcode = '42501';
  end if;

  select room_id into caller_room from public.staff where id = (select auth.uid());

  if called_room is not null then
    if not exists (
      select 1 from public.rooms
      where id = called_room and kind = called_kind and is_active
    ) then
      raise exception 'That room cannot be called' using errcode = '22023';
    end if;
    if called_room = caller_room then
      raise exception 'You cannot call your own room' using errcode = '22023';
    end if;
  elsif exists (select 1 from public.rooms where id = caller_room and kind = called_kind) then
    -- A group call to your own group, e.g. Nursing Station 1 calling
    -- "Nursing Station", would ring your own screen.
    raise exception 'You cannot call your own room' using errcode = '22023';
  end if;

  -- A double tap: the same caller, the same place, in the last 15 seconds.
  if exists (
    select 1 from public.attention_calls
    where called_by = (select auth.uid())
      and to_kind = called_kind
      and to_room_id is not distinct from called_room
      and created_at > now() - interval '15 seconds'
  ) then
    return 'already_sent';
  end if;

  insert into public.attention_calls (called_by, from_room_id, to_kind, to_room_id)
  values ((select auth.uid()), caller_room, called_kind, called_room);
  return 'sent';
end;
$$;

revoke execute on function private.call_attention(public.room_kind, bigint) from public, anon;
grant  execute on function private.call_attention(public.room_kind, bigint) to authenticated;

-- The app calls this one. It runs as the person signed in, and hands over
-- to the private function above, so the security advisor has nothing to flag.
create function public.call_attention(called_kind public.room_kind, called_room bigint default null)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.call_attention(called_kind, called_room);
$$;

revoke execute on function public.call_attention(public.room_kind, bigint) from public, anon;
grant  execute on function public.call_attention(public.room_kind, bigint) to authenticated;


-- ===== 4. Who can read a call =====
-- Reading only. There is no insert, update or delete grant: calls are made
-- through call_attention() and are never changed afterwards.

grant select on public.attention_calls to authenticated;

create policy attention_calls_read on public.attention_calls
  for select to authenticated
  using (
    called_by = (select auth.uid())
    or (select private.is_called(to_kind, to_room_id))
  );


-- ===== 5. The activity log, and live updates =====

create trigger attention_calls_activity
  after insert on public.attention_calls
  for each row execute function private.write_activity();

-- Live updates: Supabase sends each new row to the screens allowed to read
-- it (the policy above decides). The local test database has no live
-- updates, so this step only runs where they exist.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.attention_calls;
  end if;
end $$;
