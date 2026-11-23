-- =============================================================================
-- 070_consulting_room_does_what_a_doctor_does.sql: tests for request 241
-- (2026-11-23).
--
-- What this proves:
--   1. The matron and a nurse in a consulting room prescribe, and send their
--      own prescription on to the Pharmacy too.
--   2. A doctor with no room still prescribes.
--   3. The matron or a nurse with no consulting room (or in a ward), and
--      somebody without medical access in a consulting room, cannot.
--   4. A nurse in a consulting room adds a bill (prices); one in a ward
--      cannot. A closed consulting room counts for nothing.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into public.rooms (name, kind) values
  ('T70 Consult', 'consultation'), ('T70 Ward', 'nursing'), ('T70 Closed', 'consultation');
update public.rooms set is_active = false where name = 'T70 Closed';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000701', 't070-matron-room@test.rhema'),
  ('00000000-0000-0000-0000-000000000702', 't070-nurse-room@test.rhema'),
  ('00000000-0000-0000-0000-000000000703', 't070-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000704', 't070-matron@test.rhema'),
  ('00000000-0000-0000-0000-000000000705', 't070-nurse-ward@test.rhema'),
  ('00000000-0000-0000-0000-000000000706', 't070-desk-room@test.rhema'),
  ('00000000-0000-0000-0000-000000000707', 't070-nurse-closed@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000701', 'T70 Matron Room', 't070-matron-room@test.rhema', 'matron',     true),
  ('00000000-0000-0000-0000-000000000702', 'T70 Nurse Room',  't070-nurse-room@test.rhema',  'nurse',      true),
  ('00000000-0000-0000-0000-000000000703', 'T70 Doctor',      't070-doctor@test.rhema',      'doctor',     true),
  ('00000000-0000-0000-0000-000000000704', 'T70 Matron',      't070-matron@test.rhema',      'matron',     true),
  ('00000000-0000-0000-0000-000000000705', 'T70 Nurse Ward',  't070-nurse-ward@test.rhema',  'nurse',      true),
  ('00000000-0000-0000-0000-000000000706', 'T70 Desk Room',   't070-desk-room@test.rhema',   'front_desk', false),
  ('00000000-0000-0000-0000-000000000707', 'T70 Nurse Shut',  't070-nurse-closed@test.rhema', 'nurse',     true);
update public.staff set can_medical = false where id = '00000000-0000-0000-0000-000000000706';
update public.staff set room_id = (select id from public.rooms where name = 'T70 Consult')
 where id in ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702',
              '00000000-0000-0000-0000-000000000706');
update public.staff set room_id = (select id from public.rooms where name = 'T70 Ward')
 where id = '00000000-0000-0000-0000-000000000705';
update public.staff set room_id = (select id from public.rooms where name = 'T70 Closed')
 where id = '00000000-0000-0000-0000-000000000707';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T70 Patient', '1990-09-09', 'female', '00000000-0000-0000-0000-000000000703');


-- ===== 1 and 2. Who prescribes =====
do $$
declare
  patient bigint := (select id from public.patients where full_name = 'T70 Patient');
  who text;
begin
  foreach who in array array['000000000701', '000000000702', '000000000703'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    if public.prescribe(patient, '[{"drug": "T70 Paracetamol", "strength": "500 mg tablet"}]',
                        'T70 by ' || who, 'front_desk') <> 'sent' then
      raise exception 'FAIL 1: % could not prescribe', who;
    end if;
    -- Their own prescription, on to the Pharmacy too.
    if public.send_prescription_also((select id from public.prescriptions where note = 'T70 by ' || who))
       <> 'sent' then
      raise exception 'FAIL 1: % could not send their own prescription on', who;
    end if;
    reset role;
  end loop;
end $$;
\echo 'PASS 1 and 2: the matron and a nurse in a consulting room, and a doctor with no room, prescribe'


-- ===== 3. Who cannot =====
do $$
declare
  patient bigint := (select id from public.patients where full_name = 'T70 Patient');
  who text;
begin
  foreach who in array array['000000000704', '000000000705', '000000000706', '000000000707'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    begin
      perform public.prescribe(patient, '[{"drug": "T70 Not allowed"}]', 'T70 refused', 'front_desk');
      reset role;
      raise exception 'FAIL 3: % prescribed', who;
    exception when insufficient_privilege then
      reset role;
    end;
  end loop;
end $$;
\echo 'PASS 3: no consulting room, a closed one, or no medical access: no prescribing'


-- ===== 4. Bills (prices) =====
do $$
declare patient bigint := (select id from public.patients where full_name = 'T70 Patient');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000702"}', true);
  set local role authenticated;
  if public.add_bill(patient, '[{"kind": "dressing", "item": "T70 Dressing", "amount": 1000}]', null) <> 'sent' then
    raise exception 'FAIL 4: a nurse in a consulting room could not add a bill';
  end if;
  reset role;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000705"}', true);
  set local role authenticated;
  begin
    perform public.add_bill(patient, '[{"kind": "dressing", "item": "T70 Ward bill", "amount": 1000}]', null);
    reset role;
    raise exception 'FAIL 4: a nurse in a ward added a bill';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000706"}', true);
  set local role authenticated;
  begin
    perform public.add_bill(patient, '[{"kind": "dressing", "item": "T70 Desk bill", "amount": 1000}]', null);
    reset role;
    raise exception 'FAIL 4: the Front Desk in a consulting room added a bill';
  exception when insufficient_privilege then
    reset role;
  end;
end $$;
\echo 'PASS 4: a nurse in a consulting room adds a bill; in a ward, or without medical access, cannot'

rollback;
