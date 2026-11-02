-- =============================================================================
-- Undo for double_tap_guards: removes the shared guard and its triggers.
-- Nothing already saved changes.
-- =============================================================================

drop trigger if exists patients_check_double                on public.patients;
drop trigger if exists allergies_refuse_double             on public.allergies;
drop trigger if exists conditions_refuse_double            on public.conditions;
drop trigger if exists patient_medications_refuse_double   on public.patient_medications;
drop trigger if exists medications_given_refuse_double     on public.medications_given;
drop trigger if exists vital_signs_refuse_double           on public.vital_signs;
drop trigger if exists nursing_notes_refuse_double         on public.nursing_notes;
drop trigger if exists consultation_notes_refuse_double    on public.consultation_notes;
drop function if exists private.refuse_double();
