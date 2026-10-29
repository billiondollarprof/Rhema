-- =============================================================================
-- Undo for 20261029160000_medical_record.sql
--
-- Removes the whole medical record. Only before real patients exist: on the
-- live database this would destroy medical records, so it must never run
-- there without Anthony's explicit yes in writing.
-- =============================================================================

-- Put the patients rule back exactly as the foundation wrote it.
alter table public.patients drop constraint if exists void_needs_reason;
alter table public.patients add constraint void_needs_reason
  check (voided_at is null or length(trim(void_reason)) > 0);

drop function if exists public.open_record(bigint);
drop function if exists public.change_medication_status(bigint, public.medication_status, text);
drop table if exists public.consultation_notes;
drop table if exists public.nursing_notes;
drop table if exists public.vital_signs;
drop table if exists public.medications_given;
drop table if exists public.medication_status_log;
drop table if exists public.patient_medications;
drop table if exists public.conditions;
drop table if exists public.allergies;
drop table if exists public.medical_profiles;
drop table if exists public.record_openings;
drop function if exists private.log_medication_status();
drop function if exists private.can_use_record(bigint);
drop type if exists public.condition_status;
drop type if exists public.medication_status;
