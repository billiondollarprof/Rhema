-- =============================================================================
-- 060_family_file_first.sql: tests for family_file_first (request 228b,
-- 2026-11-20).
--
-- What this proves:
--   1. The Front Desk registers a family with its first member in one step:
--      the family has its name, phone, address, a FAM number and the date;
--      the member has an RMC number, category family, and the family.
--   2. An old file member joins a new family the same way (no date of birth).
--   3. No family name, or no member: nothing is saved.
--   4. A double tap saves one family and one member.
--   5. Nobody but the Front Desk registers a family.
--   6. The Front Desk edits the family's details; a nurse cannot.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000601', 't060-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000602', 't060-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000603', 't060-pharmacy@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000601', 'T60 Desk',     't060-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-000000000602', 'T60 Nurse',    't060-nurse@test.rhema',    'nurse'),
  ('00000000-0000-0000-0000-000000000603', 'T60 Pharmacy', 't060-pharmacy@test.rhema', 'pharmacy');


-- ===== 1. A family with its first member =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601"}', true);
set local role authenticated;
select public.register_family(
  '{"name": " T60  Jameson ", "phone": "08035550101", "address": "4 Okoro Close", "town": "Surulere", "lga": "Surulere", "state": "Lagos"}',
  '{"full_name": "T60 Lillian Jameson", "date_of_birth": "1992-04-01", "sex": "female", "phone": "08035550102", "address": "4 Okoro Close", "next_of_kin_name": "T60 Kin"}'
);
reset role;
do $$
declare
  fam public.families;
  member public.patients;
begin
  select * into fam from public.families where name = 'T60 Jameson';
  select * into member from public.patients where full_name = 'T60 Lillian Jameson';
  if fam.id is null then
    raise exception 'FAIL 1: the family was not saved (or its name was not tidied)';
  end if;
  if fam.phone <> '08035550101' or fam.address <> '4 Okoro Close' or fam.state <> 'Lagos'
     or fam.country <> 'Nigeria' or fam.family_number !~ '^FAM-[0-9]{6}$' or fam.created_at is null
     or fam.created_by <> '00000000-0000-0000-0000-000000000601' then
    raise exception 'FAIL 1: the family''s details are wrong';
  end if;
  if member.id is null or member.family_id <> fam.id or member.category <> 'family'
     or member.patient_number !~ '^RMC-' or member.created_by <> '00000000-0000-0000-0000-000000000601'
     or member.next_of_kin_name <> 'T60 Kin' or member.from_old_file then
    raise exception 'FAIL 1: the member is not right';
  end if;
end $$;
\echo 'PASS 1: the Front Desk registers a family with its first member'


-- ===== 2. An old file member =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601"}', true);
set local role authenticated;
select public.register_family(
  '{"name": "T60 Okafor"}',
  '{"full_name": "T60 Emeka Okafor", "phone": "08035550103", "from_old_file": true, "first_registered_on": "2019-03-01"}'
);
reset role;
do $$
begin
  if not exists (select 1 from public.patients p join public.families f on f.id = p.family_id
                 where p.full_name = 'T60 Emeka Okafor' and f.name = 'T60 Okafor'
                   and p.from_old_file and p.date_of_birth is null
                   and p.first_registered_on = '2019-03-01') then
    raise exception 'FAIL 2: the old file member did not join the new family';
  end if;
end $$;
\echo 'PASS 2: an old file member starts a family the same way'


-- ===== 3. No family name, or no member: nothing saved =====
do $$
declare before_families bigint := (select count(*) from public.families);
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601"}', true);
  set local role authenticated;
  begin
    perform public.register_family('{"name": " "}', '{"full_name": "T60 No Family Name", "date_of_birth": "1990-01-01", "sex": "male"}');
    raise exception 'FAIL 3: a family without a name was saved';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.register_family('{"name": "T60 Empty"}', '{}');
    raise exception 'FAIL 3: a family without a member was saved';
  exception when invalid_parameter_value then null;
  end;
  begin
    -- A member the patients table refuses (no date of birth, not an old file).
    perform public.register_family('{"name": "T60 Half"}', '{"full_name": "T60 Half Member"}');
    raise exception 'FAIL 3: a member without a date of birth was saved';
  exception when check_violation then null;
  end;
  reset role;
  if (select count(*) from public.families) <> before_families then
    raise exception 'FAIL 3: a family was left with nobody in it';
  end if;
end $$;
\echo 'PASS 3: no name, no member, or a refused member: nothing is saved'


-- ===== 4. A double tap saves one =====
do $$
declare before_families bigint;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601"}', true);
  set local role authenticated;
  perform public.register_family('{"name": "T60 Bello"}', '{"full_name": "T60 Ada Bello", "date_of_birth": "1995-05-05", "sex": "female"}');
  before_families := (select count(*) from public.families);
  begin
    perform public.register_family('{"name": "T60 Bello"}', '{"full_name": "T60 Ada Bello", "date_of_birth": "1995-05-05", "sex": "female"}');
    raise exception 'FAIL 4: a double tap was not refused';
  exception when unique_violation then null;
  end;
  reset role;
  if (select count(*) from public.families) <> before_families
     or (select count(*) from public.patients where full_name = 'T60 Ada Bello') <> 1 then
    raise exception 'FAIL 4: a double tap saved a second family or member';
  end if;
end $$;
\echo 'PASS 4: a double tap saves one family and one member'


-- ===== 5. Nobody but the Front Desk =====
do $$
declare who text;
begin
  foreach who in array array['000000000602', '000000000603'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    begin
      perform public.register_family('{"name": "T60 Not Desk"}', '{"full_name": "T60 Not Desk Member", "date_of_birth": "1990-01-01", "sex": "male"}');
      reset role;
      raise exception 'FAIL 5: % registered a family', who;
    exception when insufficient_privilege then
      reset role;
    end;
    set local role authenticated;
    begin
      insert into public.families (name) values ('T60 Direct');
      reset role;
      raise exception 'FAIL 5: % added a family directly', who;
    exception when insufficient_privilege then
      reset role;
    end;
  end loop;
end $$;
\echo 'PASS 5: nobody but the Front Desk registers or adds a family'


-- ===== 6. Edit the family's details =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602"}', true);
set local role authenticated;
update public.families set address = '9 Nurse Street' where name = 'T60 Jameson';
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601"}', true);
set local role authenticated;
update public.families set address = '10 New Road', town = 'Yaba' where name = 'T60 Jameson';
reset role;
do $$
begin
  if (select address from public.families where name = 'T60 Jameson') <> '10 New Road' then
    raise exception 'FAIL 6: the Front Desk could not edit, or the nurse could';
  end if;
end $$;
\echo 'PASS 6: the Front Desk edits the family''s details; a nurse cannot'

rollback;
