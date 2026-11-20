-- =============================================================================
-- 061_families_details_only.sql: tests for families_details_only (request
-- 230, 2026-11-20).
--
-- What this proves:
--   1. The Front Desk still changes a family's name, phone and address.
--   2. Nobody changes the date a family was registered, or who registered it.
--   3. Nobody adds a family directly.
--   4. register_family and start_family still make families.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000611', 't061-desk@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000611', 'T61 Desk', 't061-desk@test.rhema', 'front_desk');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T61 Mother', '1988-02-02', 'female', '00000000-0000-0000-0000-000000000611');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611"}', true);
set local role authenticated;
select public.register_family('{"name": "T61 Adeyemi", "address": "1 Old Road"}',
  '{"full_name": "T61 Tola Adeyemi", "date_of_birth": "1990-01-01", "sex": "female"}');
reset role;


-- ===== 1. The details change =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611"}', true);
set local role authenticated;
update public.families set address = '2 New Road', phone = '08035550161', name = 'T61 Adeyemi-Cole'
 where name = 'T61 Adeyemi';
reset role;
do $$
begin
  if not exists (select 1 from public.families where name = 'T61 Adeyemi-Cole'
                 and address = '2 New Road' and phone = '08035550161') then
    raise exception 'FAIL 1: the Front Desk could not change the family''s details';
  end if;
end $$;
\echo 'PASS 1: the Front Desk changes the name, phone and address'


-- ===== 2 and 3. Not the date, not the author, not a new family =====
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611"}', true);
  set local role authenticated;
  begin
    update public.families set created_at = now() - interval '5 years' where name = 'T61 Adeyemi-Cole';
    raise exception 'FAIL 2: the registration date was changed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.families set created_by = null where name = 'T61 Adeyemi-Cole';
    raise exception 'FAIL 2: who registered the family was changed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.families (name) values ('T61 Empty');
    raise exception 'FAIL 3: a family was added directly';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;
\echo 'PASS 2: nobody changes the registration date or the author'
\echo 'PASS 3: nobody adds a family directly'


-- ===== 4. The two doors still work =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000611"}', true);
set local role authenticated;
select public.start_family((select id from public.patients where full_name = 'T61 Mother'));
reset role;
do $$
begin
  if (select family_id from public.patients where full_name = 'T61 Mother') is null
     or (select family_id from public.patients where full_name = 'T61 Tola Adeyemi') is null then
    raise exception 'FAIL 4: register_family or start_family no longer makes a family';
  end if;
end $$;
\echo 'PASS 4: register_family and start_family still make families'

rollback;
