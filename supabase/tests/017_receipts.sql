-- =============================================================================
-- 017_receipts.sql: tests for receipt numbers and take_payment (123 part 2).
--
-- What this is: proves every payment gets an RCT number that cannot change;
-- the Front Desk takes a payment with lines the database adds up; the same
-- payment again within 3 minutes is taken once; a different one is taken;
-- a nurse cannot take payments or read them; nothing for somebody signed out.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d7', 'rc-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000d8', 'rc-nurse@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000d7', 'Rc Desk',  'rc-desk@test.rhema',  'front_desk'),
  ('00000000-0000-0000-0000-0000000000d8', 'Rc Nurse', 'rc-nurse@test.rhema', 'nurse');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Rc Made Up', '1990-01-01', 'female', '00000000-0000-0000-0000-0000000000d7');

create temporary table t (first bigint, second bigint);
grant select, insert, update on t to authenticated;
insert into t values (null, null);


-- ===== 1. The Front Desk takes a payment; the database adds the lines =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d7"}', true);
set local role authenticated;
update t set first = public.take_payment(
  (select id from public.patients where full_name = 'Rc Made Up'), 'consultation',
  '[{"label": "Consultation", "amount": 5000}, {"label": "Card", "amount": 1500}]'::jsonb, 'cash');
do $$
begin
  if (select amount from public.payments where id = (select first from t)) <> 6500 then
    raise exception 'FAIL 1: the total is not the sum of the lines';
  end if;
  if (select receipt_number from public.payments where id = (select first from t)) !~ '^RCT-[0-9]{6}$' then
    raise exception 'FAIL 1: the payment has no RCT receipt number';
  end if;
  if (select count(*) from public.payment_lines where payment_id = (select first from t)) <> 2 then
    raise exception 'FAIL 1: the lines were not kept';
  end if;
end $$;
\echo 'PASS 1: a payment with lines, added up, with an RCT number'


-- ===== 2. The same payment again is taken once; a different one is taken =====
update t set second = public.take_payment(
  (select id from public.patients where full_name = 'Rc Made Up'), 'consultation',
  '[{"label": "Card", "amount": 1500}, {"label": "Consultation", "amount": 5000}]'::jsonb, 'cash');
do $$
begin
  if (select second from t) <> (select first from t) then
    raise exception 'FAIL 2: a double tap took the money twice';
  end if;
  perform public.take_payment(
    (select id from public.patients where full_name = 'Rc Made Up'), 'scan',
    '[{"label": "Ultrasound", "amount": 8000}]'::jsonb, 'pos');
  if (select count(*) from public.payments) <> 2 then
    raise exception 'FAIL 2: expected two payments, got %', (select count(*) from public.payments);
  end if;
end $$;
\echo 'PASS 2: the same payment again is taken once; a different one is taken'

-- Four minutes later the same payment is a new payment (a second visit).
reset role;
update public.payments set received_at = now() - interval '4 minutes' where id = (select first from t);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d7"}', true);
set local role authenticated;
do $$
begin
  if public.take_payment(
       (select id from public.patients where full_name = 'Rc Made Up'), 'consultation',
       '[{"label": "Consultation", "amount": 5000}, {"label": "Card", "amount": 1500}]'::jsonb, 'cash')
     = (select first from t) then
    raise exception 'FAIL 2b: the same payment after 3 minutes was not taken';
  end if;
end $$;
\echo 'PASS 2b: after 3 minutes the same payment is a new payment'


-- ===== 3. A receipt number cannot change =====
do $$
begin
  begin
    update public.payments set receipt_number = 'RCT-999999' where id = (select first from t);
    raise exception 'FAIL 3: a receipt number was changed';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
reset role;
do $$
begin
  begin
    update public.payments set receipt_number = 'RCT-999999' where id = (select first from t);
    raise exception 'FAIL 3: even the owner changed a receipt number';
  exception when raise_exception then
    if sqlerrm <> 'A receipt number cannot be changed' then raise; end if;
  end;
end $$;
\echo 'PASS 3: a receipt number cannot change'


-- ===== 4. A nurse cannot take or read payments; nobody signed out =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d8"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.payments) <> 0 then
    raise exception 'FAIL 4: a nurse read payments';
  end if;
  begin
    perform public.take_payment(
      (select id from public.patients where full_name = 'Rc Made Up'), 'other',
      '[{"label": "Something", "amount": 100}]'::jsonb, 'cash');
    raise exception 'FAIL 4: a nurse took a payment';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if has_function_privilege('anon', 'public.take_payment(bigint, public.payment_purpose, jsonb, public.payment_mode)', 'execute') then
    raise exception 'FAIL 4: somebody not signed in may take payments';
  end if;
end $$;
\echo 'PASS 4: a nurse cannot take or read payments; nobody signed out'

rollback;
