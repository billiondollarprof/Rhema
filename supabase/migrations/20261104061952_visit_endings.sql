-- =============================================================================
-- visit_endings: how a visit ends, at every room, and moving a patient who
-- is already in a room.
--
-- Why: requests 140 and 147 (Anthony, 2026-11-04). "When a patient is also
-- already in a room, you can't send the patient... to another room." "There's
-- no way for somebody to know that the patient left a particular room... a
-- patient who have been sent to consultant room 1 since 48 hours ago, it
-- will still be showing consultant room 1." He chose the recommendation:
--   1. Move to another room: the visit in the old room ends (with the time)
--      and a new one starts in the new room.
--   2. Has left: the Front Desk or an admin ends a visit, with the time.
--   3. Calling in the next patient ends the visit of the one before, in
--      the same room.
--   4. Every visit still open at the end of the day is ended by itself
--      (the nightly job, private.close_old_visits()).
-- Each ended visit says how it ended (finish_reason), so the patient's
-- visits read as a trail: where they were, from when to when.
--
-- Never: delete a visit. A visit only ever ends.
-- =============================================================================


-- ===== 1. How a visit ended =====
alter table public.queue_entries add column finish_reason text
  check (finish_reason in ('finished', 'moved', 'left', 'next_called', 'end_of_day'));

-- Visits ended before today were all ended by their room.
update public.queue_entries set finish_reason = 'finished'
 where status = 'done' and finish_reason is null;

alter table public.queue_entries add constraint queue_done_has_reason
  check ((status = 'done') = (finish_reason is not null));

create index queue_patient_time_idx on public.queue_entries (patient_id, created_at desc);


-- ===== 2. Ending a visit always stamps the time and the reason =====
-- The room's own button (Finish visit, Finished at the lab, Mark dispensed)
-- sets status done; this adds the time if missing and the reason.
create function private.stamp_visit_end()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.finished_at := coalesce(new.finished_at, now());
    new.finish_reason := coalesce(new.finish_reason, 'finished');
  elsif new.status <> 'done' then
    new.finish_reason := null;
  end if;
  return new;
end;
$$;

revoke execute on function private.stamp_visit_end() from public, anon, authenticated;

create trigger queue_stamp_end before insert or update on public.queue_entries
  for each row execute function private.stamp_visit_end();


-- ===== 3. Calling in the next patient ends the one before =====
-- Security definer: it ends another row in the same room, which the person
-- calling in may already change, but it must not depend on that.
create function private.end_previous_visit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'in_consultation' and old.status <> 'in_consultation' then
    update public.queue_entries
       set status = 'done', finished_at = now(), finish_reason = 'next_called'
     where room_id = new.room_id
       and status = 'in_consultation'
       and id <> new.id;
  end if;
  return new;
end;
$$;

revoke execute on function private.end_previous_visit() from public, anon, authenticated;

create trigger queue_end_previous after update on public.queue_entries
  for each row execute function private.end_previous_visit();


-- ===== 4. Move to another room =====
-- Answers the new visit's id. Tapped twice, it answers the same visit.
create function private.move_patient(entry bigint, room bigint, note text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.queue_entries;
  new_entry bigint;
begin
  if not private.has_permission('patients') then
    raise exception 'Only staff who send patients to rooms can move them' using errcode = '42501';
  end if;
  if not exists (select 1 from public.rooms where id = room and is_active) then
    raise exception 'No such room' using errcode = '22023';
  end if;
  select * into found from public.queue_entries where id = entry;
  if found.id is null then
    raise exception 'No such visit' using errcode = '22023';
  end if;
  -- Two taps at the same moment wait here for each other.
  perform pg_advisory_xact_lock(hashtext('move:' || found.patient_id::text));
  -- Already moved there (the second tap): answer that visit.
  select id into new_entry from public.queue_entries
   where patient_id = found.patient_id and status <> 'done' and room_id = room;
  if new_entry is not null then
    return new_entry;
  end if;
  update public.queue_entries
     set status = 'done', finished_at = now(), finish_reason = 'moved'
   where patient_id = found.patient_id and status <> 'done';
  insert into public.queue_entries (patient_id, room_id, status, note, sent_by)
  values (found.patient_id, room, 'waiting', nullif(trim(note), ''), (select auth.uid()))
  returning id into new_entry;
  return new_entry;
end;
$$;


-- ===== 5. Has left: the Front Desk or an admin ends a visit =====
-- Answers 'left', or 'already_ended'.
create function private.mark_left(entry bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended integer;
begin
  if not exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and (role = 'front_desk' or can_admin)
  ) then
    raise exception 'Only the Front Desk or an admin can mark that a patient has left' using errcode = '42501';
  end if;
  update public.queue_entries
     set status = 'done', finished_at = now(), finish_reason = 'left'
   where id = entry and status <> 'done';
  get diagnostics ended = row_count;
  return case when ended = 1 then 'left' else 'already_ended' end;
end;
$$;


-- ===== 6. The end of the day: every visit still open is ended =====
-- Run by the nightly job after the backup (backup.yml). Answers how many.
create function private.close_old_visits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended integer;
  today_started timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
begin
  update public.queue_entries
     set status = 'done', finished_at = now(), finish_reason = 'end_of_day'
   where status <> 'done' and created_at < today_started;
  get diagnostics ended = row_count;
  return ended;
end;
$$;

revoke execute on function private.close_old_visits() from public, anon, authenticated;


-- ===== 7. The doors the app calls, and who may call them =====
revoke execute on function private.move_patient(bigint, bigint, text) from public, anon;
revoke execute on function private.mark_left(bigint) from public, anon;
grant  execute on function private.move_patient(bigint, bigint, text) to authenticated;
grant  execute on function private.mark_left(bigint) to authenticated;

create function public.move_patient(entry bigint, room bigint, note text)
returns bigint language sql security invoker set search_path = ''
as $$ select private.move_patient(entry, room, note) $$;

create function public.mark_left(entry bigint)
returns text language sql security invoker set search_path = ''
as $$ select private.mark_left(entry) $$;

revoke execute on function public.move_patient(bigint, bigint, text) from public, anon;
revoke execute on function public.mark_left(bigint) from public, anon;
grant  execute on function public.move_patient(bigint, bigint, text) to authenticated;
grant  execute on function public.mark_left(bigint) to authenticated;
