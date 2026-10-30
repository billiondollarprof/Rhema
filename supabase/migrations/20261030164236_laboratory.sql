-- =============================================================================
-- 20261030164236_laboratory.sql
--
-- What this is: the Laboratory (request 115), and the payments table it
-- needs (docs/DATABASE.md sections 5 and 9).
--   1. A doctor, nurse or matron requests tests for a patient, and sends
--      the request to the Front Desk for payment or straight to the lab.
--   2. The Front Desk records the payment: amount in naira and the mode
--      (Cash, POS, Transfer). The request then waits for its test.
--   3. The lab types the results (and, from slice 2, attaches a file). The
--      results go into the patient's record at once, and only the person
--      who asked is alerted.
--   4. The lab can also record a result with no request, for a walk in.
--
-- Why: Anthony, 2026-10-28 (requests 58 to 60) and 2026-10-30: "Front desk
-- usually add amount paid in naira... and they also add mode of payment."
-- "The results should just be part of the patient's record... you only
-- send a copy when a person requested for it so you send to the
-- person/notify the person while recording it into the patients record
-- simultaneously."
--
-- Rules:
--   - Nobody writes these tables directly. Every change goes through the
--     functions in sections 5 to 8, which check who is asking.
--   - Results are read through the opened medical record (logged), or by
--     the lab person who typed them. The Front Desk never sees results.
--     The lab never sees the medical history.
--   - Payments are read by the Front Desk and the admin only.
--   - A request is paid once and completed once: the database checks the
--     status under a lock, so two taps cannot both pass.
--   - Nothing is ever deleted.
--
-- Never: alert anybody but the person who asked. Never put a patient's
-- name or a test in the phone notification.
-- =============================================================================


-- ===== 1. The lists of choices =====

create type public.payment_purpose as enum
  ('registration_card', 'consultation', 'lab_test', 'scan', 'drugs', 'other');
create type public.payment_mode as enum ('cash', 'pos', 'transfer');
create type public.lab_status as enum ('awaiting_payment', 'awaiting_test', 'completed', 'voided');


-- ===== 2. Who may take money =====
-- The Front Desk, and anybody with admin access (docs/DATABASE.md 5).

create function private.can_take_payment()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and (role = 'front_desk' or can_admin)
  );
$$;

revoke execute on function private.can_take_payment() from public, anon;
grant  execute on function private.can_take_payment() to authenticated;


-- ===== 3. The tables =====

-- Payments: amount in naira, what for, how paid, who took it. A wrong one
-- will be voided with a reason (with the payments part), never edited.
create table public.payments (
  id           bigint generated always as identity primary key,
  patient_id   bigint not null references public.patients (id),
  amount       numeric(12, 2) not null check (amount > 0 and amount < 100000000),
  purpose      public.payment_purpose not null,
  mode         public.payment_mode not null,
  description  text check (description is null or length(description) <= 300),
  received_by  uuid not null default auth.uid() references public.staff (id),
  received_at  timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references public.staff (id),
  void_reason  text
);

create index payments_patient_idx on public.payments (patient_id, received_at desc);
create index payments_time_idx    on public.payments (received_at desc);

-- Lab requests: the tests asked for, by whom, and where it is now.
create table public.lab_requests (
  id              bigint generated always as identity primary key,
  patient_id      bigint not null references public.patients (id),
  tests           text[] not null check (cardinality(tests) between 1 and 20),
  note            text check (note is null or length(note) <= 500),
  requested_by    uuid not null default auth.uid() references public.staff (id),
  requested_at    timestamptz not null default now(),
  status          public.lab_status not null,
  payment_id      bigint references public.payments (id),
  completed_at    timestamptz,
  completed_by    uuid references public.staff (id),
  -- When the person who asked opened the finished result (Home card).
  result_seen_at  timestamptz
);

create index lab_requests_patient_idx   on public.lab_requests (patient_id, requested_at desc);
create index lab_requests_status_idx    on public.lab_requests (status, requested_at);
create index lab_requests_requester_idx on public.lab_requests (requested_by, status);

-- Lab results: one line per test. The file columns are filled from slice 2
-- (attached results); the key is the file's name in storage, never a link.
create table public.lab_results (
  id           bigint generated always as identity primary key,
  patient_id   bigint not null references public.patients (id),
  request_id   bigint references public.lab_requests (id),
  test         text not null check (length(trim(test)) between 2 and 80),
  result       text not null check (length(trim(result)) between 1 and 5000),
  file_key     text check (file_key is null or file_key ~ '^lab/[0-9a-f-]{36}\.(webp|jpg|pdf)$'),
  file_name    text check (file_name is null or length(file_name) <= 200),
  file_type    text check (file_type is null or file_type in ('image/webp', 'image/jpeg', 'application/pdf')),
  file_size    integer check (file_size is null or file_size between 1 and 10485760),
  recorded_by  uuid not null default auth.uid() references public.staff (id),
  recorded_at  timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references public.staff (id),
  void_reason  text
);

create index lab_results_patient_idx on public.lab_results (patient_id, recorded_at desc);
create index lab_results_request_idx on public.lab_results (request_id);

-- Supabase gives every new table full rights. Take them all away, then give
-- back reading only. Every write goes through the functions below.
revoke all on public.payments, public.lab_requests, public.lab_results from anon, authenticated;
alter table public.payments     enable row level security;
alter table public.lab_requests enable row level security;
alter table public.lab_results  enable row level security;
grant select on public.payments, public.lab_requests, public.lab_results to authenticated;

create trigger payments_activity     after insert or update on public.payments     for each row execute function private.write_activity();
create trigger lab_requests_activity after insert or update on public.lab_requests for each row execute function private.write_activity();
create trigger lab_results_activity  after insert or update on public.lab_results  for each row execute function private.write_activity();


-- ===== 4. Who reads which rows =====

-- Payments: the Front Desk and the admin.
create policy payments_read on public.payments
  for select to authenticated
  using ((select private.can_take_payment()));

-- Requests: the open record, the person who asked, the lab (to do the
-- work), and the Front Desk (to charge). Test names only; no results.
create policy lab_requests_read on public.lab_requests
  for select to authenticated
  using (
    private.can_use_record(patient_id)
    or (requested_by = (select auth.uid()) and (select private.is_active_staff()))
    or (select private.has_permission('lab'))
    or (select private.can_take_payment())
  );

-- Results: through the opened record (each opening is logged), or the lab
-- person who typed them. Never the Front Desk.
create policy lab_results_read on public.lab_results
  for select to authenticated
  using (
    private.can_use_record(patient_id)
    or (recorded_by = (select auth.uid()) and (select private.has_permission('lab')))
  );


-- ===== 5. Request tests =====
-- Answers: sent, or already_sent (the same request by the same person in
-- the last 30 seconds: a double tap).

create function private.request_lab(patient bigint, wanted text[], request_note text, send_to text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text[];
begin
  if not (select private.has_permission('medical')) then
    raise exception 'Only doctors, nurses and the matron can request lab tests' using errcode = '42501';
  end if;
  if send_to not in ('front_desk', 'laboratory') then
    raise exception 'Send it to the Front Desk or the Laboratory' using errcode = '22023';
  end if;
  if not exists (select 1 from public.patients where id = patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;

  -- Each test once, without spaces at the ends, in the order given.
  select array_agg(test order by first_at) into clean
  from (
    select trim(item) as test, min(position) as first_at
    from unnest(wanted) with ordinality as given(item, position)
    where length(trim(item)) between 2 and 80
    group by trim(item)
  ) tidy;
  if clean is null or cardinality(clean) = 0 or cardinality(clean) > 20 then
    raise exception 'Choose between 1 and 20 tests' using errcode = '22023';
  end if;

  -- Two taps at the same moment wait here for each other.
  perform pg_advisory_xact_lock(hashtext('lab-request:' || (select auth.uid())::text || ':' || patient::text));
  if exists (
    select 1 from public.lab_requests
    where requested_by = (select auth.uid())
      and patient_id = patient
      and tests = clean
      and requested_at > now() - interval '30 seconds'
  ) then
    return 'already_sent';
  end if;

  insert into public.lab_requests (patient_id, tests, note, status)
  values (
    patient, clean, nullif(trim(request_note), ''),
    case send_to when 'front_desk' then 'awaiting_payment'::public.lab_status
                 else 'awaiting_test'::public.lab_status end
  );
  return 'sent';
end;
$$;


-- ===== 6. The Front Desk records the payment =====
-- Answers: paid, or already_paid. The status is checked under a lock, so a
-- request can never be paid twice.

create function private.pay_lab_request(request bigint, amount_paid numeric, paid_by public.payment_mode)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.lab_requests;
  new_payment bigint;
begin
  if not (select private.can_take_payment()) then
    raise exception 'Only the Front Desk can record payments' using errcode = '42501';
  end if;
  if amount_paid is null or amount_paid <= 0 or amount_paid >= 100000000 then
    raise exception 'Type the amount paid in naira' using errcode = '22023';
  end if;

  select * into wanted from public.lab_requests where id = request for update;
  if not found then
    raise exception 'No such lab request' using errcode = '22023';
  end if;
  if wanted.status <> 'awaiting_payment' then
    return 'already_paid';
  end if;

  insert into public.payments (patient_id, amount, purpose, mode, description)
  values (wanted.patient_id, round(amount_paid, 2), 'lab_test', paid_by,
          'Lab: ' || array_to_string(wanted.tests, ', '))
  returning id into new_payment;

  update public.lab_requests
  set status = 'awaiting_test', payment_id = new_payment
  where id = request;
  return 'paid';
end;
$$;


-- ===== 7. The lab records the results =====
-- items: [{"test": "...", "result": "...", and from slice 2 "file_key",
-- "file_name", "file_type", "file_size"}]. With a request, every result
-- belongs to it and the request is completed. Without one (a walk in), the
-- patient is given. Answers: saved, already_done, or not_paid.

create function private.record_lab_results(request bigint, patient bigint, items jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.lab_requests;
  for_patient bigint := patient;
  item jsonb;
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
    if wanted.status = 'awaiting_payment' then
      return 'not_paid';
    end if;
    if wanted.status = 'voided' then
      raise exception 'This request was cancelled' using errcode = '22023';
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


-- ===== 8. The person who asked has seen the result =====

create function private.mark_lab_result_seen(request bigint)
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


-- ===== 9. Only the person who asked is alerted =====
-- When a request is completed, the phones and computers of the person who
-- asked get a notification, through the same Worker as Call attention.
-- The words never name the patient or the test.

create function private.push_lab_result()
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

revoke execute on function private.push_lab_result() from public, anon, authenticated;

create trigger lab_requests_push
  after update on public.lab_requests
  for each row execute function private.push_lab_result();


-- ===== 10. What the app may call =====

revoke execute on function private.request_lab(bigint, text[], text, text)                  from public, anon;
revoke execute on function private.pay_lab_request(bigint, numeric, public.payment_mode)     from public, anon;
revoke execute on function private.record_lab_results(bigint, bigint, jsonb)                from public, anon;
revoke execute on function private.mark_lab_result_seen(bigint)                             from public, anon;
grant  execute on function private.request_lab(bigint, text[], text, text)                  to authenticated;
grant  execute on function private.pay_lab_request(bigint, numeric, public.payment_mode)     to authenticated;
grant  execute on function private.record_lab_results(bigint, bigint, jsonb)                to authenticated;
grant  execute on function private.mark_lab_result_seen(bigint)                             to authenticated;

create function public.request_lab(patient bigint, wanted text[], request_note text, send_to text)
returns text language sql security invoker set search_path = ''
as $$ select private.request_lab(patient, wanted, request_note, send_to); $$;

create function public.pay_lab_request(request bigint, amount_paid numeric, paid_by public.payment_mode)
returns text language sql security invoker set search_path = ''
as $$ select private.pay_lab_request(request, amount_paid, paid_by); $$;

create function public.record_lab_results(request bigint, patient bigint, items jsonb)
returns text language sql security invoker set search_path = ''
as $$ select private.record_lab_results(request, patient, items); $$;

create function public.mark_lab_result_seen(request bigint)
returns void language sql security invoker set search_path = ''
as $$ select private.mark_lab_result_seen(request); $$;

revoke execute on function public.request_lab(bigint, text[], text, text)                  from public, anon;
revoke execute on function public.pay_lab_request(bigint, numeric, public.payment_mode)     from public, anon;
revoke execute on function public.record_lab_results(bigint, bigint, jsonb)                from public, anon;
revoke execute on function public.mark_lab_result_seen(bigint)                             from public, anon;
grant  execute on function public.request_lab(bigint, text[], text, text)                  to authenticated;
grant  execute on function public.pay_lab_request(bigint, numeric, public.payment_mode)     to authenticated;
grant  execute on function public.record_lab_results(bigint, bigint, jsonb)                to authenticated;
grant  execute on function public.mark_lab_result_seen(bigint)                             to authenticated;
