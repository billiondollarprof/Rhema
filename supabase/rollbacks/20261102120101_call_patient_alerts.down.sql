-- =============================================================================
-- Undo for 20261102120101_call_patient_alerts.sql: Call in no longer tells
-- the Front Desk; the phone alert goes back to Call attention words only.
-- Call patient cards already made are removed with the kind column.
-- =============================================================================

drop trigger if exists queue_entries_call_patient on public.queue_entries;
drop function if exists private.call_patient_alert();

create or replace function private.push_attention_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_url text;
  push_secret text;
  targets jsonb;
  from_words text;
  to_words text;
begin
  -- Not set up yet (the push-keys workflow has not run): send nothing.
  select decrypted_secret into worker_url from vault.decrypted_secrets where name = 'rhema_push_url';
  select decrypted_secret into push_secret from vault.decrypted_secrets where name = 'rhema_push_secret';
  if worker_url is null or push_secret is null then
    return new;
  end if;

  -- The devices of everyone being called, once each, but never a device the
  -- caller uses (a shared desk computer would ring its own caller).
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', d.endpoint, 'p256dh', d.p256dh, 'auth', d.auth_key)), '[]'::jsonb)
  into targets
  from (
    select distinct on (pd.endpoint) pd.endpoint, pd.p256dh, pd.auth_key
    from public.push_devices pd
    where pd.staff_id <> new.called_by
      and private.staff_is_called(pd.staff_id, new.to_kind, new.to_room_id)
      and pd.endpoint not in (select mine.endpoint from public.push_devices mine where mine.staff_id = new.called_by)
    order by pd.endpoint, pd.last_seen_at desc
  ) d;

  if jsonb_array_length(targets) = 0 then
    return new;
  end if;

  -- The words: rooms only, never a person's name.
  select coalesce((select name from public.rooms where id = new.from_room_id), 'Someone') into from_words;
  select coalesce(
    (select name from public.rooms where id = new.to_room_id),
    case new.to_kind
      when 'front_desk'   then 'Front Desk'
      when 'nursing'      then 'Nursing Station'
      when 'laboratory'   then 'Laboratory'
      when 'pharmacy'     then 'Pharmacy'
      when 'consultation' then 'Consultant'
      when 'matron'       then 'Matron'
    end
  ) into to_words;

  -- A failed send must never stop the call being saved.
  begin
    perform net.http_post(
      url := worker_url || '/api/push/attention',
      body := jsonb_build_object(
        'call_id', new.id,
        'title', 'Call attention',
        'body', from_words || ' is calling ' || to_words,
        'targets', targets
      ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Rhema-Push-Secret', push_secret),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'Call attention push for call % could not be queued: %', new.id, sqlstate;
  end;
  return new;
end;
$$;

delete from public.attention_calls where kind = 'call_patient';
alter table public.attention_calls drop constraint if exists attention_calls_patient_kind;
drop index if exists public.attention_calls_patient_idx;
alter table public.attention_calls drop column if exists patient_id;
alter table public.attention_calls drop column if exists kind;
