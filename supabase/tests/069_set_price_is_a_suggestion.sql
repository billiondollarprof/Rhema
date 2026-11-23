-- =============================================================================
-- 069_set_price_is_a_suggestion.sql: tests for set_price_is_a_suggestion
-- (request 239, 2026-11-22).
--
-- What this proves:
--   1. The Front Desk pays a drug at a different price from the doctor's.
--   2. The Front Desk pays a lab test at a different price, line by line,
--      and a priced request as one total.
--   3. The Front Desk pays a bill at the amounts it typed; the bill's own
--      lines stay as the doctor wrote them; it is paid once; a nurse cannot
--      pay; a line of 0 is refused; a cancelled bill is not paid.
--   4. The old price check is gone.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000691', 't069-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000692', 't069-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000693', 't069-nurse@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000691', 'T69 Doctor', 't069-doctor@test.rhema', 'doctor',     true),
  ('00000000-0000-0000-0000-000000000692', 'T69 Desk',   't069-desk@test.rhema',   'front_desk', false),
  ('00000000-0000-0000-0000-000000000693', 'T69 Nurse',  't069-nurse@test.rhema',  'nurse',      true);
update public.staff set can_medical = false where id = '00000000-0000-0000-0000-000000000692';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T69 Patient', '1980-08-08', 'female', '00000000-0000-0000-0000-000000000692');

-- The doctor prescribes, requests tests and sends two bills, all priced.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000691"}', true);
set local role authenticated;
select public.prescribe((select id from public.patients where full_name = 'T69 Patient'),
  '[{"drug": "T69 Ceftriaxone", "strength": "1 g injection", "price": 2500}]', 'T69 drugs', 'front_desk');
select public.request_lab((select id from public.patients where full_name = 'T69 Patient'),
  array['Widal'], 'T69 lab lines', 'both', '{"Widal": 3000}');
select public.request_lab((select id from public.patients where full_name = 'T69 Patient'),
  array['Malaria parasite'], 'T69 lab total', 'both', '{"Malaria parasite": 1500}');
select public.add_bill((select id from public.patients where full_name = 'T69 Patient'),
  '[{"kind": "dressing", "item": "T69 Dressing", "amount": 4000},
    {"kind": "bed", "item": "T69 Bed fee", "amount": 6000}]', 'T69 bill');
select public.add_bill((select id from public.patients where full_name = 'T69 Patient'),
  '[{"kind": "catheter", "item": "T69 Catheter", "amount": 2000}]', 'T69 cancelled');
select public.void_bill((select id from public.bills where note = 'T69 cancelled'));
reset role;


-- ===== 1. A drug at a different price =====
do $$
declare wanted bigint := (select id from public.prescriptions where note = 'T69 drugs');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000692"}', true);
  set local role authenticated;
  if public.pay_prescription(wanted, '[{"label": "T69 Ceftriaxone 1 g injection", "amount": 2000}]', 'cash') <> 'paid' then
    raise exception 'FAIL 1: the Front Desk could not change the doctor''s drug price';
  end if;
  reset role;
  if (select p.amount from public.payments p join public.prescriptions r on r.payment_id = p.id where r.id = wanted) <> 2000 then
    raise exception 'FAIL 1: the payment is not the amount the Front Desk typed';
  end if;
end $$;
\echo 'PASS 1: the Front Desk pays a drug at a different price from the doctor''s'


-- ===== 2. Lab tests at a different price, by line and as one total =====
do $$
declare
  by_line bigint := (select id from public.lab_requests where note = 'T69 lab lines');
  as_total bigint := (select id from public.lab_requests where note = 'T69 lab total');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000692"}', true);
  set local role authenticated;
  if public.pay_lab_request_lines(by_line, '[{"label": "Widal", "amount": 2500}]', 'pos') <> 'paid' then
    raise exception 'FAIL 2: the Front Desk could not change the doctor''s lab price';
  end if;
  if public.pay_lab_request(as_total, 1200, 'cash') <> 'paid' then
    raise exception 'FAIL 2: a priced request could not be paid as one total';
  end if;
  reset role;
  if (select p.amount from public.payments p join public.lab_requests r on r.payment_id = p.id where r.id = by_line) <> 2500
     or (select p.amount from public.payments p join public.lab_requests r on r.payment_id = p.id where r.id = as_total) <> 1200 then
    raise exception 'FAIL 2: the payments are not the amounts the Front Desk typed';
  end if;
end $$;
\echo 'PASS 2: the Front Desk pays lab tests at its own price, by line or as one total'


-- ===== 3. A bill at the amounts the Front Desk typed =====
do $$
declare
  wanted bigint := (select id from public.bills where note = 'T69 bill');
  cancelled bigint := (select id from public.bills where note = 'T69 cancelled');
begin
  -- A nurse cannot pay.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000693"}', true);
  set local role authenticated;
  begin
    perform public.pay_bill(wanted, '[{"label": "T69 Dressing", "amount": 4000}]', 'cash');
    reset role;
    raise exception 'FAIL 3: a nurse paid a bill';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000692"}', true);
  set local role authenticated;
  -- A line of 0 is refused.
  begin
    perform public.pay_bill(wanted, '[{"label": "T69 Dressing", "amount": 0}]', 'cash');
    raise exception 'FAIL 3: a line of 0 was paid';
  exception when invalid_parameter_value then null;
  end;
  if public.pay_bill(wanted,
       '[{"label": "T69 Dressing", "amount": 3500}, {"label": "T69 Bed fee", "amount": 6000}]', 'transfer') <> 'paid' then
    raise exception 'FAIL 3: the Front Desk could not change a bill''s amount';
  end if;
  if public.pay_bill(wanted, '[{"label": "T69 Dressing", "amount": 3500}]', 'cash') <> 'already_paid' then
    raise exception 'FAIL 3: a bill was paid twice';
  end if;
  if public.pay_bill(cancelled, '[{"label": "T69 Catheter", "amount": 2000}]', 'cash') <> 'voided' then
    raise exception 'FAIL 3: a cancelled bill was paid';
  end if;
  reset role;
  if (select p.amount from public.payments p join public.bills b on b.payment_id = p.id where b.id = wanted) <> 9500
     or (select sum(amount) from public.bill_lines where bill_id = wanted) <> 10000
     or (select status from public.bills where id = wanted) <> 'paid'
     or (select status from public.bills where id = cancelled) <> 'voided'
     or (select count(*) from public.payments where purpose = 'bill'
         and patient_id = (select id from public.patients where full_name = 'T69 Patient')) <> 1 then
    raise exception 'FAIL 3: the bill payment is wrong, or the bill''s own lines changed';
  end if;
end $$;
\echo 'PASS 3: the Front Desk pays a bill at its own amounts, once; the bill stays as written'


-- ===== 4. The old price check is gone =====
do $$
begin
  if exists (select 1 from pg_proc where proname = 'check_set_prices') then
    raise exception 'FAIL 4: the old price check is still there';
  end if;
end $$;
\echo 'PASS 4: the old price check is gone'

rollback;
