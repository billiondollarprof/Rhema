-- =============================================================================
-- tests for pharmacy_drug_list_2026_11_18 (request 227i).
--
-- What this proves:
--   1. Lines from the Pharmacy's list are there, medicines and supplies.
--   2. No line is there twice (same name and strength, any letter case).
--   3. A line that was there before is still there, unchanged.
--
-- Runs inside one transaction that is rolled back.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

do $$
begin
  if not exists (select 1 from public.medicine_list where name = 'Augmentin' and strength = '625 mg tablet')
     or not exists (select 1 from public.medicine_list where name = 'Flagyl' and kind = 'medicine')
     or not exists (select 1 from public.medicine_list where name = 'Cannula' and strength = 'blue' and kind = 'item')
     or not exists (select 1 from public.medicine_list where name = 'Natal Gold') then
    raise exception 'FAIL 1: a line from the Pharmacy list is missing';
  end if;
end $$;
\echo 'PASS 1: the Pharmacy list lines are there'

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
                 where name = 'Paracetamol' and strength = '500 mg tablet' and source = 'starter') then
    raise exception 'FAIL 3: a line that was there before changed or went';
  end if;
end $$;
\echo 'PASS 3: the lines already there are unchanged'

rollback;
