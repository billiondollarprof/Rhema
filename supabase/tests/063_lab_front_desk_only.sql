-- =============================================================================
-- 063_lab_front_desk_only.sql: tests for lab_front_desk_only (request 233,
-- 2026-11-20).
--
-- What this proves:
--   1. Front Desk only: waiting for payment, not sent to the Lab.
--   2. Front Desk and Lab: waiting for payment, sent to the Lab.
--   3. An older screen's "laboratory" is the same as both; anything else is
--      refused.
--   4. Paying the Front Desk only one moves it to the Lab's work
--      (awaiting_test).
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000631', 't063-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000632', 't063-doctor@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000631', 'T63 Desk',   't063-desk@test.rhema',   'front_desk', false),
  ('00000000-0000-0000-0000-000000000632', 'T63 Doctor', 't063-doctor@test.rhema', 'doctor',     true);
update public.staff set can_medical = false where id = '00000000-0000-0000-0000-000000000631';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T63 Patient', '1979-07-07', 'male', '00000000-0000-0000-0000-000000000631');


-- ===== 1 to 3. The three ways in =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000632"}', true);
set local role authenticated;
do $$
declare patient bigint := (select id from public.patients where full_name = 'T63 Patient');
begin
  perform public.request_lab(patient, array['Widal'], 'T63 desk only', 'front_desk');
  perform public.request_lab(patient, array['Full Blood Count'], 'T63 both', 'both');
  perform public.request_lab(patient, array['Urinalysis'], 'T63 old screen', 'laboratory');
  begin
    perform public.request_lab(patient, array['Genotype'], 'T63 nowhere', 'pharmacy');
    raise exception 'FAIL 3: a request was sent somewhere that is not allowed';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
do $$
begin
  if (select status::text || sent_to_lab::text from public.lab_requests where note = 'T63 desk only')
     <> 'awaiting_paymentfalse' then
    raise exception 'FAIL 1: Front Desk only is not waiting for payment, or reached the Lab';
  end if;
  if (select status::text || sent_to_lab::text from public.lab_requests where note = 'T63 both')
     <> 'awaiting_paymenttrue' then
    raise exception 'FAIL 2: Front Desk and Lab is not waiting for payment, or missed the Lab';
  end if;
  if (select status::text || sent_to_lab::text from public.lab_requests where note = 'T63 old screen')
     <> 'awaiting_paymenttrue' then
    raise exception 'FAIL 3: an older screen''s request did not go to both';
  end if;
end $$;
\echo 'PASS 1: Front Desk only waits for payment and is not sent to the Lab'
\echo 'PASS 2: Front Desk and Lab waits for payment and is sent to the Lab'
\echo 'PASS 3: an older screen goes to both; anywhere else is refused'


-- ===== 4. Paid: it moves to the Lab's work =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000631"}', true);
set local role authenticated;
select public.pay_lab_request_lines((select id from public.lab_requests where note = 'T63 desk only'),
  '[{"label": "Widal", "amount": 3000}]', 'cash');
reset role;
do $$
begin
  if (select status from public.lab_requests where note = 'T63 desk only') <> 'awaiting_test' then
    raise exception 'FAIL 4: paying did not move it to the Lab''s work';
  end if;
end $$;
\echo 'PASS 4: paid, it moves to the Lab''s work'

rollback;
