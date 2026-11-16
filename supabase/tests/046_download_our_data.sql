-- =============================================================================
-- tests for download_our_data (requests 206 and 217a, 2026-11-16).
--
-- What this proves: only an admin downloads, and only with the right PIN; a
-- wrong PIN gives nothing and counts towards the lock; the download holds
-- the hospital's tables and the staff without their PIN; it is logged; an
-- admin may read a lab file for it, and nobody else through this door.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000461', 't046-admin@test.rhema'),
  ('00000000-0000-0000-0000-000000000462', 't046-desk@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000461', 'T46 Admin', 't046-admin@test.rhema', 'admin'),
  ('00000000-0000-0000-0000-000000000462', 'T46 Desk',  't046-desk@test.rhema',  'front_desk');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T46 Patient', '1990-01-01', 'female', '00000000-0000-0000-0000-000000000462');
insert into public.lab_results (patient_id, test, result, file_key, recorded_by)
select id, 'PCV', 'See the attached file.', 'lab/11111111-1111-1111-1111-111111111111.pdf',
       '00000000-0000-0000-0000-000000000461'
from public.patients where full_name = 'T46 Patient';
update public.staff set pin_hash = extensions.crypt('4821', extensions.gen_salt('bf'))
where id in ('00000000-0000-0000-0000-000000000461', '00000000-0000-0000-0000-000000000462');


-- ===== 1. The Front Desk cannot download, even with its PIN =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000462"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.export_everything('4821');
    raise exception 'FAIL 1: the Front Desk downloaded the data';
  exception when insufficient_privilege then null;
  end;
  if public.export_may_read('lab/11111111-1111-1111-1111-111111111111.pdf') then
    raise exception 'FAIL 1: the Front Desk may read lab files through the download door';
  end if;
end $$;
reset role;
\echo 'PASS 1: only an admin downloads'


-- ===== 2. A wrong PIN gives nothing and counts =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000461"}', true);
set local role authenticated;
do $$
declare got jsonb := public.export_everything('0000');
begin
  if got ->> 'pin' <> 'wrong' or got ? 'tables' then
    raise exception 'FAIL 2: a wrong PIN gave the data: %', left(got::text, 80);
  end if;
end $$;
reset role;
do $$
begin
  if (select pin_failed_attempts from public.staff where id = '00000000-0000-0000-0000-000000000461') <> 1 then
    raise exception 'FAIL 2: the wrong PIN did not count';
  end if;
end $$;
\echo 'PASS 2: a wrong PIN gives nothing and counts towards the lock'


-- ===== 3. The right PIN gives the tables, staff without secrets, logged =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000461"}', true);
set local role authenticated;
do $$
declare got jsonb := public.export_everything('4821');
begin
  if got ->> 'pin' <> 'ok' then
    raise exception 'FAIL 3: the right PIN was refused';
  end if;
  if not (got -> 'tables' ? 'patients' and got -> 'tables' ? 'payments' and got -> 'tables' ? 'lab_results'
          and got -> 'tables' ? 'consultation_notes' and got -> 'tables' ? 'staff') then
    raise exception 'FAIL 3: a table is missing from the download';
  end if;
  if (got -> 'tables' -> 'staff')::text like '%pin_hash%' or (got -> 'tables' -> 'staff')::text like '%$2%' then
    raise exception 'FAIL 3: the download carries a PIN';
  end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.activity_log
                 where action = 'export' and actor_id = '00000000-0000-0000-0000-000000000461') then
    raise exception 'FAIL 3: the download is not in the activity log';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000461"}', true);
set local role authenticated;
do $$
begin
  if not public.export_may_read('lab/11111111-1111-1111-1111-111111111111.pdf') then
    raise exception 'FAIL 3: the admin may not read a lab file for the download';
  end if;
end $$;
reset role;
\echo 'PASS 3: the right PIN gives every table, staff without PINs, and it is logged'

rollback;
