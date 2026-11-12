-- =============================================================================
-- 20261112105211_master_account_admin.sql
--
-- What this is: the master account (rhemamedical7@gmail.com) is made an admin
-- again, with the admin power on.
--
-- Why: Anthony, 2026-11-12: "I mistakenly made myself a front desk without
-- admin access... I think you should make me an admin from the database, this
-- Gmail account rhemamedical7@gmail.com, because the director is not around."
-- Without the admin power nobody on live could change it back from the app.
--
-- Rules:
--   - Only the row with that one email changes: its role becomes admin and it
--     gets the ticks an admin has (patients, medical record, dispensing, lab,
--     announcements, admin power, activity log).
--   - If it is already an admin, nothing happens. If the email is not on this
--     database, nothing happens.
--   - No other account is touched.
--
-- Never: touch any other account.
-- =============================================================================


-- ===== 1. The role and the admin power =====

-- The ticks an admin has, the same as the testing role switch sets for admin
-- (testing-role.yml). A role changed after an account is made does not reset
-- the ticks by itself, so they are set here.
update public.staff
set role = 'admin',
    can_patients = true,
    can_medical = true,
    can_pharmacy = true,
    can_lab = true,
    can_announce = true,
    can_admin = true,
    can_logs = true
where lower(email) = 'rhemamedical7@gmail.com'
  and (role <> 'admin' or not can_admin or not can_medical or not can_logs);
