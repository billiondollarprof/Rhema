-- =============================================================================
-- 038_antenatal_visits_and_client.sql: tests for the antenatal visit table and
-- the woman's own details on the booking.
--
-- What this is: proves only medical staff with the record open read or write
-- a visit; the examiner is always the person signed in; values outside sense
-- are refused; a double tap saves once; a visit is voided, never deleted; and
-- the booking takes the new details.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000381', 't038-midwife@test.rhema'),
  ('00000000-0000-0000-0000-000000000382', 't038-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000383', 't038-nurse@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000381', 'T38 Midwife', 't038-midwife@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-000000000382', 'T38 Desk',    't038-desk@test.rhema',    'front_desk'),
  ('00000000-0000-0000-0000-000000000383', 'T38 Nurse',   't038-nurse@test.rhema',   'nurse');
insert into public.patients (full_name, date_of_birth, sex, category, created_by)
values ('T38 Made Up Mother', '1998-09-24', 'female', 'antenatal', '00000000-0000-0000-0000-000000000382');
create temporary table t (patient bigint);
insert into t select id from public.patients where full_name = 'T38 Made Up Mother';
grant select on t to authenticated;


-- ===== 1. Rights =====
do $$
begin
  if has_table_privilege('anon', 'public.antenatal_visits', 'SELECT, INSERT, UPDATE, DELETE') then
    raise exception 'FAIL 1: the public has rights on antenatal visits';
  end if;
  if has_table_privilege('authenticated', 'public.antenatal_visits', 'DELETE, TRUNCATE') then
    raise exception 'FAIL 1: signed in users can delete antenatal visits';
  end if;
end $$;
\echo 'PASS 1: nobody holds rights they should not have'


-- ===== 2. Before the record is open, nothing is saved =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000381"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.antenatal_visits (patient_id, fundal_height) select patient, 28 from t;
    raise exception 'FAIL 2: a visit was saved without opening the record';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 2: nothing is saved before the record is opened'


-- ===== 3. A full visit saves once, in the midwife's name =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000381"}', true);
set local role authenticated;
select public.open_record((select patient from t));
insert into public.antenatal_visits (patient_id, fundal_height, presentation, position, foetal_heart,
  urine_protein, urine_sugar, systolic, diastolic, pulse, respiration, weight_kg, hb, oedema,
  drugs_given, remark, return_on)
  select patient, 28, 'Cephalic', 'ROA', 138, 'Nil', 'Nil', 110, 70, 89, 22, 70, 11.5, 'Nil',
         array['Ferrous sulphate', 'Folic acid'], 'Well', current_date + 14 from t;
insert into public.antenatal_visits (patient_id, fundal_height, presentation, position, foetal_heart,
  urine_protein, urine_sugar, systolic, diastolic, pulse, respiration, weight_kg, hb, oedema,
  drugs_given, remark, return_on)
  select patient, 28, 'Cephalic', 'ROA', 138, 'Nil', 'Nil', 110, 70, 89, 22, 70, 11.5, 'Nil',
         array['Ferrous sulphate', 'Folic acid'], 'Well', current_date + 14 from t;
do $$
begin
  if (select count(*) from public.antenatal_visits) <> 1 then
    raise exception 'FAIL 3: a double tap saved two visits';
  end if;
  if (select recorded_by from public.antenatal_visits) <> '00000000-0000-0000-0000-000000000381' then
    raise exception 'FAIL 3: the examiner is not the person signed in';
  end if;
  begin
    insert into public.antenatal_visits (patient_id, fundal_height, recorded_by)
      select patient, 30, '00000000-0000-0000-0000-000000000383' from t;
    raise exception 'FAIL 3: a visit was written in another person''s name';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.activity_log where table_name = 'antenatal_visits') then
    raise exception 'FAIL 3: the visit is not in the activity log';
  end if;
end $$;
\echo 'PASS 3: a visit saves once, in the examiner''s own name, and is logged'


-- ===== 4. Values that make no sense are refused =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000381"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.antenatal_visits (patient_id, foetal_heart) select patient, 400 from t;
    raise exception 'FAIL 4: a foetal heart rate of 400 was saved';
  exception when check_violation then null;
  end;
  begin
    insert into public.antenatal_visits (patient_id, presentation) select patient, 'Sideways' from t;
    raise exception 'FAIL 4: a presentation that is not on the list was saved';
  exception when check_violation then null;
  end;
  begin
    insert into public.antenatal_visits (patient_id, oedema) select patient, 'Lots' from t;
    raise exception 'FAIL 4: an oedema that is not on the list was saved';
  exception when check_violation then null;
  end;
  begin
    insert into public.antenatal_visits (patient_id, return_on, visit_on) select patient, current_date - 3, current_date from t;
    raise exception 'FAIL 4: a return date before the visit was saved';
  exception when check_violation then null;
  end;
  begin
    insert into public.antenatal_visits (patient_id) select patient from t;
    raise exception 'FAIL 4: an empty visit was saved';
  exception when check_violation then null;
  end;
end $$;
reset role;
\echo 'PASS 4: values that make no sense are refused'


-- ===== 5. A visit is voided, never deleted; the Front Desk sees none =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000381"}', true);
set local role authenticated;
do $$
begin
  begin
    delete from public.antenatal_visits;
    raise exception 'FAIL 5: a visit was deleted';
  exception when insufficient_privilege then null;
  end;
  update public.antenatal_visits
    set voided_at = now(), voided_by = '00000000-0000-0000-0000-000000000381', void_reason = 'Wrong patient';
  if not exists (select 1 from public.antenatal_visits where voided_at is not null) then
    raise exception 'FAIL 5: a visit could not be voided';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000382"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.antenatal_visits) <> 0 then
    raise exception 'FAIL 5: the Front Desk can read antenatal visits';
  end if;
end $$;
reset role;
\echo 'PASS 5: a visit is voided never deleted, and the Front Desk sees none'


-- ===== 6. The booking takes the woman's own details and histories =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000381"}', true);
set local role authenticated;
insert into public.antenatal_bookings (patient_id, client_marital_status, client_religion, client_education,
  client_occupation, client_tribe, history_asked, history_yes, surgery_type, surgery_reason)
  select patient, 'Married', 'Christian', 'ND', 'Business', 'Urhobo', true, array['Asthma'], 'Appendicectomy', 'Appendicitis'
  from t;
update public.antenatal_bookings set history_yes = array['Asthma', 'Hypertension'] where patient_id = (select patient from t);
do $$
begin
  if not exists (select 1 from public.antenatal_bookings where client_tribe = 'Urhobo' and history_asked
                 and history_yes = array['Asthma', 'Hypertension'] and surgery_type = 'Appendicectomy') then
    raise exception 'FAIL 6: the booking did not keep the new details';
  end if;
  begin
    update public.antenatal_bookings set client_marital_status = 'Complicated' where patient_id = (select patient from t);
    raise exception 'FAIL 6: a marital status that is not on the list was saved';
  exception when check_violation then null;
  end;
end $$;
reset role;
\echo 'PASS 6: the booking keeps the woman''s own details and histories'

rollback;
