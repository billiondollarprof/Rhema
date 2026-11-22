-- =============================================================================
-- Undo 20261121222211_vital_signs_glucose_pain.sql: no blood glucose or pain
-- score. Readings that held only those would break the old rule, so they are
-- kept by moving nothing: run this only before any such reading exists.
-- =============================================================================

alter table public.vital_signs drop constraint vitals_not_empty;
alter table public.vital_signs
  add constraint vitals_not_empty check (num_nonnulls(systolic, diastolic, pulse, temperature_c,
    breathing_rate, spo2, weight_kg, height_cm) > 0);
alter table public.vital_signs drop constraint vitals_glucose_complete;
alter table public.vital_signs
  drop column blood_glucose,
  drop column glucose_unit,
  drop column glucose_when,
  drop column pain_score;
