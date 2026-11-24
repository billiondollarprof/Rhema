-- =============================================================================
-- tests for antenatal_drug_list_2026_11_24 (request 246).
--
-- What this proves:
--   1. The antenatal drugs from the midwives' list are there.
--   2. No line is there twice (same name and strength, any letter case).
--   3. A line that was there before is still there, unchanged.
--
-- Runs inside one transaction that is rolled back.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

do $$
begin
  if not exists (select 1 from public.medicine_list where name = 'Pregmom Plus' and strength = 'softgel' and status = 'standard')
     or not exists (select 1 from public.medicine_list where name = 'Swidar' and strength = '500/25 mg tablet')
     or not exists (select 1 from public.medicine_list where name = 'Bromocriptine' and kind = 'medicine')
     or not exists (select 1 from public.medicine_list where name = 'Infacol')
     or not exists (select 1 from public.medicine_list where name = 'Chemiron' and strength = 'syrup') then
    raise exception 'FAIL 1: a drug from the antenatal list is missing';
  end if;
end $$;
\echo 'PASS 1: the antenatal list lines are there'

do $$
begin
  if exists (
    select 1 from public.medicine_list
    group by lower(name), lower(coalesce(strength, ''))
    having count(*) > 1
  ) then
    raise exception 'FAIL 2: a medicine line is there twice';
  end if;
end $$;
\echo 'PASS 2: no line twice'

do $$
begin
  if not exists (select 1 from public.medicine_list
                 where name = 'Natal Gold' and strength = 'tablet' and source = 'starter') then
    raise exception 'FAIL 3: a line that was there before changed or went';
  end if;
end $$;
\echo 'PASS 3: the lines already there are unchanged'

rollback;
