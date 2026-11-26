-- =============================================================================
-- Undo for 20261126183515_antenatal_history_list_and_duphaston.sql
--
-- Removes the antenatal history list (its starter lines and any line staff
-- added to it), puts the list check and the list rule back as they were, and
-- removes Duphaston if no stock move names it. Lines staff added would be
-- lost, so on live this needs Anthony's yes in writing.
-- WARNING: run only if asked.
-- =============================================================================

delete from public.pick_option_users
where option_id in (select id from public.pick_options where list = 'antenatal_history');
delete from public.pick_options where list = 'antenatal_history';

alter table public.pick_options drop constraint pick_options_list_check;
alter table public.pick_options add constraint pick_options_list_check
  check (list in ('dose', 'frequency', 'allergen', 'reaction', 'condition', 'lab_test',
                  'relationship', 'state', 'lga', 'town', 'occupation', 'tribe'));

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
    else false
  end;
$$;

-- The function as it was (20261112124143).
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
  if p_list not in ('dose', 'frequency', 'allergen', 'reaction', 'condition', 'lab_test', 'relationship', 'state', 'lga', 'town', 'occupation', 'tribe')
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

delete from public.medicine_list m
where m.name = 'Duphaston' and m.strength = '10 mg tablet' and m.source = 'starter'
  and not exists (select 1 from public.stock_moves s where s.medicine_id = m.id);
