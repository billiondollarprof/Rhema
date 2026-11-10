-- =============================================================================
-- 20261110154435_rename_master_account.sql
--
-- What this is: the master account (Anthony's, the admin) is renamed from
-- "Dr. Evans" to "Master Account".
--
-- Why: Anthony, 2026-11-10: "we currently have two doctor Evans, so change
-- the name of the doctor Evans with this email rhemamedical7@gmail.com to
-- Master Account." The real Dr. Evans (the director) has his own account.
--
-- Rules:
--   - Only the row with that one email changes, and only its name.
--   - If the email is not on this database, nothing happens.
--   - Old activity log lines keep their numbers, and show the new name.
--
-- Never: touch any other account.
-- =============================================================================


-- ===== 1. The name =====

update public.staff
set full_name = 'Master Account'
where lower(email) = 'rhemamedical7@gmail.com'
  and full_name <> 'Master Account';
