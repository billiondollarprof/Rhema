-- =============================================================================
-- 039_more_starter_medicines_and_doses.sql: tests for the bigger starter
-- medicine list and the milligram doses (request 196b, 2026-11-16).
--
-- What this proves: the new medicines are there with their strengths, as
-- standard starter lines; no medicine and strength is listed twice; the
-- first starter list is still whole; the dose picker has the milligram
-- doses in order, with "As directed" last; and the rights did not change.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== 1. The new medicines are there, standard and marked starter =====
do $$
declare
  missing text;
begin
  select string_agg(n || ' ' || s, ', ') into missing
  from (values
    ('Artemether and lumefantrine', '80/480 mg tablet'),
    ('Losartan', '50 mg tablet'),
    ('Insulin, premixed 30/70', '100 IU/ml injection'),
    ('Tranexamic acid', '500 mg/5 ml injection'),
    ('Ondansetron', '4 mg/2 ml injection'),
    ('IV cannula', '18G')
  ) as want (n, s)
  where not exists (
    select 1 from public.medicine_list m
    where m.name = want.n and m.strength = want.s
      and m.status = 'standard' and m.source = 'starter' and m.added_by is null
  );
  if missing is not null then
    raise exception 'FAIL 1: missing starter lines: %', missing;
  end if;
  if (select count(*) from public.medicine_list where source = 'starter') < 450 then
    raise exception 'FAIL 1: the starter list is too short (% lines)', (select count(*) from public.medicine_list where source = 'starter');
  end if;
end $$;
\echo 'PASS 1: the new medicines are there, standard and marked starter'


-- ===== 2. No medicine and strength twice; the first list is whole =====
do $$
begin
  if exists (
    select 1 from public.medicine_list where status = 'standard'
    group by lower(trim(name)), lower(coalesce(trim(strength), '')) having count(*) > 1
  ) then
    raise exception 'FAIL 2: a medicine and strength is listed twice';
  end if;
  if not exists (select 1 from public.medicine_list where name = 'Paracetamol' and strength = '500 mg tablet')
     or not exists (select 1 from public.medicine_list where name = 'Adhesive plaster' and strength = '1 roll') then
    raise exception 'FAIL 2: a line from the first starter list is gone';
  end if;
  if exists (select 1 from public.medicine_list where strength is null or length(trim(strength)) = 0) then
    raise exception 'FAIL 2: a starter line has no strength to pick';
  end if;
end $$;
\echo 'PASS 2: no medicine and strength twice; the first list is whole'


-- ===== 3. The dose picker: milligram doses, in order, As directed last =====
do $$
declare
  labels text[];
begin
  select array_agg(label order by position, label) into labels
  from public.pick_options where list = 'dose' and standard;
  if not ('10 mg' = any (labels) and '40 mg' = any (labels) and '2 g' = any (labels) and '500 mcg' = any (labels)) then
    raise exception 'FAIL 3: milligram doses are missing: %', labels;
  end if;
  if labels[array_length(labels, 1)] <> 'As directed' then
    raise exception 'FAIL 3: As directed is not last: %', labels;
  end if;
  if array_position(labels, '100 mg') > array_position(labels, '150 mg')
     or array_position(labels, '850 mg') > array_position(labels, '1 g')
     or array_position(labels, '1 g') > array_position(labels, '1.2 g') then
    raise exception 'FAIL 3: the milligram doses are out of order: %', labels;
  end if;
  if (select count(*) from public.pick_options where list = 'dose' group by key order by 1 desc limit 1) > 1 then
    raise exception 'FAIL 3: a dose is listed twice';
  end if;
end $$;
\echo 'PASS 3: the dose picker has the milligram doses, in order, As directed last'


-- ===== 4. The rights did not change =====
do $$
begin
  if has_table_privilege('anon', 'public.medicine_list', 'SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('anon', 'public.pick_options', 'SELECT, INSERT, UPDATE, DELETE') then
    raise exception 'FAIL 4: the public has rights on the lists';
  end if;
  if has_table_privilege('authenticated', 'public.pick_options', 'INSERT, UPDATE, DELETE') then
    raise exception 'FAIL 4: signed in users write the pick lists by hand';
  end if;
end $$;
\echo 'PASS 4: the rights did not change'

rollback;
