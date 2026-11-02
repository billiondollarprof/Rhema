-- =============================================================================
-- 20261102120101_call_patient_alerts.sql
--
-- What this is: when a doctor, nurse or matron taps Call in on a patient,
-- the Front Desk gets a floating card with its own sound: "Call patient:
-- Adaeze Okafor to Consultant Room 1". It rides on Call attention (the same
-- table, live line and phone alerts), marked as its own kind.
--
-- Why: Anthony, 2026-11-02 (request 129): "If a consultant in room one
-- calls in patient... the front desk gets the notification... float on the
-- screen, even if the front desk is doing something... carry the call
-- attention ringing infrastructure the same way... different headline,
-- different coloration... call patient, then the name of the patient to
-- room 1."
--
-- Rules:
--   - Made only by the database, the moment a visit moves from waiting to
--     in consultation. Nobody writes one by hand.
--   - It goes to every Front Desk, like a group Call attention.
--   - Who can read it is the same as Call attention: the caller and the
--     people called. The patient's name is read from the patients table,
--     which the Front Desk may already see.
--   - Phone alerts carry rooms only, never the patient's name.
--
-- Never: put a patient's name in a phone alert or in the log.
-- =============================================================================


-- ===== 1. Two kinds of call =====

alter table public.attention_calls
  add column kind text not null default 'attention'
    check (kind in ('attention', 'call_patient')),
  add column patient_id bigint references public.patients (id);

alter table public.attention_calls
  add constraint attention_calls_patient_kind
    check ((kind = 'call_patient') = (patient_id is not null));

create index attention_calls_patient_idx on public.attention_calls (patient_id);


-- ===== 2. Call in raises the card for the Front Desk =====

create function private.call_patient_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'waiting' and new.status = 'in_consultation' and auth.uid() is not null then
    insert into public.attention_calls (called_by, from_room_id, to_kind, to_room_id, kind, patient_id)
    values (auth.uid(), new.room_id, 'front_desk', null, 'call_patient', new.patient_id);
  end if;
  return new;
end;
$$;

revoke execute on function private.call_patient_alert() from public, anon, authenticated;

create trigger queue_entries_call_patient
  after update of status on public.queue_entries
  for each row execute function private.call_patient_alert();


-- ===== 3. The phone alert: its own title, still no names =====

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
        -- Call patient (request 129) has its own words. Still rooms only:
        -- a phone's lock screen never shows a patient's name.
        'title', case when new.kind = 'call_patient' then 'Call patient' else 'Call attention' end,
        'body', case when new.kind = 'call_patient'
                     then from_words || ' is calling the next patient'
                     else from_words || ' is calling ' || to_words end,
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
