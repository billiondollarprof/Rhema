-- =============================================================================
-- 20261120162058_record_copy_own_room_7_days.sql
--
-- What this is: the records a doctor or nurse keeps on their device for no
-- network are the patients seen in their OWN room in the last 7 days (the
-- newest 50), instead of every patient with a visit open anywhere now.
--
-- Why: Anthony, 2026-11-20 (request 230c): "7 days for both doctors and
-- nurses, and it should be their own room. They should not be seeing that of
-- another person's room, to keep everything light, scrambled, and then it
-- should wipe out as they log out." The hospital's desktops have 2 GB of
-- memory, so the copy is kept to 50 records.
--
-- Rules:
--   - Clinical staff only, as before. Their room is the one the admin gave
--     them; with no room, nothing is copied.
--   - Each copy is written in the activity log as an offline_copy opening,
--     as before (not again within 11 hours).
--   - copy_open_visits stays for screens that still call it.
--   - The device keeps the copy scrambled, for at most 24 hours, and wipes
--     it at sign out (lib/offline/recordCopy.ts, unchanged).
--
-- Never: copy a patient who was not seen in this person's own room, or more
-- than 50, or for anybody without medical access.
-- =============================================================================


-- ===== 1. The patients seen in my room in the last 7 days, newest first =====
create function private.copy_room_visits()
returns bigint[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_room bigint;
  seen bigint[];
begin
  if not (select private.has_permission('medical')) then
    raise exception 'Only clinical staff keep records for no network' using errcode = '42501';
  end if;
  -- With no room, the search below finds nothing.
  select room_id into my_room from public.staff where id = me and is_active;
  select coalesce(array_agg(patient_id order by last_seen desc), '{}') into seen
  from (
    select q.patient_id, max(q.created_at) as last_seen
    from public.queue_entries q
    join public.patients p on p.id = q.patient_id and p.voided_at is null
    where q.room_id = my_room
      and (q.created_at > now() - interval '7 days' or q.status <> 'done')
    group by q.patient_id
    order by max(q.created_at) desc
    limit 50
  ) newest;
  insert into public.record_openings (patient_id, staff_id, purpose)
  select p, me, 'offline_copy'
  from unnest(seen) as p
  where not exists (
    select 1 from public.record_openings o
    where o.patient_id = p and o.staff_id = me and o.purpose = 'offline_copy'
      and o.opened_at > now() - interval '11 hours'
  );
  return seen;
end;
$$;

revoke execute on function private.copy_room_visits() from public, anon;
grant  execute on function private.copy_room_visits() to authenticated;

create function public.copy_room_visits()
returns bigint[]
language sql
set search_path = ''
as $$ select private.copy_room_visits(); $$;

revoke execute on function public.copy_room_visits() from public, anon;
grant  execute on function public.copy_room_visits() to authenticated;
