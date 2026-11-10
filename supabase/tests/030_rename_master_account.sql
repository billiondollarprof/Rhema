-- =============================================================================
-- 030_rename_master_account.sql: tests for the rename.
--
-- What this is: runs the migration again over made up rows and proves only
-- the master account's name changes.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000301', 'rhemamedical7@gmail.com'),
  ('00000000-0000-0000-0000-000000000302', 'someone-else@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000301', 'Dr. Evans', 'rhemamedical7@gmail.com', 'admin'),
  ('00000000-0000-0000-0000-000000000302', 'Dr. Evans', 'someone-else@test.rhema', 'doctor');

\i supabase/migrations/20261110154435_rename_master_account.sql

do $$
begin
  if (select full_name from public.staff where email = 'rhemamedical7@gmail.com') <> 'Master Account' then
    raise exception 'FAIL 1: the master account was not renamed';
  end if;
  if (select full_name from public.staff where email = 'someone-else@test.rhema') <> 'Dr. Evans' then
    raise exception 'FAIL 1: another account was renamed';
  end if;
end $$;
\echo 'PASS 1: only the master account is renamed'

rollback;
