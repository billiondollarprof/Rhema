-- =============================================================================
-- 035_master_account_admin.sql: tests for making the master account an admin.
--
-- What this is: runs the migration again over made up rows and proves only the
-- master account changes, and that a second run changes nothing more.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000351', 'rhemamedical7@gmail.com'),
  ('00000000-0000-0000-0000-000000000352', 'someone-else@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000351', 'Master Account', 'rhemamedical7@gmail.com', 'front_desk'),
  ('00000000-0000-0000-0000-000000000352', 'Someone Else',   'someone-else@test.rhema', 'front_desk');

\i supabase/migrations/20261112105211_master_account_admin.sql

do $$
begin
  if not exists (select 1 from public.staff where email = 'rhemamedical7@gmail.com' and role = 'admin' and can_admin and can_logs and can_medical and can_pharmacy and can_lab and can_announce and can_patients) then
    raise exception 'FAIL 1: the master account is not an admin with the admin power';
  end if;
  if exists (select 1 from public.staff where email = 'someone-else@test.rhema' and (role <> 'front_desk' or can_admin)) then
    raise exception 'FAIL 1: another account was changed';
  end if;
end $$;
\echo 'PASS 1: only the master account becomes an admin'

-- Run again: nothing more happens.
\i supabase/migrations/20261112105211_master_account_admin.sql
do $$
begin
  if (select count(*) from public.staff where role = 'admin' and email = 'rhemamedical7@gmail.com') <> 1 then
    raise exception 'FAIL 2: a second run changed the account';
  end if;
end $$;
\echo 'PASS 2: running it again changes nothing'

rollback;
