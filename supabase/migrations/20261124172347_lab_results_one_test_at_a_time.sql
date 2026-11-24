-- =============================================================================
-- 20261124172347_lab_results_one_test_at_a_time.sql
--
-- What this is: the Lab sends the results that are ready and keeps the
-- others pending. A request is complete only when every test on it has a
-- result. The doctor who asked is told each time results are sent.
--
-- Why: the Lab, through Anthony, 2026-11-23 (request 240h): "the doctor can
-- send three lab requests at the same time. He should be able to conduct
-- the one he can conduct now and send the results without sending
-- everything... the other one, he will keep it as pending results... some
-- of the results takes three days. Whenever the results is ready, he can now
-- send it." His yes, 2026-11-24: "go on with the lab results now and fix it".
--
-- Rules:
--   - lab_requests.results_at: when results were last sent (the moment of
--     the send, clock_timestamp, so two sends never share a time). Each send
--     sets it and clears result_seen_at, so the doctor's notice comes again.
--   - record_lab_results, for a request: at least one test with a result or
--     a file; each a test on the request; a test that already has a result
--     is not saved again (a double tap answers already_done). Complete when
--     every test has a result. Walk-in results (no request) are unchanged.
--   - add_lab_result (a missed or corrected result): the same completion
--     rule, and it is a send too.
--   - The phone alert to the doctor fires on every send.
--   - Seen: a request with results sent, or a complete one.
--
-- Never: close a request while a test on it has no result, or let anybody
-- but the Lab send a result.
-- =============================================================================


-- ===== 1. When results were last sent =====
alter table public.lab_requests add column results_at timestamptz;


-- ===== 2. Does every test on this request have a result? =====
create function private.lab_request_all_resulted(request bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.lab_requests r, unnest(r.tests) as asked(test)
    where r.id = request
      and not exists (
        select 1 from public.lab_results res
        where res.request_id = r.id and res.voided_at is null
          and lower(trim(res.test)) = lower(trim(asked.test))
      )
  );
$$;

revoke execute on function private.lab_request_all_resulted(bigint) from public, anon, authenticated;


-- ===== 3. Send results: some or all of the tests =====
-- The same as 20261120130854, but a request no longer needs every test at
-- once. Answers saved, already_done or missing_tests.
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
  saved integer := 0;
begin
  if not (select private.has_permission('lab')) then
    raise exception 'Only the Laboratory can record results' using errcode = '42501';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 20 then
    raise exception 'Type between 1 and 20 results' using errcode = '22023';
  end if;

  if request is not null then
    -- Locked: two sends at the same moment wait for each other.
    select * into wanted from public.lab_requests where id = request for update;
    if not found then
      raise exception 'No such lab request' using errcode = '22023';
    end if;
    if wanted.status = 'completed' then
      return 'already_done';
    end if;
    -- Not paid yet is no reason to wait (request 232).
    if wanted.status = 'voided' then
      raise exception 'This request was cancelled' using errcode = '22023';
    end if;
    -- Each result is for a test on the request.
    if exists (
      select 1 from jsonb_array_elements(items) given
      where not (lower(trim(coalesce(given ->> 'test', ''))) = any (
                   select lower(trim(asked)) from unnest(wanted.tests) asked))
    ) then
      raise exception 'A result is for a test on the request' using errcode = '22023';
    end if;
    -- At least one test with a result or a file (request 240h: the ones
    -- ready now; the rest stay pending).
    if not exists (
      select 1 from jsonb_array_elements(items) given
      where length(trim(coalesce(given ->> 'result', ''))) > 0 or given ->> 'file_key' is not null
    ) then
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
    -- A test left empty is still pending; a test that already has a result
    -- is not saved twice (corrections go through add_lab_result).
    if request is not null and (
         (length(trim(coalesce(item ->> 'result', ''))) = 0 and item ->> 'file_key' is null)
         or exists (select 1 from public.lab_results res
                    where res.request_id = request and res.voided_at is null
                      and lower(trim(res.test)) = lower(trim(item ->> 'test')))) then
      continue;
    end if;
    insert into public.lab_results (patient_id, request_id, test, result, file_key, file_name, file_type, file_size)
    values (
      for_patient, request,
      trim(item ->> 'test'), trim(item ->> 'result'),
      item ->> 'file_key', item ->> 'file_name', item ->> 'file_type',
      (item ->> 'file_size')::integer
    );
    saved := saved + 1;
  end loop;

  if request is not null then
    if saved = 0 then
      return 'already_done';
    end if;
    -- Sent now: the doctor is told again (one update, so the alert knows
    -- whether this send completed the request).
    if private.lab_request_all_resulted(request) then
      update public.lab_requests
      set results_at = clock_timestamp(), result_seen_at = null,
          status = 'completed', completed_at = now(), completed_by = (select auth.uid())
      where id = request;
    else
      update public.lab_requests
      set results_at = clock_timestamp(), result_seen_at = null
      where id = request;
    end if;
  end if;
  return 'saved';
end;
$$;


-- ===== 4. A missed or corrected result: the same completion rule =====
-- The same as 20261120130854, but the request completes only when every
-- test has a result, and each one is a send.
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
  -- One update, so the alert knows whether this completed the request.
  if private.lab_request_all_resulted(request) then
    update public.lab_requests
    set results_at = clock_timestamp(), result_seen_at = null,
        status = case when status in ('awaiting_test', 'awaiting_payment')
                      then 'completed'::public.lab_status else status end,
        completed_at = coalesce(completed_at, now()),
        completed_by = coalesce(completed_by, (select auth.uid()))
    where id = request;
  else
    update public.lab_requests
    set results_at = clock_timestamp(), result_seen_at = null
    where id = request;
  end if;
  return 'saved';
end;
$$;


-- ===== 5. Seen: results sent, or complete =====
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
    and (status = 'completed' or results_at is not null)
    and result_seen_at is null;
$$;


-- ===== 6. The doctor's phone alert: on every send =====
-- The same as 20261030164236, but it fires when results are sent (results_at
-- changes), not only when the request completes.
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
  if new.results_at is null or new.results_at is not distinct from old.results_at then
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
        'body', case when new.status = 'completed'
                     then 'A lab result you asked for is ready.'
                     else 'Some lab results you asked for are ready. The rest are pending.' end,
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
