-- =============================================================================
-- 20261111175805_patients_edit_front_desk.sql
--
-- What this is: only the Front Desk may change a patient's registration
-- details. Today anybody who may see patients can.
--
-- Why: Anthony, 2026-11-11: "the nurse, the doctor, the pharmacist, the lab,
-- they should not be able [to edit details the front desk entered]. It's only
-- front desk that can register a patient and edit patient details." The
-- Edit button is already hidden on the screen; this makes the database refuse
-- it too (CLAUDE.md section 10: access is checked in the database).
--
-- Rules:
--   - Reading patients is unchanged. Registering was limited to the Front Desk
--     in migration doctor_notes_front_desk_registers_med_edit.
--   - Everything the system itself keeps up to date (a patient number, a
--     family card, last seen) is done by functions that run with their own
--     rights, so none of it is affected.
--   - Nothing is deleted or changed in the data.
--
-- Never: let a nurse, doctor, pharmacist, laboratory or admin change a
-- patient's details.
-- =============================================================================


-- ===== 1. Who may change a patient =====
drop policy patients_update on public.patients;
create policy patients_update on public.patients
  for update to authenticated
  using ((select private.has_permission('patients')) and (select private.is_front_desk()))
  with check ((select private.has_permission('patients')) and (select private.is_front_desk()));
