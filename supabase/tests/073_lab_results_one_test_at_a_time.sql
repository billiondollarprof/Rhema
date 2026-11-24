-- =============================================================================
-- 073_lab_results_one_test_at_a_time.sql: tests for request 240h
-- (2026-11-24).
--
-- What this proves:
--   1. The Lab sends one test of three: it is saved, the request stays open,
--      the doctor is told (results_at, an alert) and sees it as ready.
--   2. The same test again is not saved twice; a test not on the request is
--      refused; nothing typed is refused; a nurse cannot send.
--   3. The doctor marks it seen; the next send tells the doctor again.
--   4. The last test completes the request; the alert says it is ready.
--   5. A missed result added later completes a request only when every
--      test has one.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000731', 't073-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000732', 't073-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000733', 't073-nurse@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000731', 'T73 Doctor', 't073-doctor@test.rhema', 'doctor',     true),
  ('00000000-0000-0000-0000-000000000732', 'T73 Lab',    't073-lab@test.rhema',    'laboratory', false),
  ('00000000-0000-0000-0000-000000000733', 'T73 Nurse',  't073-nurse@test.rhema',  'nurse',      true);
update public.staff set can_medical = false where id = '00000000-0000-0000-0000-000000000732';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T73 Patient', '1975-07-07', 'female', '00000000-0000-0000-0000-000000000731');

-- The alert stand-ins: the Worker address, and the doctor's phone.
select vault.create_secret('https://push-test.invalid', 'rhema_push_url');
select vault.create_secret('test-secret-not-real', 'rhema_push_secret');
insert into public.push_devices (staff_id, endpoint, p256dh, auth_key) values
  ('00000000-0000-0000-0000-000000000731', 'https://push.example/t73-phone', repeat('k', 87), repeat('a', 22));

-- The doctor asks for three tests, and one more request with two.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000731"}', true);
set local role authenticated;
select public.request_lab((select id from public.patients where full_name = 'T73 Patient'),
  array['Widal', 'Full Blood Count', 'Malaria test'], 'T73 three', 'both', null);
select public.request_lab((select id from public.patients where full_name = 'T73 Patient'),
  array['Urinalysis', 'Genotype'], 'T73 two', 'both', null);
reset role;
delete from net.http_request_queue;


-- ===== 1. One test of three =====
do $$
declare wanted bigint := (select id from public.lab_requests where note = 'T73 three');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000732"}', true);
  set local role authenticated;
  if public.record_lab_results(wanted, null,
       '[{"test": "Widal", "result": "Negative"},
         {"test": "Full Blood Count", "result": ""},
         {"test": "Malaria test", "result": "  "}]') <> 'saved' then
    raise exception 'FAIL 1: one result of three was not saved';
  end if;
  reset role;
  if (select status from public.lab_requests where id = wanted) = 'completed'
     or (select results_at from public.lab_requests where id = wanted) is null
     or (select count(*) from public.lab_results where request_id = wanted) <> 1 then
    raise exception 'FAIL 1: the request closed, or the send was not noted, or not one result';
  end if;
  if (select count(*) from net.http_request_queue) <> 1
     or (select convert_from(body, 'UTF8') from net.http_request_queue limit 1) not like '%pending%' then
    raise exception 'FAIL 1: the doctor was not alerted that some results are ready';
  end if;
end $$;
\echo 'PASS 1: one test of three is sent; the request stays open; the doctor is told'


-- ===== 2. Not twice; only the request's tests; something typed; the Lab only =====
do $$
declare wanted bigint := (select id from public.lab_requests where note = 'T73 three');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000732"}', true);
  set local role authenticated;
  if public.record_lab_results(wanted, null, '[{"test": "Widal", "result": "Positive"}]') <> 'already_done' then
    raise exception 'FAIL 2: a test with a result took a second one';
  end if;
  begin
    perform public.record_lab_results(wanted, null, '[{"test": "Genotype", "result": "AA"}]');
    raise exception 'FAIL 2: a result for a test not on the request was saved';
  exception when invalid_parameter_value then null;
  end;
  if public.record_lab_results(wanted, null, '[{"test": "Full Blood Count", "result": ""}]') <> 'missing_tests' then
    raise exception 'FAIL 2: a send with nothing typed was not refused';
  end if;
  reset role;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000733"}', true);
  set local role authenticated;
  begin
    perform public.record_lab_results(wanted, null, '[{"test": "Full Blood Count", "result": "Normal"}]');
    reset role;
    raise exception 'FAIL 2: a nurse sent a lab result';
  exception when insufficient_privilege then
    reset role;
  end;
  if (select count(*) from public.lab_results where request_id = wanted) <> 1 then
    raise exception 'FAIL 2: a result was saved that should not have been';
  end if;
end $$;
\echo 'PASS 2: a test is not sent twice; only the request''s tests; something typed; the Lab only'


-- ===== 3. Seen, then told again at the next send =====
do $$
declare wanted bigint := (select id from public.lab_requests where note = 'T73 three');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000731"}', true);
  set local role authenticated;
  perform public.mark_lab_result_seen(wanted);
  reset role;
  if (select result_seen_at from public.lab_requests where id = wanted) is null then
    raise exception 'FAIL 3: the doctor could not mark a part sent result seen';
  end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000732"}', true);
  set local role authenticated;
  perform public.record_lab_results(wanted, null, '[{"test": "Full Blood Count", "result": "Normal"}]');
  reset role;
  if (select result_seen_at from public.lab_requests where id = wanted) is not null
     or (select status from public.lab_requests where id = wanted) = 'completed' then
    raise exception 'FAIL 3: the next send did not tell the doctor again, or closed the request';
  end if;
end $$;
\echo 'PASS 3: seen, then told again at the next send'


-- ===== 4. The last test completes the request =====
do $$
declare wanted bigint := (select id from public.lab_requests where note = 'T73 three');
begin
  delete from net.http_request_queue;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000732"}', true);
  set local role authenticated;
  if public.record_lab_results(wanted, null, '[{"test": "malaria test ", "result": "Negative"}]') <> 'saved' then
    raise exception 'FAIL 4: the last result was not saved';
  end if;
  reset role;
  if (select status from public.lab_requests where id = wanted) <> 'completed'
     or (select count(*) from public.lab_results where request_id = wanted) <> 3 then
    raise exception 'FAIL 4: the request did not complete with every test';
  end if;
  if (select count(*) from net.http_request_queue) <> 1
     or (select convert_from(body, 'UTF8') from net.http_request_queue limit 1) like '%pending%' then
    raise exception 'FAIL 4: the alert did not say the results are ready';
  end if;
end $$;
\echo 'PASS 4: the last test completes the request, with one alert'


-- ===== 5. A missed result added later =====
do $$
declare wanted bigint := (select id from public.lab_requests where note = 'T73 two');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000732"}', true);
  set local role authenticated;
  if public.add_lab_result(wanted, '{"test": "Urinalysis", "result": "Clear"}') <> 'saved' then
    raise exception 'FAIL 5: a missed result was not added';
  end if;
  if (select status from public.lab_requests where id = wanted) = 'completed' then
    raise exception 'FAIL 5: one result of two completed the request';
  end if;
  -- Two steps: in one condition the database may read the status first.
  if public.add_lab_result(wanted, '{"test": "Genotype", "result": "AS"}') <> 'saved' then
    raise exception 'FAIL 5: the second result was not added';
  end if;
  if (select status from public.lab_requests where id = wanted) <> 'completed' then
    raise exception 'FAIL 5: the second result did not complete the request';
  end if;
  reset role;
end $$;
\echo 'PASS 5: a missed result completes a request only when every test has one'

rollback;
