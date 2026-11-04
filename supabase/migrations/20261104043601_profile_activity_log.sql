-- =============================================================================
-- profile_activity_log: the activity log can now log a saved Profile
-- (blood group, genotype, antenatal details) in the medical record.
--
-- Why: request 138, found 2026-11-04 by the testing top up. Every save of a
-- Profile was refused, on testing and on live, because the activity log
-- names each record by its id column, and medical_profiles has none (its
-- key is patient_id). Anthony, 2026-11-04: "now run your SQL".
--
-- What changes: one line. When a row has no id, the log uses its
-- patient_id. Every other table logs exactly as before.
--
-- Never: stop logging a read or write of a medical record (CLAUDE.md 10).
-- =============================================================================

-- ===== 1. The activity log function, with the fallback =====
create or replace function private.write_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[];
  row_id  text;
  pat_id  bigint;
begin
  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into changed
    from jsonb_each(to_jsonb(new)) as after_values
    where after_values.value is distinct from (to_jsonb(old) -> after_values.key)
      and after_values.key not in ('updated_at', 'pin_hash', 'pin_failed_attempts');
  end if;

  -- A row with no id (the Profile) is named by its patient_id.
  row_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'patient_id');
  pat_id := case
    when tg_table_name = 'patients' then (to_jsonb(new) ->> 'id')::bigint
    else (to_jsonb(new) ->> 'patient_id')::bigint
  end;

  insert into public.activity_log (actor_id, action, table_name, record_id, patient_id, changed_fields)
  values ((select auth.uid()), lower(tg_op), tg_table_name, row_id, pat_id, changed);

  return new;
end;
$$;

revoke execute on function private.write_activity() from public, anon, authenticated;
