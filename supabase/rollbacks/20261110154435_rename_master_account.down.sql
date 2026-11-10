-- =============================================================================
-- Undo for 20261110154435_rename_master_account.sql
--
-- Gives the master account its old name back, "Dr. Evans".
-- =============================================================================

update public.staff
set full_name = 'Dr. Evans'
where lower(email) = 'rhemamedical7@gmail.com'
  and full_name = 'Master Account';
