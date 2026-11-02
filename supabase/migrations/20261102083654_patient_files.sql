-- =============================================================================
-- 20261102083654_patient_files.sql
--
-- What this is: files on a patient's record (scans, ultrasound results,
-- written documents), and registering a patient from an old paper file with
-- only a name and a phone number.
--
-- Why: Anthony, 2026-11-02, after the client meeting: "we can attach a
-- document like scanned a patient scan, ABI ultrasound scan results and
-- other stuff. And you can also attach normal written documents." For the
-- patients the hospital already has: "register patient by attachment...
-- they will just put the patient name, the full name and the phone number.
-- Then they will now upload the patient's documents there." The button is
-- "Register from old file". Every patient still gets their own RMC number.
--
-- Rules:
--   - A patient from an old file needs a name and a phone number. Date of
--     birth and sex may wait until somebody fills them in. Every other
--     patient still needs both, as before.
--   - Anybody who may register patients may attach a file (the Front Desk
--     brings in old files). Only somebody who may open the medical record,
--     and has opened it in the last 12 hours, may see the files or remove
--     one. The Worker serves a file only when this table lets the person
--     read its row.
--   - A file is never deleted. A wrong one is removed with a reason and
--     stays in the history, like every other record.
--   - One file is recorded once. The same file sent twice is refused.
--
-- Never: let the Front Desk, or anybody without the medical record, read a
-- patient's files.
-- =============================================================================


-- ===== 1. Patients from an old file =====

alter table public.patients
  add column from_old_file boolean not null default false;

-- Date of birth and sex may be empty, but only for a patient from an old
-- file; such a patient must have a phone number, so they can be found.
alter table public.patients alter column date_of_birth drop not null;
alter table public.patients alter column sex drop not null;
alter table public.patients
  add constraint patients_details_or_old_file check (
    (date_of_birth is not null and sex is not null)
    or (from_old_file and phone is not null)
  );


-- ===== 2. The files table =====

create table public.patient_files (
  id           bigint generated always as identity primary key,
  patient_id   bigint not null references public.patients (id),
  -- Where the Worker stored it: record/<uuid>.<webp|jpg|pdf>.
  file_key     text not null unique check (
    file_key ~ '^record/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|pdf)$'
  ),
  file_name    text not null check (length(trim(file_name)) between 1 and 200),
  file_type    text not null check (file_type in ('image/webp', 'image/jpeg', 'application/pdf')),
  file_size    integer not null check (file_size between 1 and 10485760),
  uploaded_by  uuid not null default auth.uid() references public.staff (id),
  uploaded_at  timestamptz not null default now(),
  -- A wrong file is removed with a reason, never deleted.
  removed_at   timestamptz,
  removed_by   uuid references public.staff (id),
  remove_reason text,
  constraint patient_files_remove_needs_reason
    check (removed_at is null or length(trim(remove_reason)) > 0)
);

create index patient_files_patient_idx  on public.patient_files (patient_id, uploaded_at desc);
create index patient_files_uploader_idx on public.patient_files (uploaded_by);
create index patient_files_remover_idx  on public.patient_files (removed_by);

-- Supabase gives every new table full rights. Take them all away first,
-- then give back only reading. Every write goes through the functions below.
revoke all on public.patient_files from anon, authenticated;
alter table public.patient_files enable row level security;
grant select on public.patient_files to authenticated;

create policy patient_files_read on public.patient_files
  for select to authenticated
  using ((select private.can_use_record(patient_id)));

create trigger patient_files_activity
  after insert or update on public.patient_files
  for each row execute function private.write_activity();


-- ===== 3. Attach a file =====
-- The Worker has already stored the file under `key`; this records it on
-- the patient. Answers 'added', or 'already_added' for the same key again.

create function private.add_patient_file(
  patient bigint, key text, name text, type text, size integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.has_permission('patients') or private.can_use_record(patient)) then
    raise exception 'not allowed to attach files' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.patients where id = patient and voided_at is null) then
    raise exception 'no such patient' using errcode = 'no_data_found';
  end if;
  -- Two taps at the same moment: the second waits, then finds the first.
  perform pg_advisory_xact_lock(hashtext('patient_file:' || key));
  if exists (select 1 from public.patient_files where file_key = key) then
    return 'already_added';
  end if;
  insert into public.patient_files (patient_id, file_key, file_name, file_type, file_size)
  values (patient, key, trim(name), type, size);
  return 'added';
end;
$$;


-- ===== 4. Remove a wrong file, with a reason =====

create function private.remove_patient_file(file bigint, reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.patient_files;
begin
  select * into found from public.patient_files where id = file for update;
  if found.id is null or not private.can_use_record(found.patient_id) then
    raise exception 'not allowed to remove this file' using errcode = 'insufficient_privilege';
  end if;
  if length(trim(coalesce(reason, ''))) = 0 then
    raise exception 'a reason is needed' using errcode = 'invalid_parameter_value';
  end if;
  if found.removed_at is not null then
    return 'already_removed';
  end if;
  update public.patient_files
     set removed_at = now(), removed_by = auth.uid(), remove_reason = trim(reason)
   where id = file;
  return 'removed';
end;
$$;

revoke execute on function private.add_patient_file(bigint, text, text, text, integer) from public, anon;
revoke execute on function private.remove_patient_file(bigint, text)                 from public, anon;
grant  execute on function private.add_patient_file(bigint, text, text, text, integer) to authenticated;
grant  execute on function private.remove_patient_file(bigint, text)                 to authenticated;


-- ===== 5. The public doors the app calls =====

create function public.add_patient_file(
  patient bigint, key text, name text, type text, size integer
)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.add_patient_file(patient, key, name, type, size) $$;

create function public.remove_patient_file(file bigint, reason text)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.remove_patient_file(file, reason) $$;

revoke execute on function public.add_patient_file(bigint, text, text, text, integer) from public, anon;
revoke execute on function public.remove_patient_file(bigint, text)                 from public, anon;
grant  execute on function public.add_patient_file(bigint, text, text, text, integer) to authenticated;
grant  execute on function public.remove_patient_file(bigint, text)                 to authenticated;
