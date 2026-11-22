-- =============================================================================
-- 20261122051713_doctor_sets_prices.sql
--
-- What this is: the doctor (or the matron, for lab tests) sets the price of
-- each drug in a prescription and each test in a lab request. The Front Desk
-- collects exactly that and cannot change it. Each person's own last price
-- for a drug or test is kept, to fill in next time.
--
-- Why: the director's voice note and Anthony, 2026-11-21 and 22 (request
-- 235, part 2): "it's actually the doctor that decides how much a drug is
-- sold, how much a lab charges... the system should be able to
-- automatically calculate the total... So the front desk sees it." "only
-- doctors and matron that sets prices." "The front desk cannot change the
-- price... can go and ask the doctor." "record that price in case of next
-- time... so that particular consultant can use it again."
--
-- Rules:
--   - prescription_items.price and lab_requests.prices: optional. A line
--     without a price is priced at the Front Desk, as before.
--   - Prescribing stays doctors only. Prices on a lab request: a doctor or
--     the matron only (sets_prices).
--   - Paying: every line the doctor priced must come in with the same name
--     and amount, or the payment is refused (check_set_prices). The older
--     one-total lab payment refuses a priced request.
--   - my_prices: each person reads only their own; only these functions
--     write it.
--
-- Never: let the Front Desk pay a different amount for a line the doctor
-- priced, or let anybody read another person's own prices.
-- =============================================================================


-- ===== 1. Where the prices are kept =====
alter table public.prescription_items
  add column price numeric(12, 2) check (price > 0 and price < 100000000);
alter table public.lab_requests
  add column prices jsonb check (prices is null or jsonb_typeof(prices) = 'object');


-- ===== 2. Each person's own last price, for next time =====
create table public.my_prices (
  staff_id   uuid not null references public.staff (id),
  kind       text not null check (kind in ('drug', 'lab_test')),
  item       text not null check (length(item) between 2 and 200),
  amount     numeric(12, 2) not null check (amount > 0 and amount < 100000000),
  updated_at timestamptz not null default now(),
  primary key (staff_id, kind, item)
);

revoke all on public.my_prices from anon, authenticated;
alter table public.my_prices enable row level security;
grant select on public.my_prices to authenticated;
create policy my_prices_read on public.my_prices for select to authenticated
  using (staff_id = (select auth.uid()));


-- ===== 3. Who sets prices: a doctor or the matron =====
create function private.sets_prices()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and role in ('doctor', 'matron')
  );
$$;

revoke execute on function private.sets_prices() from public, anon;
grant  execute on function private.sets_prices() to authenticated;


-- ===== 4. The Front Desk pays what the doctor set =====
-- set_prices: [{label, amount}] from the doctor. lines: what is being paid.
-- Each priced line must be there once, with the same name and amount.
create function private.check_set_prices(set_prices jsonb, lines jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1 from jsonb_array_elements(set_prices) wanted
    where not exists (
      select 1 from jsonb_array_elements(lines) line
      where lower(trim(line ->> 'label')) = lower(trim(wanted ->> 'label'))
        and round((line ->> 'amount')::numeric, 2) = round((wanted ->> 'amount')::numeric, 2)
    )
  ) then
    raise exception 'price_changed: the doctor set this price' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function private.check_set_prices(jsonb, jsonb) from public, anon, authenticated;


-- ===== 5. Prescribe, with a price for each drug (doctors only, as before) =====
create or replace function private.prescribe(patient bigint, items jsonb, prescription_note text, send_to text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  drugs text;
begin
  if not (select private.is_doctor()) then
    raise exception 'Only a doctor can prescribe' using errcode = '42501';
  end if;
  if send_to not in ('front_desk', 'pharmacy') then
    raise exception 'Send it to the Front Desk or the Pharmacy' using errcode = '22023';
  end if;
  if not exists (select 1 from public.patients where id = patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 20 then
    raise exception 'Add between 1 and 20 drugs' using errcode = '22023';
  end if;
  -- A price, when given, is above 0 and below 100,000,000 naira (request 235).
  if exists (
    select 1 from jsonb_array_elements(items) item
    where nullif(item ->> 'price', '') is not null
      and ((item ->> 'price')::numeric <= 0 or (item ->> 'price')::numeric >= 100000000)
  ) then
    raise exception 'A price is above 0' using errcode = '22023';
  end if;

  -- Two taps at the same moment wait here for each other.
  perform pg_advisory_xact_lock(hashtext('prescribe:' || (select auth.uid())::text || ':' || patient::text));
  select string_agg(lower(trim(item ->> 'drug')), '|' order by lower(trim(item ->> 'drug')))
  into drugs from jsonb_array_elements(items) item;
  if exists (
    select 1 from public.prescriptions p
    where p.prescribed_by = (select auth.uid())
      and p.patient_id = patient
      and p.prescribed_at > now() - interval '30 seconds'
      and (select string_agg(lower(i.drug), '|' order by lower(i.drug))
           from public.prescription_items i where i.prescription_id = p.id) = drugs
  ) then
    return 'already_sent';
  end if;

  insert into public.prescriptions (patient_id, note, status)
  values (patient, nullif(trim(prescription_note), ''),
          case send_to when 'front_desk' then 'awaiting_payment'::public.prescription_status
                       else 'awaiting_dispense'::public.prescription_status end)
  returning id into new_id;

  insert into public.prescription_items (prescription_id, drug, strength, dose, how_often, days, quantity, note, price)
  select new_id, trim(item ->> 'drug'),
         nullif(trim(item ->> 'strength'), ''), nullif(trim(item ->> 'dose'), ''),
         nullif(trim(item ->> 'how_often'), ''), (item ->> 'days')::integer,
         nullif(trim(item ->> 'quantity'), ''), nullif(trim(item ->> 'note'), ''),
         round(nullif(item ->> 'price', '')::numeric, 2)
  from jsonb_array_elements(items) item;

  -- This doctor's price for next time (request 235: "record that price in
  -- case of next time... so that particular consultant can use it again").
  insert into public.my_prices (staff_id, kind, item, amount)
  select (select auth.uid()), 'drug',
         lower(trim(concat_ws(' ', trim(item ->> 'drug'), nullif(trim(item ->> 'strength'), '')))),
         round((item ->> 'price')::numeric, 2)
  from jsonb_array_elements(items) item
  where nullif(item ->> 'price', '') is not null
  on conflict (staff_id, kind, item) do update set amount = excluded.amount, updated_at = now();
  return 'sent';
end;
$$;


-- ===== 6. Request a lab test, with a price for each test =====
-- The four-part request_lab stays for screens that send no prices.
create function private.request_lab(patient bigint, wanted text[], request_note text, send_to text, test_prices jsonb)
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
  -- front_desk: the Front Desk only; the Lab gets it once it is paid.
  -- both: the Front Desk and the Lab at once. laboratory: what an older
  -- screen sends for "Straight to the lab", now the same as both, because
  -- every request reaches the Front Desk (request 233).
  if send_to not in ('front_desk', 'both', 'laboratory') then
    raise exception 'Send it to the Front Desk, or to the Front Desk and the Lab' using errcode = '22023';
  end if;
  -- Prices: only a doctor or the matron sets them (request 235: "only doctors
  -- and matron that sets prices"); each above 0, for a test asked for.
  if test_prices is not null and test_prices <> '{}'::jsonb then
    if not (select private.sets_prices()) then
      raise exception 'Only a doctor or the matron sets prices' using errcode = '42501';
    end if;
    if jsonb_typeof(test_prices) <> 'object' or exists (
      select 1 from jsonb_each_text(test_prices) price
      where price.value::numeric <= 0 or price.value::numeric >= 100000000
         or not (trim(price.key) = any (select trim(test) from unnest(wanted) test))
    ) then
      raise exception 'A price is above 0, for a test asked for' using errcode = '22023';
    end if;
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

  -- Every request waits for payment at the Front Desk; the Lab may still
  -- do the test before it is paid (request 232).
  insert into public.lab_requests (patient_id, tests, note, status, sent_to_lab, prices)
  values (
    patient, clean, nullif(trim(request_note), ''),
    'awaiting_payment'::public.lab_status,
    send_to <> 'front_desk',
    -- Keys tidied the same way as the tests (no spaces at the ends).
    (select jsonb_object_agg(trim(price.key), round(price.value::numeric, 2))
     from jsonb_each_text(coalesce(test_prices, '{}'::jsonb)) price)
  );

  -- This person's price for next time (request 235).
  insert into public.my_prices (staff_id, kind, item, amount)
  select (select auth.uid()), 'lab_test', lower(trim(price.key)), round(price.value::numeric, 2)
  from jsonb_each_text(coalesce(test_prices, '{}'::jsonb)) price
  on conflict (staff_id, kind, item) do update set amount = excluded.amount, updated_at = now();
  return 'sent';
end;
$$;

revoke execute on function private.request_lab(bigint, text[], text, text, jsonb) from public, anon;
grant  execute on function private.request_lab(bigint, text[], text, text, jsonb) to authenticated;

create function public.request_lab(patient bigint, wanted text[], request_note text, send_to text, test_prices jsonb)
returns text
language sql
set search_path = ''
as $$ select private.request_lab(patient, wanted, request_note, send_to, test_prices); $$;

revoke execute on function public.request_lab(bigint, text[], text, text, jsonb) from public, anon;
grant  execute on function public.request_lab(bigint, text[], text, text, jsonb) to authenticated;


-- ===== 7. Paying checks the doctor's prices =====
create or replace function private.pay_prescription(prescription bigint, lines jsonb, paid_by public.payment_mode)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.prescriptions;
  new_payment bigint;
begin
  if not (select private.can_take_payment()) then
    raise exception 'Only the Front Desk can record payments' using errcode = '42501';
  end if;
  select * into wanted from public.prescriptions where id = prescription for update;
  if not found then
    raise exception 'No such prescription' using errcode = '22023';
  end if;
  if wanted.payment_id is not null or wanted.status = 'voided' then
    return 'already_paid';
  end if;
  -- The prices the doctor set are not changed at the Front Desk (request 235).
  perform private.check_set_prices(
    (select coalesce(jsonb_agg(jsonb_build_object(
       'label', concat_ws(' ', i.drug, i.strength), 'amount', i.price)), '[]'::jsonb)
     from public.prescription_items i
     where i.prescription_id = prescription and i.price is not null),
    lines);
  new_payment := private.record_payment_lines(wanted.patient_id, 'drugs', lines, paid_by);
  if wanted.status = 'awaiting_payment' then
    -- Waiting for payment: now the Pharmacy may dispense.
    update public.prescriptions set status = 'awaiting_dispense', payment_id = new_payment
    where id = prescription;
  else
    -- Sent straight to the Pharmacy: only the money is recorded.
    update public.prescriptions set payment_id = new_payment where id = prescription;
  end if;
  return 'paid';
end;
$$;

create or replace function private.pay_lab_request_lines(request bigint, lines jsonb, paid_by public.payment_mode)
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
  select * into wanted from public.lab_requests where id = request for update;
  if not found then
    raise exception 'No such lab request' using errcode = '22023';
  end if;
  if wanted.payment_id is not null or wanted.status = 'voided' then
    return 'already_paid';
  end if;
  -- The prices the doctor set are not changed at the Front Desk (request 235).
  perform private.check_set_prices(
    (select coalesce(jsonb_agg(jsonb_build_object('label', price.key, 'amount', price.value)), '[]'::jsonb)
     from jsonb_each(coalesce(wanted.prices, '{}'::jsonb)) price),
    lines);
  new_payment := private.record_payment_lines(wanted.patient_id, 'lab_test', lines, paid_by);
  if wanted.status = 'awaiting_payment' then
    -- Waiting for payment: now the Lab may take the sample.
    update public.lab_requests set status = 'awaiting_test', payment_id = new_payment where id = request;
  else
    -- Sent straight to the Lab: only the money is recorded.
    update public.lab_requests set payment_id = new_payment where id = request;
  end if;
  return 'paid';
end;
$$;


-- ===== 8. The older one-total lab payment: never for a priced request =====
create or replace function private.pay_lab_request(request bigint, amount_paid numeric, paid_by public.payment_mode)
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
  -- A request the doctor priced is paid line by line, at the doctor's prices
  -- (pay_lab_request_lines), never as one typed total (request 235).
  if wanted.prices is not null and wanted.prices <> '{}'::jsonb then
    raise exception 'price_changed: the doctor set this price' using errcode = '22023';
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
