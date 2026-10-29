-- =============================================================================
-- 002_matron_and_admin.sql: tests for the matron role and the admin power.
--
-- What this is: proves a matron starts with the right access, that a doctor
-- with admin ticked can manage staff, that a doctor without it cannot, and
-- that the last admin can never be removed.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: a matron, a director (doctor + admin), a plain doctor ==========

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'matron@test.rhema'),
  ('00000000-0000-0000-0000-0000000000d2', 'director@test.rhema'),
  ('00000000-0000-0000-0000-0000000000d3', 'doctor@test.rhema');

insert into public.staff (id, full_name, email, role, can_admin) values
  ('00000000-0000-0000-0000-0000000000d1', 'Test Matron',   'matron@test.rhema',   'matron', false),
  ('00000000-0000-0000-0000-0000000000d2', 'Dr. Test Head', 'director@test.rhema', 'doctor', true),
  ('00000000-0000-0000-0000-0000000000d3', 'Dr. Test Plain','doctor@test.rhema',   'doctor', false);


-- ===== 1. A matron starts with the record and announcements, not admin =======
do $$
begin
  if not (select can_medical and can_announce from public.staff where email = 'matron@test.rhema') then
    raise exception 'FAIL 1: matron should start with medical records and announcements';
  end if;
  if (select can_admin or can_logs or can_pharmacy from public.staff where email = 'matron@test.rhema') then
    raise exception 'FAIL 1: matron should not start as admin, logs or pharmacy';
  end if;
end $$;
\echo 'PASS 1: a matron starts with the right access'


-- ===== 2. A doctor made admin at invite gets the admin power and the log =====
do $$
begin
  if not (select can_admin and can_logs and can_medical from public.staff where email = 'director@test.rhema') then
    raise exception 'FAIL 2: a doctor invited as admin should be admin, see logs and keep medical';
  end if;
end $$;
\echo 'PASS 2: a doctor can also be an admin'


-- ===== 3. The doctor-admin can change staff; a plain doctor cannot ===========
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3"}', true);
set local role authenticated;
update public.staff set can_admin = true where email = 'doctor@test.rhema';
reset role;
do $$
begin
  if (select can_admin from public.staff where email = 'doctor@test.rhema') then
    raise exception 'FAIL 3: a plain doctor made himself an admin';
  end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2"}', true);
set local role authenticated;
update public.staff set can_admin = true where email = 'matron@test.rhema';
reset role;
do $$
begin
  if not (select can_admin from public.staff where email = 'matron@test.rhema') then
    raise exception 'FAIL 3: the director could not make the matron an admin';
  end if;
end $$;
\echo 'PASS 3: only an admin can give the admin power'


-- ===== 4. The last admin can never be removed ================================
-- Remove every admin but the director, as the database owner, then try to
-- remove the director's admin power too.
update public.staff set can_admin = false where can_admin and email <> 'director@test.rhema';
do $$
begin
  update public.staff set can_admin = false where email = 'director@test.rhema';
  raise exception 'FAIL 4: the last admin was removed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
\echo 'PASS 4: the last admin cannot be removed'

rollback;
\echo 'ALL MATRON AND ADMIN TESTS PASSED'
