-- =============================================================================
-- Undo for 20261112124143_pick_lists_registration_lab.sql
--
-- Removes the registration lists and the lab test list, and puts back the
-- earlier rule (only medical record access and the Pharmacy use the lists).
-- Lines people typed in these lists are lost; records keep their own words.
-- =============================================================================

delete from public.pick_option_users
where option_id in (select id from public.pick_options where list in ('lab_test', 'relationship', 'state', 'lga', 'town', 'occupation', 'tribe'));
delete from public.pick_options where list in ('lab_test', 'relationship', 'state', 'lga', 'town', 'occupation', 'tribe');

create or replace function private.forget_pick_option(p_list text, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  the_key text := private.vital_key(p_label);
  found_id bigint;
begin
  if not (select private.can_see_medicines()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select id into found_id from public.pick_options
  where list = p_list and key = the_key and not standard;
  if found_id is null then
    return;
  end if;
  delete from public.pick_option_users where option_id = found_id and staff_id = (select auth.uid());
  if not exists (select 1 from public.pick_option_users where option_id = found_id) then
    delete from public.pick_options where id = found_id and not standard;
  end if;
end;
$$;

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
  if not (select private.can_see_medicines()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_list not in ('dose', 'frequency', 'allergen', 'reaction', 'condition')
     or length(clean_label) not between 1 and 80 or length(the_key) < 1 then
    raise exception 'Check the list and the words' using errcode = '22023';
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

drop policy pick_options_read on public.pick_options;
create policy pick_options_read on public.pick_options
  for select to authenticated
  using (
    (select private.can_see_medicines())
    and (
      standard
      or exists (
        select 1 from public.pick_option_users u
        where u.option_id = pick_options.id and u.staff_id = (select auth.uid())
      )
    )
  );

drop function if exists private.can_use_pick_list(text);

alter table public.pick_options drop constraint pick_options_list_check;
alter table public.pick_options add constraint pick_options_list_check
  check (list in ('dose', 'frequency', 'allergen', 'reaction', 'condition'));
