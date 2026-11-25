-- =============================================================================
-- Undo the antenatal drug list of 2026-11-24: removes the lines it added,
-- only where nobody has used them since (no stock move names them).
-- WARNING: run only if asked.
-- =============================================================================

delete from public.medicine_list m
using (values
  ('Pregmom', 'capsule'),
  ('Pregmom Plus', 'softgel'),
  ('Pregnacare', 'tablet'),
  ('Pregnacare Plus', 'tablet and omega-3 capsule'),
  ('Augmentin', '1 g tablet'),
  ('Swidar', '500/25 mg tablet'),
  ('W.H.O. (Kirk)', 'multiple micronutrient tablet'),
  ('Multiple micronutrient supplement (MMS)', 'tablet'),
  ('Flagyl', '200 mg tablet'),
  ('Flagyl', '400 mg tablet'),
  ('Fesolate', 'tablet'),
  ('Curefenac', '100 mg tablet'),
  ('Infacol', 'suspension'),
  ('Bromocriptine', '2.5 mg tablet'),
  ('Chemiron', 'syrup'),
  ('Chemiron', 'capsule'),
  ('Ranferon-12', 'syrup'),
  ('Ranferon-12', 'capsule'),
  ('Astymin Forte', 'capsule')
) as v(name, strength)
where lower(m.name) = lower(v.name)
  and lower(coalesce(m.strength, '')) = lower(coalesce(v.strength, ''))
  and m.source = 'starter'
  and not exists (select 1 from public.stock_moves s where s.medicine_id = m.id);
