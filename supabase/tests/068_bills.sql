-- =============================================================================
-- 068_bills.sql: tests for bills (request 235, part 3, 2026-11-22).
--
-- What this proves:
--   1. A doctor adds a bill; its lines and the doctor's own prices are kept;
--      the same bill again within 30 seconds is refused; a different one is not.
--   2. The matron can add a bill; a nurse, the Front Desk, the Pharmacy and
--      the Lab cannot.
--   3. A wrong kind, no name, an amount of 0, no lines or 21 lines is refused.
--   4. Every active member of staff reads bills; a deactivated one does not;
--      nobody writes to the tables directly.
--   5. The Front Desk pays the bill, once; a nurse cannot pay. (Since
--      20261123082024 it sends the amounts, which it may change: test 069.)
--   6. Only the person who made a bill voids it, and only before payment;
--      a voided bill is not paid.
--   7. Procedures take standard prices (a doctor, and the admin's Prices tab).
--   8. Adding and paying are in the activity log.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000681', 't068-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000682', 't068-matron@test.rhema'),
  ('00000000-0000-0000-0000-000000000683', 't068-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000684', 't068-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000685', 't068-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-000000000686', 't068-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000687', 't068-admin@test.rhema'),
  ('00000000-0000-0000-0000-000000000688', 't068-gone@test.rhema'),
  ('00000000-0000-0000-0000-000000000689', 't068-doctor2@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000681', 'T68 Doctor',   't068-doctor@test.rhema',   'doctor',     true),
  ('00000000-0000-0000-0000-000000000682', 'T68 Matron',   't068-matron@test.rhema',   'matron',     true),
  ('00000000-0000-0000-0000-000000000683', 'T68 Nurse',    't068-nurse@test.rhema',    'nurse',      true),
  ('00000000-0000-0000-0000-000000000684', 'T68 Desk',     't068-desk@test.rhema',     'front_desk', false),
  ('00000000-0000-0000-0000-000000000685', 'T68 Pharmacy', 't068-pharmacy@test.rhema', 'pharmacy',   false),
  ('00000000-0000-0000-0000-000000000686', 'T68 Lab',      't068-lab@test.rhema',      'laboratory', false),
  ('00000000-0000-0000-0000-000000000687', 'T68 Admin',    't068-admin@test.rhema',    'admin',      false),
  ('00000000-0000-0000-0000-000000000688', 'T68 Gone',     't068-gone@test.rhema',     'nurse',      true),
  ('00000000-0000-0000-0000-000000000689', 'T68 Doctor 2', 't068-doctor2@test.rhema',  'doctor',     true);
update public.staff set can_medical = false
 where id in ('00000000-0000-0000-0000-000000000684', '00000000-0000-0000-0000-000000000685',
              '00000000-0000-0000-0000-000000000686', '00000000-0000-0000-0000-000000000687');
update public.staff set can_admin = true where id = '00000000-0000-0000-0000-000000000687';
update public.staff set is_active = false where id = '00000000-0000-0000-0000-000000000688';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T68 Patient', '1970-07-07', 'male', '00000000-0000-0000-0000-000000000684');


-- ===== 1. A doctor adds a bill =====
do $$
declare
  patient bigint := (select id from public.patients where full_name = 'T68 Patient');
  answer text;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000681"}', true);
  set local role authenticated;
  answer := public.add_bill(patient,
    '[{"kind": "procedure", "item": "T68 Wound suturing", "amount": 15000},
      {"kind": "bed", "item": "T68 Bed fee, 2 days", "amount": 10000}]', 'T68 bill one');
  if answer <> 'sent' then
    raise exception 'FAIL 1: the bill was not sent (%)', answer;
  end if;
  -- The same bill again at once: refused.
  answer := public.add_bill(patient,
    '[{"kind": "procedure", "item": "T68 Wound suturing", "amount": 15000},
      {"kind": "bed", "item": "T68 Bed fee, 2 days", "amount": 10000}]', 'T68 bill one');
  if answer <> 'already_sent' then
    raise exception 'FAIL 1: the same bill twice was not refused (%)', answer;
  end if;
  -- A different bill: allowed.
  answer := public.add_bill(patient, '[{"kind": "dressing", "item": "T68 Dressing", "amount": 2000}]', null);
  if answer <> 'sent' then
    raise exception 'FAIL 1: a different bill was refused (%)', answer;
  end if;
  reset role;
  if (select count(*) from public.bills where patient_id = patient) <> 2
     or (select sum(l.amount) from public.bill_lines l join public.bills b on b.id = l.bill_id
         where b.note = 'T68 bill one') <> 25000
     or (select status from public.bills where note = 'T68 bill one') <> 'awaiting_payment' then
    raise exception 'FAIL 1: the bill or its lines were not kept as sent';
  end if;
  if (select amount from public.my_prices where staff_id = '00000000-0000-0000-0000-000000000681'
      and kind = 'procedure' and item = 't68 wound suturing') <> 15000 then
    raise exception 'FAIL 1: the doctor''s price was not kept for next time';
  end if;
end $$;
\echo 'PASS 1: a doctor adds a bill; the same bill twice is refused'


-- ===== 2. The matron can; others cannot =====
do $$
declare
  patient bigint := (select id from public.patients where full_name = 'T68 Patient');
  who text;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000682"}', true);
  set local role authenticated;
  if public.add_bill(patient, '[{"kind": "catheter", "item": "T68 Catheter", "amount": 3000}]', 'T68 matron') <> 'sent' then
    raise exception 'FAIL 2: the matron could not add a bill';
  end if;
  reset role;
  foreach who in array array['000000000683', '000000000684', '000000000685', '000000000686'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    begin
      perform public.add_bill(patient, '[{"kind": "other", "item": "T68 Not allowed", "amount": 100}]', null);
      reset role;
      raise exception 'FAIL 2: % added a bill', who;
    exception when insufficient_privilege then
      reset role;
    end;
  end loop;
end $$;
\echo 'PASS 2: the matron adds a bill; a nurse, the Front Desk, the Pharmacy and the Lab cannot'


-- ===== 3. Bad bills are refused =====
do $$
declare
  patient bigint := (select id from public.patients where full_name = 'T68 Patient');
  bad text;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000681"}', true);
  foreach bad in array array[
    '[{"kind": "card", "item": "T68 Card", "amount": 1000}]',
    '[{"kind": "procedure", "item": " ", "amount": 1000}]',
    '[{"kind": "procedure", "item": "T68 Zero", "amount": 0}]',
    '[]',
    (select jsonb_agg(jsonb_build_object('kind', 'other', 'item', 'T68 line ' || n, 'amount', 10))::text
     from generate_series(1, 21) n)
  ] loop
    set local role authenticated;
    begin
      perform public.add_bill(patient, bad::jsonb, null);
      reset role;
      raise exception 'FAIL 3: this was saved: %', left(bad, 80);
    exception when invalid_parameter_value then
      reset role;
    end;
  end loop;
end $$;
\echo 'PASS 3: a wrong kind, no name, 0, no lines or 21 lines is refused'


-- ===== 4. Everyone reads; a deactivated person does not; no direct writes =====
do $$
declare who text;
begin
  foreach who in array array['000000000683', '000000000684', '000000000685', '000000000686', '000000000687'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    if (select count(*) from public.bills where note like 'T68%') < 2
       or (select count(*) from public.bill_lines where item like 'T68%') < 4 then
      reset role;
      raise exception 'FAIL 4: % cannot read the bills', who;
    end if;
    reset role;
  end loop;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000688"}', true);
  set local role authenticated;
  if (select count(*) from public.bills) <> 0 or (select count(*) from public.bill_lines) <> 0 then
    reset role;
    raise exception 'FAIL 4: a deactivated person reads bills';
  end if;
  reset role;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000681"}', true);
  set local role authenticated;
  begin
    update public.bill_lines set amount = 1 where item = 'T68 Wound suturing';
    reset role;
    raise exception 'FAIL 4: a bill line was changed directly';
  exception when insufficient_privilege then
    reset role;
  end;
  set local role authenticated;
  begin
    insert into public.bills (patient_id) select id from public.patients where full_name = 'T68 Patient';
    reset role;
    raise exception 'FAIL 4: a bill was written directly';
  exception when insufficient_privilege then
    reset role;
  end;
end $$;
\echo 'PASS 4: every active member of staff reads bills; nobody writes them directly'


-- ===== 5. The Front Desk pays the bill's amounts, once =====
do $$
declare wanted bigint := (select id from public.bills where note = 'T68 bill one');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000683"}', true);
  set local role authenticated;
  begin
    perform public.pay_bill(wanted, '[{"label": "T68 Wound suturing", "amount": 15000}]', 'cash');
    reset role;
    raise exception 'FAIL 5: a nurse paid a bill';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000684"}', true);
  set local role authenticated;
  if public.pay_bill(wanted, '[{"label": "T68 Wound suturing", "amount": 15000}, {"label": "T68 Bed fee, 2 days", "amount": 10000}]', 'pos') <> 'paid' then
    raise exception 'FAIL 5: the Front Desk could not pay the bill';
  end if;
  if public.pay_bill(wanted, '[{"label": "T68 Wound suturing", "amount": 15000}]', 'pos') <> 'already_paid' then
    raise exception 'FAIL 5: the bill was paid twice';
  end if;
  reset role;
  if (select p.amount from public.payments p join public.bills b on b.payment_id = p.id where b.id = wanted) <> 25000
     or (select p.purpose::text from public.payments p join public.bills b on b.payment_id = p.id where b.id = wanted) <> 'bill'
     or (select count(*) from public.payment_lines l join public.bills b on b.payment_id = l.payment_id where b.id = wanted) <> 2
     or (select status from public.bills where id = wanted) <> 'paid'
     or (select count(*) from public.payments where purpose = 'bill'
         and patient_id = (select id from public.patients where full_name = 'T68 Patient')) <> 1 then
    raise exception 'FAIL 5: the payment is not the bill''s total, its lines, or was taken twice';
  end if;
end $$;
\echo 'PASS 5: the Front Desk pays the bill, once; a nurse cannot'


-- ===== 6. Voiding: the person who made it, before payment =====
do $$
declare
  paid_one bigint := (select id from public.bills where note = 'T68 bill one');
  open_one bigint := (select id from public.bills where note = 'T68 matron');
begin
  -- Another doctor cannot void the matron's bill.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000689"}', true);
  set local role authenticated;
  begin
    perform public.void_bill(open_one);
    reset role;
    raise exception 'FAIL 6: another doctor voided the matron''s bill';
  exception when insufficient_privilege then
    reset role;
  end;
  -- The matron voids her own.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000682"}', true);
  set local role authenticated;
  if public.void_bill(open_one) <> 'voided' then
    raise exception 'FAIL 6: the matron could not void her own bill';
  end if;
  reset role;
  -- The doctor cannot void a paid bill.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000681"}', true);
  set local role authenticated;
  if public.void_bill(paid_one) <> 'already_paid' then
    raise exception 'FAIL 6: a paid bill was voided';
  end if;
  reset role;
  -- A voided bill is not paid.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000684"}', true);
  set local role authenticated;
  if public.pay_bill(open_one, '[{"label": "T68 Catheter", "amount": 3000}]', 'cash') <> 'voided' then
    raise exception 'FAIL 6: a voided bill was paid';
  end if;
  reset role;
  if (select status from public.bills where id = open_one) <> 'voided'
     or (select status from public.bills where id = paid_one) <> 'paid'
     or (select voided_by from public.bills where id = open_one) <> '00000000-0000-0000-0000-000000000682' then
    raise exception 'FAIL 6: the bills are not as they should be after voiding';
  end if;
end $$;
\echo 'PASS 6: only the person who made a bill voids it, and only before payment'


-- ===== 7. Procedures take standard prices =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000681"}', true);
set local role authenticated;
select public.make_standard_prices('[{"kind": "procedure", "item": "T68 Wound suturing", "amount": 16000}]');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000687"}', true);
set local role authenticated;
select public.set_price('procedure', 'T68 Bed fee per day', 5000);
reset role;
do $$
begin
  if (select amount from public.price_list where kind = 'procedure' and item = 'T68 Wound suturing') <> 16000
     or (select amount from public.price_list where kind = 'procedure' and item = 'T68 Bed fee per day') <> 5000 then
    raise exception 'FAIL 7: a procedure price was not saved as standard';
  end if;
end $$;
\echo 'PASS 7: procedures take standard prices'


-- ===== 8. The activity log =====
do $$
begin
  if (select count(*) from public.activity_log where table_name = 'bills' and action = 'insert'
      and patient_id = (select id from public.patients where full_name = 'T68 Patient')) < 3
     or not exists (select 1 from public.activity_log where table_name = 'bills' and action = 'update'
                    and 'payment_id' = any (changed_fields))
     or (select count(*) from public.activity_log where table_name = 'bill_lines' and action = 'insert') < 4 then
    raise exception 'FAIL 8: adding or paying a bill is not in the activity log';
  end if;
end $$;
\echo 'PASS 8: adding and paying bills are in the activity log'

rollback;
