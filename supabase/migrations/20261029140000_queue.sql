-- =============================================================================
-- 20261029140000_queue.sql
--
-- What this is: the queue. One row each time a patient is sent to a room:
-- which patient, which room, the status, a note for the staff there, who
-- sent them, and the times. The home screens count and list from here.
--
-- Why: the RHEMA demo's home screen (tiles and the queue card) and section 6
-- of docs/DATABASE.md. Anthony approved this table on 2026-10-29 ("yes,
-- queue table").
--
-- Rules:
--   - Only signed in staff with the "patients" permission see or add rows.
--     The queue holds names, numbers, rooms and a short note, never the
--     medical record.
--   - A patient is never in two rooms at once (one open row per patient).
--   - Who sent the patient is always the person signed in, and the patient
--     and the sender can never be changed afterwards.
--   - Nothing is ever deleted. Every change goes in the activity log.
--
-- Never: put diagnoses or results in the note. It is for "please see her
-- first", not for clinical detail, because everyone at the desk can read it.
-- =============================================================================


-- ===== 1. The statuses, in the order a visit moves =====

create type public.queue_status as enum (
  'waiting', 'in_consultation', 'lab', 'pharmacy', 'done'
);


-- ===== 2. The table =====

create table public.queue_entries (
  id           bigint generated always as identity primary key,
  patient_id   bigint not null references public.patients (id),
  room_id      bigint not null references public.rooms (id),
  status       public.queue_status not null default 'waiting',
  note         text check (note is null or length(note) <= 500),
  sent_by      uuid not null default auth.uid() references public.staff (id),
  created_at   timestamptz not null default now(),
  called_at    timestamptz,
  finished_at  timestamptz,
  updated_at   timestamptz not null default now()
);

-- One open visit per patient: a patient is never in two rooms at once.
create unique index queue_one_open_per_patient
  on public.queue_entries (patient_id) where status <> 'done';

create index queue_room_status_idx on public.queue_entries (room_id, status);
create index queue_created_at_idx  on public.queue_entries (created_at);
create index queue_sent_by_idx     on public.queue_entries (sent_by);


-- ===== 3. Times and the activity log, same as the other tables =====

create trigger queue_touch before update on public.queue_entries
  for each row execute function private.touch_updated_at();

create trigger queue_activity after insert or update on public.queue_entries
  for each row execute function private.write_activity();


-- ===== 4. Who may do what (grants), then which rows (RLS) =====

revoke all on public.queue_entries from anon, authenticated;
grant select, insert on public.queue_entries to authenticated;
-- The patient and the sender are left out on purpose: they cannot change.
grant update (room_id, status, note, called_at, finished_at)
  on public.queue_entries to authenticated;

alter table public.queue_entries enable row level security;

create policy queue_read on public.queue_entries
  for select to authenticated
  using ((select private.has_permission('patients')));

create policy queue_insert on public.queue_entries
  for insert to authenticated
  with check ((select private.has_permission('patients')) and sent_by = (select auth.uid()));

create policy queue_update on public.queue_entries
  for update to authenticated
  using ((select private.has_permission('patients')))
  with check ((select private.has_permission('patients')));
