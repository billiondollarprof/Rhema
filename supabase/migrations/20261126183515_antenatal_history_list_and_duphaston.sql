-- =============================================================================
-- 20261126183515_antenatal_history_list_and_duphaston.sql
--
-- What this is:
--   1. A new pick list, antenatal_history: the antenatal card's medical
--      history. Anything a doctor, nurse or matron types with Other is kept,
--      and can be saved for everybody, like the other lists.
--   2. It starts with the 14 lines on the card today.
--   3. Duphaston 10 mg tablet on the medicine list, under its brand name,
--      so typing "Duph" finds it (dydrogesterone 10 mg is already there).
--
-- Why: Anthony, 2026-11-26 (requests 253, 254): "when they add, the system
-- can keep that and ask them to make it a standard, so next time it
-- becomes part of it seamlessly" (CLAUDE.md, "Pick, never type"). The
-- matron: "Dufrastone is not there." His yes to the batch, 2026-11-26.
--
-- Rules: only adds. The list check and the "type one that is missing"
-- function each gain one name; the rule for who may use a list gains one
-- line (medical access); the starter lines and the medicine are skipped if
-- they are there already.
--
-- Never: let somebody without medical access read or add to this list.
-- =============================================================================


-- ===== 1. The new list name =====
alter table public.pick_options drop constraint pick_options_list_check;
alter table public.pick_options add constraint pick_options_list_check
  check (list in ('dose', 'frequency', 'allergen', 'reaction', 'condition', 'lab_test',
                  'relationship', 'state', 'lga', 'town', 'occupation', 'tribe',
                  'antenatal_history'));


-- ===== 2. Who may use it: anybody with medical access =====
create or replace function private.can_use_pick_list(p_list text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_list in ('dose', 'frequency', 'allergen', 'reaction', 'condition')
      then private.can_see_medicines()
    when p_list = 'lab_test'
      then private.has_permission('medical') or private.has_permission('lab')
    when p_list in ('relationship', 'state', 'lga', 'town', 'occupation', 'tribe')
      then private.has_permission('patients')
    when p_list = 'antenatal_history'
      then private.has_permission('medical')
    else false
  end;
$$;

revoke execute on function private.can_use_pick_list(text) from public, anon;
grant  execute on function private.can_use_pick_list(text) to authenticated;


-- ===== 2b. Typing one that is missing: the function knows the new name =====
-- The same function as before (20261112124143), with antenatal_history in
-- its list of names. Nothing else in it changes.
create or replace function private.use_pick_option(p_list text, p_label text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_label text := regexp_replace(trim(coalesce(p_label, '')), '\s+', ' ', 'g');
  the_key text := private.vital_key(clean_label);
  found_id bigint;
  found_label text;
  is_standard boolean;
  me uuid := (select auth.uid());
begin
  if p_list not in ('dose', 'frequency', 'allergen', 'reaction', 'condition', 'lab_test', 'relationship', 'state', 'lga', 'town', 'occupation', 'tribe', 'antenatal_history')
     or length(clean_label) not between 1 and 80 or length(the_key) < 1 then
    raise exception 'Check the list and the words' using errcode = '22023';
  end if;
  if not private.can_use_pick_list(p_list) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  insert into public.pick_options (list, label, key)
  values (p_list, clean_label, the_key)
  on conflict (list, key) do update set list = public.pick_options.list
  returning id, label, standard into found_id, found_label, is_standard;

  if not is_standard then
    insert into public.pick_option_users (option_id, staff_id)
    values (found_id, me)
    on conflict do nothing;

    update public.pick_options
    set standard = true
    where id = found_id and not standard
      and (select count(*) from public.pick_option_users where option_id = found_id) >= 2;
  end if;

  return found_label;
end;
$$;


-- ===== 3. The lines on the card today, standard from the start =====
insert into public.pick_options (list, label, key, standard, source, position)
select 'antenatal_history', label, private.vital_key(label), true, 'starter', position
from (values
  ('Diabetes mellitus', 1),
  ('Chronic nephritis', 2),
  ('Previous accident', 3),
  ('Rickets', 4),
  ('Tuberculosis', 5),
  ('Epilepsy', 6),
  ('Asthma', 7),
  ('Anaemia', 8),
  ('Sickle cell anaemia', 9),
  ('Hypertension', 10),
  ('Pre-eclampsia', 11),
  ('Eclampsia', 12),
  ('Spotting in pregnancy', 13),
  ('Threatened miscarriage (threatened abortion)', 14)
) as card (label, position)
on conflict do nothing;


-- ===== 4. Duphaston, under its brand name =====
insert into public.medicine_list (name, strength, kind, status, source, added_by)
select 'Duphaston', '10 mg tablet', 'medicine', 'standard', 'starter', null
where not exists (
  select 1 from public.medicine_list m
  where lower(m.name) = 'duphaston' and lower(coalesce(m.strength, '')) = '10 mg tablet'
);
