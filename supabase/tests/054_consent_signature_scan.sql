-- =============================================================================
-- tests for consent_signature_scan (request 227l, 2026-11-18).
--
-- What this proves:
--   1. A consent saves with the scanned signature of the same patient, and
--      still saves without one.
--   2. A consent pointing at another patient's file is refused.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000541', 't054-matron@test.rhema'),
  ('00000000-0000-0000-0000-000000000542', 't054-desk@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000541', 'T54 Matron', 't054-matron@test.rhema', 'matron'),
  ('00000000-0000-0000-0000-000000000542', 'T54 Desk',   't054-desk@test.rhema',   'front_desk');
insert into public.patients (full_name, date_of_birth, sex, category, created_by) values
  ('T54 Mother', '1995-05-05', 'female', 'antenatal',  '00000000-0000-0000-0000-000000000542'),
  ('T54 Other',  '1990-01-01', 'female', 'individual', '00000000-0000-0000-0000-000000000542');
create temporary table t054 (mother bigint, other bigint);
insert into t054 select
  (select id from public.patients where full_name = 'T54 Mother'),
  (select id from public.patients where full_name = 'T54 Other');
grant all on t054 to authenticated;
-- Two files, one on each patient (written as the system, as the Worker does).
insert into public.patient_files (patient_id, file_key, file_name, file_type, file_size, uploaded_by) values
  ((select mother from t054), 'record/11111111-1111-1111-1111-111111111111.webp', 'Consent signature.webp', 'image/webp', 9000, '00000000-0000-0000-0000-000000000541'),
  ((select other from t054),  'record/22222222-2222-2222-2222-222222222222.webp', 'Other.webp', 'image/webp', 9000, '00000000-0000-0000-0000-000000000541');


-- ===== 1. With the same patient's scan, and without one =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000541"}', true);
set local role authenticated;
select public.open_record((select mother from t054));
insert into public.operation_consents (patient_id, consenting_name, operation, consent_ticked, consented_on, signature_key)
  select mother, 'Made Up Husband', 'Caesarean section', true, current_date,
         'record/11111111-1111-1111-1111-111111111111.webp' from t054;
insert into public.operation_consents (patient_id, consenting_name, operation, consent_ticked, consented_on)
  select mother, 'Made Up Sister', 'Tubal ligation', true, current_date from t054;
reset role;
do $$
begin
  if (select count(*) from public.operation_consents where signature_key is not null) <> 1
     or (select count(*) from public.operation_consents) <> 2 then
    raise exception 'FAIL 1: the consents were not both saved';
  end if;
end $$;
\echo 'PASS 1: a consent saves with its scan, and without one'


-- ===== 2. Another patient's file is refused =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000541"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.operation_consents (patient_id, consenting_name, operation, consent_ticked, consented_on, signature_key)
      select mother, 'Made Up Brother', 'Appendicectomy', true, current_date,
             'record/22222222-2222-2222-2222-222222222222.webp' from t054;
    raise exception 'FAIL 2: a consent took another patient''s file';
  exception when check_violation then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000541"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.operation_consents (patient_id, consenting_name, operation, consent_ticked, consented_on, signature_key)
      select mother, 'Made Up Brother', 'Appendicectomy', true, current_date,
             'record/33333333-3333-3333-3333-333333333333.webp' from t054;
    raise exception 'FAIL 2: a consent took a file that does not exist';
  exception when check_violation then null;
  end;
end $$;
reset role;
\echo 'PASS 2: another patient''s file, or no file at all, is refused'

rollback;
