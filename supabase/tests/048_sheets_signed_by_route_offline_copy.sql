-- =============================================================================
-- tests for sheets_signed_by_route_offline_copy (request 224, 2026-11-17).
--
-- What this proves:
--   1. A dose saved with a route and signed by another nurse keeps both, and
--      still records who typed it; nobody can sign as the Front Desk.
--   2. Signed by fills in with the person typing when it is left out.
--   3. Clinical staff copy the records of open visits only; the copy is in
--      the activity log as offline_copy; a second copy within 25 minutes is
--      not written again; the Front Desk cannot copy.
--   4. A record opened from the copy is logged at the time it was opened;
--      a time older than 24 hours is refused; nobody can backdate an
--      ordinary opening.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000481', 't048-nurse1@test.rhema'),
  ('00000000-0000-0000-0000-000000000482', 't048-nurse2@test.rhema'),
  ('00000000-0000-0000-0000-000000000483', 't048-desk@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000481', 'T48 Nurse One', 't048-nurse1@test.rhema', 'nurse', true),
  ('00000000-0000-0000-0000-000000000482', 'T48 Nurse Two', 't048-nurse2@test.rhema', 'nurse', true),
  ('00000000-0000-0000-0000-000000000483', 'T48 Desk', 't048-desk@test.rhema', 'front_desk', false);
update public.staff set can_medical = false where id = '00000000-0000-0000-0000-000000000483';
insert into public.rooms (name, kind) values ('T48 Ward', 'nursing');
insert into public.patients (full_name, date_of_birth, sex, created_by) values
  ('T48 Open', '1990-01-01', 'female', '00000000-0000-0000-0000-000000000483'),
  ('T48 Closed', '1990-01-01', 'male', '00000000-0000-0000-0000-000000000483');
insert into public.queue_entries (patient_id, room_id, sent_by)
select p.id, r.id, '00000000-0000-0000-0000-000000000483'
from public.patients p, public.rooms r where p.full_name = 'T48 Open' and r.name = 'T48 Ward';
-- The closed patient had a visit today that has ended.
insert into public.queue_entries (patient_id, room_id, sent_by, status, finished_at)
select p.id, r.id, '00000000-0000-0000-0000-000000000483', 'done', now()
from public.patients p, public.rooms r where p.full_name = 'T48 Closed' and r.name = 'T48 Ward';
insert into public.record_openings (patient_id, staff_id)
select id, '00000000-0000-0000-0000-000000000481' from public.patients where full_name = 'T48 Open';


-- ===== 1 and 2. Route and signed by =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000481"}', true);
set local role authenticated;
do $$
declare patient bigint := (select id from public.patients where full_name = 'T48 Open');
begin
  insert into public.medications_given (patient_id, medicine, dose, route, given_by, signed_by)
  values (patient, 'Inj Tranexamic acid', '1 g', 'IV', '00000000-0000-0000-0000-000000000481',
          '00000000-0000-0000-0000-000000000482');
  if not exists (select 1 from public.medications_given where patient_id = patient and route = 'IV'
                 and signed_by = '00000000-0000-0000-0000-000000000482'
                 and given_by = '00000000-0000-0000-0000-000000000481') then
    raise exception 'FAIL 1: the route or the signer was not kept';
  end if;
  begin
    insert into public.medications_given (patient_id, medicine, given_by, signed_by)
    values (patient, 'Inj Dexa', '00000000-0000-0000-0000-000000000481',
            '00000000-0000-0000-0000-000000000483');
    raise exception 'FAIL 1: signed as the Front Desk';
  exception when insufficient_privilege then null;
  end;
  -- Signed by sent empty on purpose: still the person typing.
  insert into public.vital_signs (patient_id, temperature_c, recorded_by, signed_by)
  values (patient, 36.5, '00000000-0000-0000-0000-000000000481', null);
  if (select signed_by from public.vital_signs where patient_id = patient) <> '00000000-0000-0000-0000-000000000481' then
    raise exception 'FAIL 2: signed by was not filled with the person typing';
  end if;
end $$;
reset role;
\echo 'PASS 1 and 2: route and signed by'


-- ===== 3. The copy for no network =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000481"}', true);
set local role authenticated;
do $$
declare
  copied bigint[] := public.copy_open_visits();
  open_one bigint := (select id from public.patients where full_name = 'T48 Open');
  closed_one bigint := (select id from public.patients where full_name = 'T48 Closed');
begin
  if not open_one = any (copied) or closed_one = any (copied) then
    raise exception 'FAIL 3: the copy did not hold only the open visit';
  end if;
  perform public.copy_open_visits();
end $$;
reset role;
do $$
declare open_one bigint := (select id from public.patients where full_name = 'T48 Open');
begin
  if (select count(*) from public.record_openings where patient_id = open_one and purpose = 'offline_copy') <> 1 then
    raise exception 'FAIL 3: a second copy within 25 minutes was written again';
  end if;
  if not exists (select 1 from public.activity_log where patient_id = open_one and action = 'offline_copy'
                 and table_name = 'record_openings') then
    raise exception 'FAIL 3: the copy is not in the activity log';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000483"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.copy_open_visits();
    raise exception 'FAIL 3: the Front Desk copied records';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 3: the copy for no network'


-- ===== 4. Opened from the copy =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000481"}', true);
set local role authenticated;
do $$
declare open_one bigint := (select id from public.patients where full_name = 'T48 Open');
begin
  perform public.log_offline_view(open_one, now() - interval '2 hours');
  perform public.log_offline_view(open_one, now() - interval '2 hours');
  if (select count(*) from public.record_openings where patient_id = open_one and purpose = 'offline_view') <> 1 then
    raise exception 'FAIL 4: the offline opening was not written once';
  end if;
  begin
    perform public.log_offline_view(open_one, now() - interval '3 days');
    raise exception 'FAIL 4: an opening older than 24 hours was taken';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.record_openings (patient_id, opened_at) values (open_one, now() - interval '3 days');
    raise exception 'FAIL 4: an ordinary opening was backdated';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.record_openings (patient_id, purpose) values (open_one, 'offline_copy');
    raise exception 'FAIL 4: the purpose was set by hand';
  exception when insufficient_privilege then null;
  end;
  -- An ordinary opening still works, and is logged as an opening.
  perform public.open_record(open_one);
end $$;
reset role;
do $$
declare open_one bigint := (select id from public.patients where full_name = 'T48 Open');
begin
  if not exists (select 1 from public.activity_log where patient_id = open_one and action = 'offline_view') then
    raise exception 'FAIL 4: the offline opening is not in the activity log';
  end if;
  if (select count(*) from public.activity_log where patient_id = open_one and action = 'insert'
      and table_name = 'record_openings') < 2 then
    raise exception 'FAIL 4: ordinary openings are no longer logged as openings';
  end if;
end $$;
\echo 'PASS 4: opened from the copy'

rollback;
