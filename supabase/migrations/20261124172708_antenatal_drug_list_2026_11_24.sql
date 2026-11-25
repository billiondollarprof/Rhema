-- =============================================================================
-- 20261124172708_antenatal_drug_list_2026_11_24.sql
--
-- What this is: the antenatal drugs on the midwives' handwritten list (photo
-- of 2026-11-24) that the medicine list did not have yet, added as standard
-- starter lines. Nothing already there is changed or removed.
--
-- Why: Anthony, 2026-11-24 (request 246): "If any medicine is not on the
-- pharmacy list yet, include it on the pharmacy list." The antenatal visit
-- picks its drugs from this list. Brand names stay as the midwives wrote
-- them, so a search finds what is typed. The Pharmacy confirms them later.
--
-- Then, with his yes the same day: "if there are others that were not
-- added, you could have still added... the milligrams, don't guess that
-- much." So common antenatal haematinics and supplements are added too, and
-- a strength is written only where the list or a check online gave it; the
-- rest carry their form only (tablet, syrup). "Other" still types any.
--
-- Rules: insert only; a line already there (same name and strength, any
-- letter case) is skipped, so running it twice adds nothing.
--
-- Never: change or remove a line already on the list.
-- =============================================================================

insert into public.medicine_list (name, strength, kind, status, source, added_by)
select v.name, v.strength, v.kind, 'standard', 'starter', null
from (values
  -- On the midwives' list and already on the medicine list: skipped.
  ('Natal Gold', 'tablet', 'medicine'),
  ('Pregmom', 'capsule', 'medicine'),
  ('Pregmom Plus', 'softgel', 'medicine'),
  ('Pregnacare', 'tablet', 'medicine'),
  ('Pregnacare Plus', 'tablet and omega-3 capsule', 'medicine'),
  ('Augmentin', '1 g tablet', 'medicine'),
  ('Swidar', '500/25 mg tablet', 'medicine'),
  ('W.H.O. (Kirk)', 'multiple micronutrient tablet', 'medicine'),
  ('Multiple micronutrient supplement (MMS)', 'tablet', 'medicine'),
  ('Flagyl', '200 mg tablet', 'medicine'),
  ('Flagyl', '400 mg tablet', 'medicine'),
  ('Fesolate', 'tablet', 'medicine'),
  ('Curefenac', '100 mg tablet', 'medicine'),
  ('Infacol', 'suspension', 'medicine'),
  ('Bromocriptine', '2.5 mg tablet', 'medicine'),
  ('Chemiron', 'syrup', 'medicine'),
  ('Chemiron', 'capsule', 'medicine'),
  ('Ranferon-12', 'syrup', 'medicine'),
  ('Ranferon-12', 'capsule', 'medicine'),
  ('Astymin Forte', 'capsule', 'medicine')
) as v(name, strength, kind)
where not exists (
  select 1 from public.medicine_list m
  where lower(m.name) = lower(v.name)
    and lower(coalesce(m.strength, '')) = lower(coalesce(v.strength, ''))
);
