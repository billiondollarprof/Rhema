-- =============================================================================
-- sheets_signed_by_route_offline_copy
--
-- What this is (request 224, Anthony 2026-11-17, "yes on the SQL as long as
-- all is well"):
--   1. Route on medicines and doses (IV, IM, Oral...), as on the ward's
--      treatment sheet.
--   2. Signed by: the nurse who gave a dose or took the vital signs, or the
--      clinician who saw the patient, picked from a list. The person signed
--      in stays recorded as the one who entered it (given_by, recorded_by,
--      written_by), so one ward device can be used by several nurses and
--      the record still says who typed it.
--   3. Records kept on the device for patients with a visit open now, so
--      doctors and nurses can read them with no network. Saving that copy,
--      and every record opened from it, is written in the activity log.
--
-- Rules:
--   - Additive: new columns with safe defaults; old rows read as before.
--   - Signed by must be active staff with medical access.
--   - The copy is only for staff with medical access, only for open visits.
--   - record_openings: a person may insert only the patient (and themselves);
--     the purpose and the time are set by the functions here.
--
-- Never: let the Front Desk or anybody without medical access copy a
-- record; let anybody sign as a person without medical access.
-- =============================================================================


-- ===== 1. Route =====
alter table public.patient_medications
  add column route text check (route is null or length(trim(route)) between 1 and 40);
alter table public.medications_given
  add column route text check (route is null or length(trim(route)) between 1 and 40);


-- ===== 2. Signed by =====
alter table public.medications_given
  add column signed_by uuid default auth.uid() references public.staff (id);
alter table public.vital_signs
  add column signed_by uuid default auth.uid() references public.staff (id);
alter table public.consultation_notes
  add column signed_by uuid default auth.uid() references public.staff (id);

create index medications_given_signed_by_idx on public.medications_given (signed_by);
create index vital_signs_signed_by_idx on public.vital_signs (signed_by);
create index consultation_notes_signed_by_idx on public.consultation_notes (signed_by);

-- The person signing must be active staff with medical access.
create function private.check_signed_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.signed_by is null then
    new.signed_by := (select auth.uid());
  end if;
  if not exists (
    select 1 from public.staff s
    where s.id = new.signed_by and s.is_active and s.can_medical
  ) then
    raise exception 'Only active clinical staff can sign' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.check_signed_by() from public, anon, authenticated;

create trigger medications_given_signed_by before insert on public.medications_given
  for each row execute function private.check_signed_by();
create trigger vital_signs_signed_by before insert on public.vital_signs
  for each row execute function private.check_signed_by();
create trigger consultation_notes_signed_by before insert on public.consultation_notes
  for each row execute function private.check_signed_by();


-- ===== 3a. Why a record was opened =====
-- opened: on the screen; offline_copy: saved on the device for no network;
-- offline_view: opened from that copy with no network (logged when the
-- network came back, at the time it was opened).
alter table public.record_openings
  add column purpose text not null default 'opened'
    check (purpose in ('opened', 'offline_copy', 'offline_view'));

-- A person inserts only the patient; the purpose and the time come from the
-- functions below.
revoke insert on public.record_openings from authenticated;
grant insert (patient_id, staff_id) on public.record_openings to authenticated;

-- The activity log says which: "opened", or the purpose.
create function private.write_opening_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (actor_id, action, table_name, record_id, patient_id)
  values (
    new.staff_id,
    case new.purpose when 'opened' then 'insert' else new.purpose end,
    'record_openings',
    new.id::text,
    new.patient_id
  );
  return new;
end;
$$;

revoke execute on function private.write_opening_activity() from public, anon, authenticated;

drop trigger openings_activity on public.record_openings;
create trigger openings_activity after insert on public.record_openings
  for each row execute function private.write_opening_activity();


-- ===== 3b. Copy the records of patients with a visit open now =====
-- Answers the patients copied. A copy made by the same person in the last
-- 25 minutes is not written again (the device refreshes every 30).
create function private.copy_open_visits()
returns bigint[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  open_patients bigint[];
begin
  if not (select private.has_permission('medical')) then
    raise exception 'Only clinical staff keep records for no network' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct q.patient_id), '{}') into open_patients
  from public.queue_entries q
  where q.status <> 'done';
  insert into public.record_openings (patient_id, staff_id, purpose)
  select p, me, 'offline_copy'
  from unnest(open_patients) as p
  where not exists (
    select 1 from public.record_openings o
    where o.patient_id = p and o.staff_id = me and o.purpose = 'offline_copy'
      and o.opened_at > now() - interval '25 minutes'
  );
  return open_patients;
end;
$$;

-- ===== 3c. A record opened from the copy with no network =====
-- Written when the network is back, at the time it was opened (within the
-- last 24 hours). The same opening twice is written once.
create function private.log_offline_view(patient bigint, seen_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not (select private.has_permission('medical')) then
    raise exception 'Only clinical staff open records' using errcode = '42501';
  end if;
  if seen_at is null or seen_at < now() - interval '24 hours' or seen_at > now() + interval '5 minutes' then
    raise exception 'That time is not within the last 24 hours' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.record_openings o
    where o.patient_id = patient and o.staff_id = me and o.purpose = 'offline_view'
      and o.opened_at between seen_at - interval '1 minute' and seen_at + interval '1 minute'
  ) then
    return;
  end if;
  insert into public.record_openings (patient_id, staff_id, opened_at, purpose)
  values (patient, me, seen_at, 'offline_view');
end;
$$;

revoke execute on function private.copy_open_visits() from public, anon;
revoke execute on function private.log_offline_view(bigint, timestamptz) from public, anon;
grant  execute on function private.copy_open_visits() to authenticated;
grant  execute on function private.log_offline_view(bigint, timestamptz) to authenticated;

create function public.copy_open_visits()
returns bigint[] language sql security invoker set search_path = ''
as $$ select private.copy_open_visits(); $$;
create function public.log_offline_view(patient bigint, seen_at timestamptz)
returns void language sql security invoker set search_path = ''
as $$ select private.log_offline_view(patient, seen_at); $$;

revoke execute on function public.copy_open_visits() from public, anon;
revoke execute on function public.log_offline_view(bigint, timestamptz) from public, anon;
grant  execute on function public.copy_open_visits() to authenticated;
grant  execute on function public.log_offline_view(bigint, timestamptz) to authenticated;
