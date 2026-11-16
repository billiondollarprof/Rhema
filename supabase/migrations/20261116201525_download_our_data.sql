-- =============================================================================
-- 20261116201525_download_our_data.sql
--
-- What this is: "Download our data" for the admin. One function hands back
-- every table the hospital owns as rows, after the admin types their PIN
-- again; the screen turns them into spreadsheets (CSV) in one ZIP file, with
-- the uploaded files. A second, narrow function lets an admin read a lab
-- file for that download.
--
-- Why: Anthony, 2026-11-16 (requests 206 and 217a): "at any point in time,
-- the hospital can decide, okay, they want their data." His yes to the plan:
-- admins only, the PIN again, every download in the activity log.
--
-- Rules:
--   - Only an admin (can_admin), and only with the right PIN. A wrong PIN
--     counts towards the lock, like the lock screen.
--   - Every download is written in the activity log: who and when.
--   - Staff rows go out without PINs or anything secret.
--
-- Never: send a PIN, a password or a key; let anybody but an admin download.
-- =============================================================================


-- ===== 1. Everything, as rows =====
create function private.export_everything(pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  pin_answer text;
  answer jsonb := '{}'::jsonb;
  one_table text;
  rows jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'Only an admin downloads the data' using errcode = '42501';
  end if;
  pin_answer := private.check_my_pin(pin);
  if pin_answer <> 'ok' then
    return jsonb_build_object('pin', pin_answer);
  end if;

  -- The hospital's own tables, one by one. Staff is done on its own below.
  foreach one_table in array array[
    'patients', 'families', 'rooms', 'queue_entries', 'medical_profiles',
    'allergies', 'conditions', 'vital_signs', 'vital_extras', 'nursing_notes',
    'consultation_notes', 'patient_medications', 'medications_given',
    'medication_status_log', 'antenatal_bookings', 'antenatal_tests',
    'antenatal_visits', 'previous_pregnancies', 'operation_consents',
    'lab_requests', 'lab_results', 'prescriptions', 'prescription_items',
    'payments', 'payment_lines', 'patient_files', 'medicine_list',
    'stock_moves', 'price_list', 'record_emails'
  ] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t', one_table)
    into rows;
    answer := answer || jsonb_build_object(one_table, rows);
  end loop;

  -- Staff, without the PIN or anything secret.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'full_name', full_name, 'email', email, 'role', role,
    'is_active', is_active, 'created_at', created_at
  )), '[]'::jsonb) into rows from public.staff;
  answer := answer || jsonb_build_object('staff', rows);

  insert into public.activity_log (actor_id, action, table_name, record_id)
  values (me, 'export', 'all_tables', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'));

  return jsonb_build_object('pin', 'ok', 'tables', answer);
end;
$$;


-- ===== 2. An admin reads a lab file for the download =====
-- Record files are already open to the admin (open_patient_file). A lab file
-- is read only by the Laboratory or through the record, so an admin needs
-- this: true when the file belongs to a lab result.
create function private.export_may_read(key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_admin())
     and exists (select 1 from public.lab_results where file_key = key);
$$;

revoke execute on function private.export_everything(text) from public, anon;
revoke execute on function private.export_may_read(text) from public, anon;
grant  execute on function private.export_everything(text) to authenticated;
grant  execute on function private.export_may_read(text) to authenticated;

create function public.export_everything(pin text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.export_everything(pin); $$;
create function public.export_may_read(key text)
returns boolean language sql security invoker set search_path = ''
as $$ select private.export_may_read(key); $$;

revoke execute on function public.export_everything(text) from public, anon;
revoke execute on function public.export_may_read(text) from public, anon;
grant  execute on function public.export_everything(text) to authenticated;
grant  execute on function public.export_may_read(text) to authenticated;
