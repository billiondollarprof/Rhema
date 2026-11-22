-- =============================================================================
-- 20261121222211_vital_signs_glucose_pain.sql
--
-- What this is: two more vital signs. Blood glucose, with whether it was
-- fasting or random and the unit it was read in (mmol/L or mg/dL), and a
-- pain score from 0 to 10. (BMI is worked out on the screen from the weight
-- and the height, so nothing is stored for it.)
--
-- Why: the director's voice note, 2026-11-21 (request 235): "there's no
-- blood glucose... especially for emergency patient. Blood glucose... can be
-- fasting or random... when you click it, it should show whether... fasting
-- when the patient has not eaten or random. And the result." Anthony: blood
-- glucose "is supposed to be like one of the first things"; units "offer
-- both... we always use the UK standard"; pain score and BMI yes.
--
-- Rules:
--   - Every box stays optional. A reading needs at least one value, as before.
--   - Blood glucose comes with fasting or random, and its unit; none of the
--     three without the others.
--   - Sensible ranges: 0.5 to 60 mmol/L, or 10 to 1100 mg/dL; pain 0 to 10.
--   - Who may write, read or void a reading does not change.
--
-- Never: store a glucose without saying fasting or random, or without its
-- unit, because 5.5 means very different things in mmol/L and mg/dL.
-- =============================================================================


-- ===== 1. The new boxes =====
alter table public.vital_signs
  add column blood_glucose numeric(5,1),
  add column glucose_unit  text check (glucose_unit in ('mmol/L', 'mg/dL')),
  add column glucose_when  text check (glucose_when in ('fasting', 'random')),
  add column pain_score    smallint check (pain_score between 0 and 10);

-- A glucose comes with its unit and fasting or random, within its range.
alter table public.vital_signs
  add constraint vitals_glucose_complete check (
    (blood_glucose is null and glucose_unit is null and glucose_when is null)
    or (
      blood_glucose is not null and glucose_unit is not null and glucose_when is not null
      and (
        (glucose_unit = 'mmol/L' and blood_glucose between 0.5 and 60)
        or (glucose_unit = 'mg/dL' and blood_glucose between 10 and 1100)
      )
    )
  );


-- ===== 2. A reading needs at least one value, now counting the new ones =====
alter table public.vital_signs drop constraint vitals_not_empty;
alter table public.vital_signs
  add constraint vitals_not_empty check (num_nonnulls(systolic, diastolic, pulse, temperature_c,
    breathing_rate, spo2, weight_kg, height_cm, blood_glucose, pain_score) > 0);
