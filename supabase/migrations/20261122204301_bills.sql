-- =============================================================================
-- 20261122204301_bills.sql
--
-- What this is: "Add a bill". A doctor or the matron bills a patient for a
-- procedure, an operation, the bed fee, a consultation, a dressing, a
-- catheter or anything else, each line with its amount. The Front Desk sees
-- it in "Bills to pay" and takes exactly that amount. A bill never expires.
--
-- Why: the director's voice note and Anthony, 2026-11-21 and 22 (request
-- 235, part 3): "bills/prices by the doctor; procedures, bed fee". The
-- batch was shown to him; his answers, 2026-11-22: "let everyone see the
-- bill", then "yes".
--
-- Rules:
--   - Adding a bill: a doctor or the matron (private.sets_prices, the same
--     rule as setting prices), 1 to 20 lines, each above 0. The same bill
--     by the same person for the same patient within 30 seconds is refused.
--   - Paying: the Front Desk only (private.can_take_payment). The amounts
--     come from the bill, never from the screen. Paid once only: the row is
--     locked while it is paid, and a paid or voided bill answers
--     already_paid or voided.
--   - Voiding: only the person who made it, and only before it is paid.
--   - Reading: every active member of staff (his decision, 2026-11-22).
--     Writing only through the functions here.
--   - "procedure" joins the price list and each person's own prices, so a
--     bill line can have a standard price and a last price.
--   - Every change goes in the activity log.
--
-- Never: let the Front Desk pay a different amount from the bill, or pay
-- one bill twice.
-- =============================================================================


-- ===== 1. "bill" as a kind of payment =====
-- An enum value cannot be used in the transaction that adds it. Nothing
-- below uses it at creation time (only inside plpgsql bodies, run later).
alter type public.payment_purpose add value if not exists 'bill';


-- ===== 2. The tables =====

-- One bill: whose, who made it, and where it is now.
create table public.bills (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients (id),
  note        text check (note is null or length(note) <= 500),
  status      text not null default 'awaiting_payment'
              check (status in ('awaiting_payment', 'paid', 'voided')),
  payment_id  bigint references public.payments (id),
  created_by  uuid not null default auth.uid() references public.staff (id),
  created_at  timestamptz not null default now(),
  voided_by   uuid references public.staff (id),
  voided_at   timestamptz
);

create index bills_patient_idx on public.bills (patient_id, created_at desc);
create index bills_to_pay_idx  on public.bills (created_at) where status = 'awaiting_payment';

-- Each line of a bill: what kind, its name, its amount.
create table public.bill_lines (
  id       bigint generated always as identity primary key,
  bill_id  bigint not null references public.bills (id),
  kind     text not null
           check (kind in ('procedure', 'operation', 'bed', 'consultation', 'dressing', 'catheter', 'other')),
  item     text not null check (length(trim(item)) between 2 and 120),
  amount   numeric(12, 2) not null check (amount > 0 and amount < 100000000)
);

create index bill_lines_bill_idx on public.bill_lines (bill_id);

-- Supabase gives every new table full rights. Take them all away first,
-- then give back only reading: every write goes through the functions below.
revoke all on public.bills, public.bill_lines from anon, authenticated;
alter table public.bills      enable row level security;
alter table public.bill_lines enable row level security;
grant select on public.bills, public.bill_lines to authenticated;


-- ===== 3. Who reads: every active member of staff =====
create policy bills_read on public.bills
  for select to authenticated
  using ((select private.is_active_staff()));

create policy bill_lines_read on public.bill_lines
  for select to authenticated
  using ((select private.is_active_staff()));


-- ===== 4. The activity log =====
create trigger bills_activity
  after insert or update on public.bills
  for each row execute function private.write_activity();
create trigger bill_lines_activity
  after insert or update on public.bill_lines
  for each row execute function private.write_activity();


-- ===== 5. "procedure" on the price list and in each person's own prices =====
alter table public.price_list drop constraint price_list_kind_check;
alter table public.price_list
  add constraint price_list_kind_check check (kind in ('card', 'consultation', 'lab_test', 'drug', 'procedure'));

alter table public.my_prices drop constraint my_prices_kind_check;
alter table public.my_prices
  add constraint my_prices_kind_check check (kind in ('drug', 'lab_test', 'procedure'));


-- ===== 6. Add a bill (a doctor or the matron) =====
-- lines: [{kind, item, amount}]. Answers sent, or already_sent.
create function private.add_bill(patient bigint, lines jsonb, bill_note text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  total numeric(12, 2);
  new_bill bigint;
begin
  if not (select private.sets_prices()) then
    raise exception 'Only a doctor or the matron adds a bill' using errcode = '42501';
  end if;
  if jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) not between 1 and 20 then
    raise exception 'Add between 1 and 20 lines' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(lines) line
    where coalesce(line ->> 'kind', '') not in
            ('procedure', 'operation', 'bed', 'consultation', 'dressing', 'catheter', 'other')
       or length(trim(coalesce(line ->> 'item', ''))) not between 2 and 120
       or coalesce((line ->> 'amount')::numeric, 0) <= 0
       or (line ->> 'amount')::numeric >= 100000000
  ) then
    raise exception 'Each line needs a kind, a name and an amount above 0' using errcode = '22023';
  end if;
  if bill_note is not null and length(bill_note) > 500 then
    raise exception 'The note is too long' using errcode = '22023';
  end if;
  if not exists (select 1 from public.patients where id = patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;

  select sum(round((line ->> 'amount')::numeric, 2)) into total from jsonb_array_elements(lines) line;

  -- Two taps at the same moment wait here for each other; the second finds
  -- the first and is refused.
  perform pg_advisory_xact_lock(hashtext('bill:' || me::text || ':' || patient::text));
  if exists (
    select 1 from public.bills b
    where b.created_by = me
      and b.patient_id = patient
      and b.created_at > now() - interval '30 seconds'
      and (select sum(l.amount) from public.bill_lines l where l.bill_id = b.id) = total
  ) then
    return 'already_sent';
  end if;

  insert into public.bills (patient_id, note, created_by)
  values (patient, nullif(trim(bill_note), ''), me)
  returning id into new_bill;

  insert into public.bill_lines (bill_id, kind, item, amount)
  select new_bill, line ->> 'kind', trim(line ->> 'item'), round((line ->> 'amount')::numeric, 2)
  from jsonb_array_elements(lines) line;

  -- This person's price for next time (request 235).
  insert into public.my_prices (staff_id, kind, item, amount)
  select me, 'procedure', lower(trim(line ->> 'item')), round((line ->> 'amount')::numeric, 2)
  from jsonb_array_elements(lines) line
  on conflict (staff_id, kind, item) do update set amount = excluded.amount, updated_at = now();

  return 'sent';
end;
$$;

revoke execute on function private.add_bill(bigint, jsonb, text) from public, anon;
grant  execute on function private.add_bill(bigint, jsonb, text) to authenticated;

create function public.add_bill(patient bigint, lines jsonb, bill_note text)
returns text
language sql
set search_path = ''
as $$ select private.add_bill(patient, lines, bill_note); $$;

revoke execute on function public.add_bill(bigint, jsonb, text) from public, anon;
grant  execute on function public.add_bill(bigint, jsonb, text) to authenticated;


-- ===== 7. Pay a bill (the Front Desk) =====
-- The amounts come from the bill. Answers paid, already_paid or voided.
create function private.pay_bill(bill bigint, paid_by public.payment_mode)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.bills;
  new_payment bigint;
begin
  if not (select private.can_take_payment()) then
    raise exception 'Only the Front Desk can record payments' using errcode = '42501';
  end if;
  -- Locked until this payment is saved, so two desks cannot both pay it.
  select * into wanted from public.bills where id = bill for update;
  if not found then
    raise exception 'No such bill' using errcode = '22023';
  end if;
  if wanted.status = 'voided' then
    return 'voided';
  end if;
  if wanted.status = 'paid' then
    return 'already_paid';
  end if;

  new_payment := private.record_payment_lines(
    wanted.patient_id,
    'bill'::public.payment_purpose,
    (select jsonb_agg(jsonb_build_object('label', l.item, 'amount', l.amount) order by l.id)
     from public.bill_lines l where l.bill_id = bill),
    paid_by);
  update public.bills set status = 'paid', payment_id = new_payment where id = bill;
  return 'paid';
end;
$$;

revoke execute on function private.pay_bill(bigint, public.payment_mode) from public, anon;
grant  execute on function private.pay_bill(bigint, public.payment_mode) to authenticated;

create function public.pay_bill(bill bigint, paid_by public.payment_mode)
returns text
language sql
set search_path = ''
as $$ select private.pay_bill(bill, paid_by); $$;

revoke execute on function public.pay_bill(bigint, public.payment_mode) from public, anon;
grant  execute on function public.pay_bill(bigint, public.payment_mode) to authenticated;


-- ===== 8. Void a bill (only the person who made it, before it is paid) =====
-- Answers voided, or already_paid.
create function private.void_bill(bill bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  wanted public.bills;
begin
  select * into wanted from public.bills where id = bill for update;
  if not found then
    raise exception 'No such bill' using errcode = '22023';
  end if;
  if wanted.created_by <> me or not (select private.is_active_staff()) then
    raise exception 'Only the person who made a bill can void it' using errcode = '42501';
  end if;
  if wanted.status = 'paid' then
    return 'already_paid';
  end if;
  if wanted.status = 'awaiting_payment' then
    update public.bills set status = 'voided', voided_by = me, voided_at = now() where id = bill;
  end if;
  return 'voided';
end;
$$;

revoke execute on function private.void_bill(bigint) from public, anon;
grant  execute on function private.void_bill(bigint) to authenticated;

create function public.void_bill(bill bigint)
returns text
language sql
set search_path = ''
as $$ select private.void_bill(bill); $$;

revoke execute on function public.void_bill(bigint) from public, anon;
grant  execute on function public.void_bill(bigint) to authenticated;


-- ===== 9. Standard prices take procedures too =====
-- The same as 20261122154048, with 'procedure' added in both.
create or replace function private.set_price(p_kind text, p_item text, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not (select private.is_admin()) then
    raise exception 'Only an admin sets prices.' using errcode = '42501';
  end if;
  -- Drugs too, since 2026-11-22 (request 235), and procedures (part 3).
  if p_kind not in ('card', 'consultation', 'lab_test', 'drug', 'procedure') then
    raise exception 'Unknown kind of price.';
  end if;
  if p_item is null or length(trim(p_item)) < 2 then
    raise exception 'Name the thing the price is for.';
  end if;

  if p_amount is null or p_amount = 0 then
    -- Removing is logged too: the row is changed first, then deleted.
    insert into public.activity_log (actor_id, action, table_name, record_id, changed_fields)
    select me, 'delete', 'price_list', id::text, array['amount']
    from public.price_list where kind = p_kind and lower(trim(item)) = lower(trim(p_item));
    delete from public.price_list where kind = p_kind and lower(trim(item)) = lower(trim(p_item));
    return;
  end if;

  insert into public.price_list (kind, item, amount, updated_by)
  values (p_kind, trim(p_item), round(p_amount, 2), me)
  on conflict (kind, lower(trim(item))) do update
    set amount = excluded.amount, updated_by = me, updated_at = now()
    where public.price_list.amount is distinct from excluded.amount;
end;
$$;

create or replace function private.make_standard_prices(prices jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  changed integer;
begin
  if not ((select private.sets_prices()) or (select private.is_admin())) then
    raise exception 'Only a doctor, the matron or an admin sets standard prices' using errcode = '42501';
  end if;
  if jsonb_typeof(prices) <> 'array' or jsonb_array_length(prices) not between 1 and 40 then
    raise exception 'Choose between 1 and 40 prices' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(prices) price
    where coalesce(price ->> 'kind', '') not in ('drug', 'lab_test', 'procedure')
       or length(trim(coalesce(price ->> 'item', ''))) not between 2 and 120
       or coalesce((price ->> 'amount')::numeric, 0) <= 0
       or (price ->> 'amount')::numeric >= 100000000
  ) then
    raise exception 'Each price needs a drug, test or procedure and an amount above 0' using errcode = '22023';
  end if;

  insert into public.price_list (kind, item, amount, updated_by)
  select price ->> 'kind', trim(price ->> 'item'), round((price ->> 'amount')::numeric, 2), me
  from jsonb_array_elements(prices) price
  on conflict (kind, lower(trim(item))) do update
    set amount = excluded.amount, updated_by = me, updated_at = now()
    where public.price_list.amount is distinct from excluded.amount;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
