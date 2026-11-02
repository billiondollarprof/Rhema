-- =============================================================================
-- 20261102105521_patient_files_preview.sql
--
-- What this is: anybody who may see a patient may now see that patient's
-- files (to preview them from Edit patient); every opening of a file is
-- written in the activity log; and the person who attached a file to a
-- patient registered from an old file may delete it for good.
--
-- Why: Anthony, 2026-11-02: "anybody should be able to see the files that
-- were attached to that patient... They can preview it, but they can't
-- delete it. But only the person who attached it can delete it." And:
-- "this is just for only the register from old file... because they have
-- a backup, and they can easily make mistake and put another person's
-- document on another person." A real delete frees the storage. Not even
-- the admin may delete.
--
-- Rules:
--   - Reading the list: the patients tick (everybody who registers or finds
--     patients), or the opened medical record, as before.
--   - Opening a file (the Worker asks open_patient_file first): the same
--     people; each opening is logged by file number, never by name.
--   - Deleting: only the person who attached it, and only when the patient
--     was registered from an old file. Every other file is only crossed out
--     with a reason (remove_patient_file), as before.
--
-- Never: let anybody but the uploader delete a file, or delete a file on a
-- patient who was not registered from an old file.
-- =============================================================================


-- ===== 1. Who may see the list =====

drop policy patient_files_read on public.patient_files;
create policy patient_files_read on public.patient_files
  for select to authenticated
  using (
    (select private.has_permission('patients'))
    or (select private.can_use_record(patient_id))
  );


-- ===== 2. Opening a file: check, and write it in the activity log =====
-- The Worker calls this, as the person, before it hands a file over.
-- Answers true when they may open it (and logs it), false otherwise.

create function private.open_patient_file(key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.patient_files;
begin
  select * into found from public.patient_files where file_key = key and removed_at is null;
  if found.id is null then
    return false;
  end if;
  if not (private.has_permission('patients') or private.can_use_record(found.patient_id)) then
    return false;
  end if;
  insert into public.activity_log (actor_id, action, table_name, record_id, patient_id)
  values (auth.uid(), 'view', 'patient_files', found.id::text, found.patient_id);
  return true;
end;
$$;


-- ===== 3. Delete a file attached by mistake (old file patients only) =====
-- Answers 'deleted' (the Worker then deletes the stored file) or
-- 'not_found'. Anybody else is refused.

create function private.delete_patient_file(key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.patient_files;
begin
  select * into found from public.patient_files where file_key = key for update;
  if found.id is null then
    return 'not_found';
  end if;
  if found.uploaded_by is distinct from auth.uid()
     or not private.is_active_staff()
     or not exists (
       select 1 from public.patients where id = found.patient_id and from_old_file
     ) then
    raise exception 'only the person who attached it may delete it' using errcode = 'insufficient_privilege';
  end if;
  insert into public.activity_log (actor_id, action, table_name, record_id, patient_id)
  values (auth.uid(), 'delete', 'patient_files', found.id::text, found.patient_id);
  delete from public.patient_files where id = found.id;
  return 'deleted';
end;
$$;

revoke execute on function private.open_patient_file(text)   from public, anon;
revoke execute on function private.delete_patient_file(text) from public, anon;
grant  execute on function private.open_patient_file(text)   to authenticated;
grant  execute on function private.delete_patient_file(text) to authenticated;


-- ===== 4. The public doors =====

create function public.open_patient_file(key text)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.open_patient_file(key) $$;

create function public.delete_patient_file(key text)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.delete_patient_file(key) $$;

revoke execute on function public.open_patient_file(text)   from public, anon;
revoke execute on function public.delete_patient_file(text) from public, anon;
grant  execute on function public.open_patient_file(text)   to authenticated;
grant  execute on function public.delete_patient_file(text) to authenticated;
