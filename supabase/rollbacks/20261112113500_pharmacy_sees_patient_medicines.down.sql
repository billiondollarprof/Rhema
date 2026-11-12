-- =============================================================================
-- Undo for 20261112113500_pharmacy_sees_patient_medicines.sql
--
-- Takes the Pharmacy's view of a patient's medicines away. Nothing saved is
-- lost; the lines already written to the activity log stay.
-- =============================================================================

drop function if exists public.patient_medicines_for_pharmacy(bigint);
drop function if exists private.patient_medicines_for_pharmacy(bigint);
