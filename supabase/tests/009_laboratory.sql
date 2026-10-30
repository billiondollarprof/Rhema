-- =============================================================================
-- 009_laboratory.sql: tests for the Laboratory and payments (request 115).
--
-- What this is: proves the whole path. A doctor requests tests; the Front
-- Desk records the payment in naira with its mode; the lab types the
-- results; only the doctor who asked is alerted; the results sit in the
-- record; and each person sees only what their job needs. Also: nothing
-- twice, nothing written by hand, nothing for somebody not signed in.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: a doctor, a second doctor, a front desk, a lab person, a patient =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'lab-doctor@test.rhema'),
  ('00000000-0000-0000-0000-0000000000c2', 'lab-doctor2@test.rhema'),
  ('00000000-0000-0000-0000-0000000000c3', 'lab-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000c4', 'lab-scientist@test.rhema'),
  ('00000000-0000-0000-0000-0000000000c5', 'lab-pharmacy@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'Lab Test Doctor',    'lab-doctor@test.rhema',    'doctor'),
  ('00000000-0000-0000-0000-0000000000c2', 'Lab Test Doctor 2',  'lab-doctor2@test.rhema',   'doctor'),
  ('00000000-0000-0000-0000-0000000000c3', 'Lab Test Desk',      'lab-desk@test.rhema',      'front_desk'),
  ('00000000-0000-0000-0000-0000000000c4', 'Lab Test Scientist', 'lab-scientist@test.rhema', 'laboratory'),
  ('00000000-0000-0000-0000-0000000000c5', 'Lab Test Pharmacy',  'lab-pharmacy@test.rhema',  'pharmacy');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Lab Made Up', '1990-01-01', 'male', '00000000-0000-0000-0000-0000000000c3');

create temporary table t (patient bigint);
insert into t select id from public.patients where full_name = 'Lab Made Up';
grant select on t to authenticated;

-- The alert stand-ins: the Worker address, and a phone for each doctor.
select vault.create_secret('https://push-test.invalid', 'rhema_push_url');
select vault.create_secret('test-secret-not-real', 'rhema_push_secret');
insert into public.push_devices (staff_id, endpoint, p256dh, auth_key) values
  ('00000000-0000-0000-0000-0000000000c1', 'https://push.example/doctor-phone',  repeat('k', 87), repeat('a', 22)),
  ('00000000-0000-0000-0000-0000000000c2', 'https://push.example/doctor2-phone', repeat('k', 87), repeat('a', 22));


-- ===== 1. Only medical staff request; a double tap sends one =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', true);
set local role authenticated;
do $$
begin
  perform public.request_lab((select patient from t), array['Malaria test'], null, 'front_desk');
  raise exception 'FAIL 1: the Front Desk requested a lab test';
exception when insufficient_privilege then
  null;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
do $$
begin
  if public.request_lab((select patient from t), array[' Malaria test', 'Full Blood Count', 'Malaria test '],
                        'Fever for 3 days', 'front_desk') <> 'sent' then
    raise exception 'FAIL 1: the request was not sent';
  end if;
  if public.request_lab((select patient from t), array['Malaria test', 'Full Blood Count'],
                        null, 'front_desk') <> 'already_sent' then
    raise exception 'FAIL 1: a double tap made a second request';
  end if;
end $$;
reset role;
do $$
begin
  if (select tests from public.lab_requests) <> array['Malaria test', 'Full Blood Count'] then
    raise exception 'FAIL 1: the tests were not tidied (each once, no spaces)';
  end if;
  if (select status from public.lab_requests) <> 'awaiting_payment' then
    raise exception 'FAIL 1: a request to the Front Desk must wait for payment';
  end if;
end $$;
\echo 'PASS 1: only medical staff request; tidy; one request per double tap'


-- ===== 2. Bad requests are refused =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.request_lab((select patient from t), array['Urinalysis'], null, 'pharmacy');
    raise exception 'FAIL 2: a request went somewhere other than the Front Desk or the lab';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.request_lab((select patient from t), array['  ', 'x'], null, 'laboratory');
    raise exception 'FAIL 2: a request with no real test was sent';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
\echo 'PASS 2: bad requests are refused'


-- ===== 3. The lab cannot record a result before payment =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4"}', true);
set local role authenticated;
do $$
begin
  if public.record_lab_results((select id from public.lab_requests), null,
       '[{"test": "Malaria test", "result": "Negative"}]'::jsonb) <> 'not_paid' then
    raise exception 'FAIL 3: a result was recorded before payment';
  end if;
end $$;
reset role;
\echo 'PASS 3: no result before payment'


-- ===== 4. Only the Front Desk takes payment, once, in naira with its mode =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
do $$
begin
  perform public.pay_lab_request((select id from public.lab_requests), 5000, 'cash');
  raise exception 'FAIL 4: a doctor recorded a payment';
exception when insufficient_privilege then
  null;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.pay_lab_request((select id from public.lab_requests), 0, 'cash');
    raise exception 'FAIL 4: a payment of 0 naira was accepted';
  exception when invalid_parameter_value then null;
  end;
  if public.pay_lab_request((select id from public.lab_requests), 7500.50, 'transfer') <> 'paid' then
    raise exception 'FAIL 4: the payment was not recorded';
  end if;
  if public.pay_lab_request((select id from public.lab_requests), 7500.50, 'transfer') <> 'already_paid' then
    raise exception 'FAIL 4: the same request was paid twice';
  end if;
  if (select count(*) from public.payments) <> 1 then
    raise exception 'FAIL 4: expected exactly one payment';
  end if;
  if (select amount from public.payments) <> 7500.50
     or (select mode from public.payments) <> 'transfer'
     or (select purpose from public.payments) <> 'lab_test' then
    raise exception 'FAIL 4: the payment was not kept as typed';
  end if;
  if (select status from public.lab_requests) <> 'awaiting_test' then
    raise exception 'FAIL 4: a paid request must wait for its test';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.payments) <> 0 then
    raise exception 'FAIL 4: a doctor can read payments';
  end if;
end $$;
reset role;
\echo 'PASS 4: Front Desk only, once, amount and mode kept'


-- ===== 5. Only the Laboratory tick records results; once; only the doctor who asked is alerted =====
-- (Doctors have the Laboratory tick by default, as in the demo. The Front
-- Desk does not.)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', true);
set local role authenticated;
do $$
begin
  perform public.record_lab_results((select id from public.lab_requests), null,
    '[{"test": "Malaria test", "result": "Negative"}]'::jsonb);
  raise exception 'FAIL 5: the Front Desk recorded a lab result';
exception when insufficient_privilege then
  null;
end $$;
reset role;
delete from net.http_request_queue;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4"}', true);
set local role authenticated;
do $$
begin
  if public.record_lab_results((select id from public.lab_requests), null,
       '[{"test": "Malaria test", "result": "Negative"},
         {"test": "Full Blood Count", "result": "PCV 38%, WBC normal"}]'::jsonb) <> 'saved' then
    raise exception 'FAIL 5: the results were not saved';
  end if;
  if public.record_lab_results((select id from public.lab_requests), null,
       '[{"test": "Malaria test", "result": "Negative"}]'::jsonb) <> 'already_done' then
    raise exception 'FAIL 5: a finished request took results twice';
  end if;
end $$;
reset role;
do $$
declare
  sent jsonb;
begin
  if (select status from public.lab_requests) <> 'completed' then
    raise exception 'FAIL 5: the request is not completed';
  end if;
  if (select count(*) from public.lab_results) <> 2 then
    raise exception 'FAIL 5: expected two result lines';
  end if;
  if (select count(*) from net.http_request_queue) <> 1 then
    raise exception 'FAIL 5: expected exactly one alert';
  end if;
  select convert_from(body, 'UTF8')::jsonb into sent from net.http_request_queue;
  if jsonb_array_length(sent -> 'targets') <> 1
     or sent -> 'targets' -> 0 ->> 'endpoint' <> 'https://push.example/doctor-phone' then
    raise exception 'FAIL 5: the alert did not go to the doctor who asked, and only to them';
  end if;
  if sent::text like '%Lab Made Up%' or sent::text like '%Malaria%' then
    raise exception 'FAIL 5: the alert names the patient or the test';
  end if;
end $$;
\echo 'PASS 5: lab only, once, one alert to the doctor who asked, no names'


-- ===== 6. Results: the record shows them; the Front Desk never sees them =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.lab_results) <> 0 then
    raise exception 'FAIL 6: the Front Desk can read lab results';
  end if;
  if (select count(*) from public.lab_requests) <> 1 then
    raise exception 'FAIL 6: the Front Desk cannot see the request to charge';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.lab_results) <> 0 then
    raise exception 'FAIL 6: a doctor read results without opening the record';
  end if;
end $$;
select public.open_record((select patient from t));
do $$
begin
  if (select count(*) from public.lab_results) <> 2 then
    raise exception 'FAIL 6: the opened record does not show the results';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.lab_results) <> 2 then
    raise exception 'FAIL 6: the lab cannot see the results it typed';
  end if;
  if (select count(*) from public.payments) <> 0 then
    raise exception 'FAIL 6: the lab can read payments';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c5"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.lab_requests) <> 0 or (select count(*) from public.lab_results) <> 0 then
    raise exception 'FAIL 6: the Pharmacy can see lab requests or results';
  end if;
end $$;
reset role;
\echo 'PASS 6: results in the record; never the Front Desk or Pharmacy; the lab sees its own'


-- ===== 7. Only the person who asked marks the result seen =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2"}', true);
set local role authenticated;
select public.mark_lab_result_seen((select id from public.lab_requests));
reset role;
do $$
begin
  if (select result_seen_at from public.lab_requests) is not null then
    raise exception 'FAIL 7: another doctor marked the result seen';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
select public.mark_lab_result_seen((select id from public.lab_requests));
reset role;
do $$
begin
  if (select result_seen_at from public.lab_requests) is null then
    raise exception 'FAIL 7: the doctor who asked could not mark it seen';
  end if;
end $$;
\echo 'PASS 7: only the person who asked marks it seen'


-- ===== 8. Straight to the lab, and a walk in result =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
select public.request_lab((select patient from t), array['Blood sugar'], null, 'laboratory');
reset role;
do $$
begin
  if (select status from public.lab_requests where tests = array['Blood sugar']) <> 'awaiting_test' then
    raise exception 'FAIL 8: a request straight to the lab must wait for its test';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4"}', true);
set local role authenticated;
do $$
begin
  if public.record_lab_results(null, (select patient from t),
       '[{"test": "Urinalysis", "result": "Clear"}]'::jsonb) <> 'saved' then
    raise exception 'FAIL 8: a walk in result was not saved';
  end if;
  if public.record_lab_results(null, (select patient from t),
       '[{"test": "Urinalysis", "result": "Clear"}]'::jsonb) <> 'already_done' then
    raise exception 'FAIL 8: a walk in result was saved twice in 30 seconds';
  end if;
end $$;
reset role;
\echo 'PASS 8: straight to the lab; walk in results, once'


-- ===== 9. A bad file name is refused =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4"}', true);
set local role authenticated;
do $$
begin
  perform public.record_lab_results((select id from public.lab_requests where tests = array['Blood sugar']), null,
    '[{"test": "Blood sugar", "result": "5.2", "file_key": "../../secrets.txt"}]'::jsonb);
  raise exception 'FAIL 9: a result was saved with a bad file name';
exception when check_violation then
  null;
end $$;
reset role;
\echo 'PASS 9: a bad file name is refused'


-- ===== 10. Nobody writes the tables by hand =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.payments (patient_id, amount, purpose, mode) select patient, 100, 'other', 'cash' from t;
    raise exception 'FAIL 10: a payment was written by hand';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.lab_requests set status = 'completed';
    raise exception 'FAIL 10: a request was changed by hand';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c4"}', true);
set local role authenticated;
do $$
begin
  insert into public.lab_results (patient_id, test, result) select patient, 'Malaria test', 'Positive' from t;
  raise exception 'FAIL 10: a result was written by hand';
exception when insufficient_privilege then
  null;
end $$;
reset role;
\echo 'PASS 10: nobody writes the tables by hand'


-- ===== 11. Somebody not signed in gets nothing =====
set local role anon;
do $$
begin
  perform public.request_lab(1, array['Malaria test'], null, 'laboratory');
  raise exception 'FAIL 11: anon requested a test';
exception when insufficient_privilege then
  null;
end $$;
do $$
begin
  perform count(*) from public.lab_results;
  raise exception 'FAIL 11: anon read results';
exception when insufficient_privilege then
  null;
end $$;
reset role;
\echo 'PASS 11: nothing for somebody not signed in'

rollback;
