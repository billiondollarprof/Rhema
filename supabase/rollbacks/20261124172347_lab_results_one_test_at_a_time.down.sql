-- =============================================================================
-- Undo 20261124172347_lab_results_one_test_at_a_time.sql: a request needs
-- every test at once again, and the alert fires only when it completes.
-- Removes the results_at column: the time of each send is lost, the results
-- themselves stay. On live this needs Anthony's yes in writing.
-- =============================================================================

create or replace function private.record_lab_results(request bigint, patient bigint, items jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.lab_requests;
  for_patient bigint := patient;
  item jsonb;
  missing integer;
begin
  if not (select private.has_permission('lab')) then
    raise exception 'Only the Laboratory can record results' using errcode = '42501';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 20 then
    raise exception 'Type between 1 and 20 results' using errcode = '22023';
  end if;

  if request is not null then
    select * into wanted from public.lab_requests where id = request for update;
    if not found then
      raise exception 'No such lab request' using errcode = '22023';
    end if;
    if wanted.status = 'completed' then
      return 'already_done';
    end if;
    -- Not paid yet is no longer a reason to wait (request 232): the result is
    -- saved, and the Front Desk still sees the test as owed.
    if wanted.status = 'voided' then
      raise exception 'This request was cancelled' using errcode = '22023';
    end if;
    -- Every test on the request needs its details (2026-11-16).
    select count(*) into missing
    from unnest(wanted.tests) as asked(test)
    where not exists (
      select 1 from jsonb_array_elements(items) given
      where lower(trim(given ->> 'test')) = lower(trim(asked.test))
        and (length(trim(coalesce(given ->> 'result', ''))) > 0 or given ->> 'file_key' is not null)
    );
    if missing > 0 then
      return 'missing_tests';
    end if;
    for_patient := wanted.patient_id;
  else
    if not exists (select 1 from public.patients where id = for_patient and voided_at is null) then
      raise exception 'No such patient' using errcode = '22023';
    end if;
    -- A walk in result typed twice within 30 seconds is a double tap.
    perform pg_advisory_xact_lock(hashtext('lab-walkin:' || (select auth.uid())::text || ':' || for_patient::text));
    if exists (
      select 1 from public.lab_results
      where recorded_by = (select auth.uid())
        and patient_id = for_patient
        and request_id is null
        and recorded_at > now() - interval '30 seconds'
    ) then
      return 'already_done';
    end if;
  end if;

  for item in select value from jsonb_array_elements(items) loop
    insert into public.lab_results (patient_id, request_id, test, result, file_key, file_name, file_type, file_size)
    values (
      for_patient, request,
      trim(item ->> 'test'), trim(item ->> 'result'),
      item ->> 'file_key', item ->> 'file_name', item ->> 'file_type',
      (item ->> 'file_size')::integer
    );
  end loop;

  if request is not null then
    update public.lab_requests
    set status = 'completed', completed_at = now(), completed_by = (select auth.uid())
    where id = request;
  end if;
  return 'saved';
end;
$$;

create or replace function private.add_lab_result(request bigint, item jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.lab_requests;
begin
  if not (select private.has_permission('lab')) then
    raise exception 'Only the Laboratory adds results' using errcode = '42501';
  end if;
  select * into wanted from public.lab_requests where id = request for update;
  -- Paid or not (request 232); never a cancelled one.
  if not found or wanted.status not in ('awaiting_test', 'awaiting_payment', 'completed') then
    return 'not_paid';
  end if;
  if length(trim(coalesce(item ->> 'result', ''))) = 0 and item ->> 'file_key' is null then
    return 'missing_tests';
  end if;
  perform pg_advisory_xact_lock(hashtext('lab-add:' || request::text));
  if exists (
    select 1 from public.lab_results
    where request_id = request and recorded_by = (select auth.uid())
      and lower(test) = lower(trim(item ->> 'test')) and result = trim(item ->> 'result')
      and recorded_at > now() - interval '30 seconds'
  ) then
    return 'already_done';
  end if;
  insert into public.lab_results (patient_id, request_id, test, result, file_key, file_name, file_type, file_size)
  values (wanted.patient_id, request, trim(item ->> 'test'), trim(item ->> 'result'),
          item ->> 'file_key', item ->> 'file_name', item ->> 'file_type', (item ->> 'file_size')::integer);
  update public.lab_requests
  set status = 'completed', completed_at = coalesce(completed_at, now()),
      completed_by = coalesce(completed_by, (select auth.uid()))
  where id = request and status in ('awaiting_test', 'awaiting_payment');
  return 'saved';
end;
$$;

create or replace function private.mark_lab_result_seen(request bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.lab_requests
  set result_seen_at = now()
  where id = request
    and requested_by = (select auth.uid())
    and status = 'completed'
    and result_seen_at is null;
$$;

create or replace function private.push_lab_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_url text;
  push_secret text;
  targets jsonb;
begin
  if not (new.status = 'completed' and old.status is distinct from 'completed') then
    return new;
  end if;
  select decrypted_secret into worker_url from vault.decrypted_secrets where name = 'rhema_push_url';
  select decrypted_secret into push_secret from vault.decrypted_secrets where name = 'rhema_push_secret';
  if worker_url is null or push_secret is null then
    return new;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth_key)), '[]'::jsonb)
  into targets
  from public.push_devices
  where staff_id = new.requested_by;
  if jsonb_array_length(targets) = 0 then
    return new;
  end if;

  -- A failed send must never stop the result being saved.
  begin
    perform net.http_post(
      url := worker_url || '/api/push/attention',
      body := jsonb_build_object(
        'call_id', new.id,
        'title', 'Lab result ready',
        'body', 'A lab result you asked for is ready.',
        'tag', 'lab-' || new.id,
        'url', '/patients/record/?p=' || new.patient_id,
        'targets', targets
      ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Rhema-Push-Secret', push_secret),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'Lab result push for request % could not be queued: %', new.id, sqlstate;
  end;
  return new;
end;
$$;

drop function private.lab_request_all_resulted(bigint);
alter table public.lab_requests drop column results_at;
