-- Undo profile_activity_log: put back the activity log function as the
-- foundation made it (a Profile save is refused again).
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

  row_id := (to_jsonb(new) ->> 'id');
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
