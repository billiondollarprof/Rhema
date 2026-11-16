-- =============================================================================
-- 20261112124143_pick_lists_registration_lab.sql
--
-- What this is: more lists to pick from instead of typing.
--   - For the Front Desk's registration card: the next of kin's relationship,
--     the State, the local government (Delta and Edo), and the town.
--   - A list that remembers lab tests typed with "Other", so a test asked
--     for once is there to pick next time. (The usual tests themselves, with
--     their parts and normal ranges, live in the app: web/lib/lab/catalogue.)
--
-- Why: Anthony, 2026-11-12: "it's run the SQL, and the same for the
-- registration, the front desk. For the lab, the same as well."
--
-- Rules:
--   - Each list is used by the people whose work it is:
--       dose, how often, allergen, reaction, condition: medical record
--         access, and the Pharmacy (as before);
--       lab test: medical record access, and the Laboratory;
--       relationship, State, local government, town, occupation, tribe:
--         anybody who may see patients (the Front Desk registers; others
--         read the card; the antenatal card asks occupation and tribe).
--   - Everything else is as in migration pick_options: typed lines are the
--     typist's own until a second person types the same; standard lines are
--     never removed.
--
-- Never: let somebody read or add to a list that is not part of their work.
-- =============================================================================


-- ===== 1. The new lists =====
alter table public.pick_options drop constraint pick_options_list_check;
alter table public.pick_options add constraint pick_options_list_check
  check (list in ('dose', 'frequency', 'allergen', 'reaction', 'condition', 'lab_test', 'relationship', 'state', 'lga', 'town', 'occupation', 'tribe'));


-- ===== 2. Who may use which list =====
create function private.can_use_pick_list(p_list text)
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

revoke execute on function private.can_use_pick_list(text) from public, anon;
grant  execute on function private.can_use_pick_list(text) to authenticated;

drop policy pick_options_read on public.pick_options;
create policy pick_options_read on public.pick_options
  for select to authenticated
  using (
    private.can_use_pick_list(list)
    and (
      standard
      or exists (
        select 1 from public.pick_option_users u
        where u.option_id = pick_options.id and u.staff_id = (select auth.uid())
      )
    )
  );


-- ===== 3. Type one that is missing (now list by list) =====
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
  if not private.can_use_pick_list(p_list) then
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


-- ===== 4. The starter lists for registration =====
insert into public.pick_options (list, label, key, standard, source, position)
select list, label, private.vital_key(label), true, 'starter', position
from (values
  ('relationship', 'Husband', 1),
  ('relationship', 'Wife', 2),
  ('relationship', 'Father', 3),
  ('relationship', 'Mother', 4),
  ('relationship', 'Son', 5),
  ('relationship', 'Daughter', 6),
  ('relationship', 'Brother', 7),
  ('relationship', 'Sister', 8),
  ('relationship', 'Uncle', 9),
  ('relationship', 'Aunt', 10),
  ('relationship', 'Cousin', 11),
  ('relationship', 'Nephew', 12),
  ('relationship', 'Niece', 13),
  ('relationship', 'Grandfather', 14),
  ('relationship', 'Grandmother', 15),
  ('relationship', 'Grandson', 16),
  ('relationship', 'Granddaughter', 17),
  ('relationship', 'Father-in-law', 18),
  ('relationship', 'Mother-in-law', 19),
  ('relationship', 'Brother-in-law', 20),
  ('relationship', 'Sister-in-law', 21),
  ('relationship', 'Guardian', 22),
  ('relationship', 'Friend', 23),
  ('relationship', 'Neighbour', 24),
  ('relationship', 'Employer', 25),
  ('state', 'Delta', 1),
  ('state', 'Abia', 2),
  ('state', 'Adamawa', 3),
  ('state', 'Akwa Ibom', 4),
  ('state', 'Anambra', 5),
  ('state', 'Bauchi', 6),
  ('state', 'Bayelsa', 7),
  ('state', 'Benue', 8),
  ('state', 'Borno', 9),
  ('state', 'Cross River', 10),
  ('state', 'Ebonyi', 11),
  ('state', 'Edo', 12),
  ('state', 'Ekiti', 13),
  ('state', 'Enugu', 14),
  ('state', 'FCT Abuja', 15),
  ('state', 'Gombe', 16),
  ('state', 'Imo', 17),
  ('state', 'Jigawa', 18),
  ('state', 'Kaduna', 19),
  ('state', 'Kano', 20),
  ('state', 'Katsina', 21),
  ('state', 'Kebbi', 22),
  ('state', 'Kogi', 23),
  ('state', 'Kwara', 24),
  ('state', 'Lagos', 25),
  ('state', 'Nasarawa', 26),
  ('state', 'Niger', 27),
  ('state', 'Ogun', 28),
  ('state', 'Ondo', 29),
  ('state', 'Osun', 30),
  ('state', 'Oyo', 31),
  ('state', 'Plateau', 32),
  ('state', 'Rivers', 33),
  ('state', 'Sokoto', 34),
  ('state', 'Taraba', 35),
  ('state', 'Yobe', 36),
  ('state', 'Zamfara', 37),
  ('lga', 'Sapele', 1),
  ('lga', 'Aniocha North', 2),
  ('lga', 'Aniocha South', 3),
  ('lga', 'Bomadi', 4),
  ('lga', 'Burutu', 5),
  ('lga', 'Ethiope East', 6),
  ('lga', 'Ethiope West', 7),
  ('lga', 'Ika North East', 8),
  ('lga', 'Ika South', 9),
  ('lga', 'Isoko North', 10),
  ('lga', 'Isoko South', 11),
  ('lga', 'Ndokwa East', 12),
  ('lga', 'Ndokwa West', 13),
  ('lga', 'Okpe', 14),
  ('lga', 'Oshimili North', 15),
  ('lga', 'Oshimili South', 16),
  ('lga', 'Patani', 17),
  ('lga', 'Udu', 18),
  ('lga', 'Ughelli North', 19),
  ('lga', 'Ughelli South', 20),
  ('lga', 'Ukwuani', 21),
  ('lga', 'Uvwie', 22),
  ('lga', 'Warri North', 23),
  ('lga', 'Warri South', 24),
  ('lga', 'Warri South West', 25),
  ('lga', 'Akoko-Edo', 26),
  ('lga', 'Egor', 27),
  ('lga', 'Esan Central', 28),
  ('lga', 'Esan North-East', 29),
  ('lga', 'Esan South-East', 30),
  ('lga', 'Esan West', 31),
  ('lga', 'Etsako Central', 32),
  ('lga', 'Etsako East', 33),
  ('lga', 'Etsako West', 34),
  ('lga', 'Igueben', 35),
  ('lga', 'Ikpoba-Okha', 36),
  ('lga', 'Oredo', 37),
  ('lga', 'Orhionmwon', 38),
  ('lga', 'Ovia North-East', 39),
  ('lga', 'Ovia South-West', 40),
  ('lga', 'Owan East', 41),
  ('lga', 'Owan West', 42),
  ('lga', 'Uhunmwonde', 43),
  ('town', 'Sapele', 1),
  ('town', 'Amukpe', 2),
  ('town', 'Oghara', 3),
  ('town', 'Mosogar', 4),
  ('town', 'Jesse', 5),
  ('town', 'Orerokpe', 6),
  ('town', 'Adeje', 7),
  ('town', 'Elume', 8),
  ('town', 'Abraka', 9),
  ('town', 'Eku', 10),
  ('town', 'Warri', 11),
  ('town', 'Effurun', 12),
  ('town', 'Ughelli', 13),
  ('town', 'Koko', 14),
  ('town', 'Benin City', 15),
  ('town', 'Asaba', 16),
  ('town', 'Agbor', 17),
  ('occupation', 'Business', 1),
  ('occupation', 'Trader', 2),
  ('occupation', 'Civil servant', 3),
  ('occupation', 'Teacher', 4),
  ('occupation', 'Farmer', 5),
  ('occupation', 'Student', 6),
  ('occupation', 'Housewife', 7),
  ('occupation', 'Artisan', 8),
  ('occupation', 'Health worker', 9),
  ('occupation', 'Driver', 10),
  ('occupation', 'Banker', 11),
  ('occupation', 'Engineer', 12),
  ('occupation', 'Self employed', 13),
  ('occupation', 'Unemployed', 14),
  ('occupation', 'Retired', 15),
  ('tribe', 'Urhobo', 1),
  ('tribe', 'Itsekiri', 2),
  ('tribe', 'Isoko', 3),
  ('tribe', 'Ijaw', 4),
  ('tribe', 'Igbo', 5),
  ('tribe', 'Yoruba', 6),
  ('tribe', 'Hausa', 7),
  ('tribe', 'Bini (Edo)', 8),
  ('tribe', 'Ukwuani', 9),
  ('tribe', 'Ika', 10),
  ('tribe', 'Esan', 11),
  ('tribe', 'Ibibio', 12),
  ('tribe', 'Efik', 13)
) as starter (list, label, position)
on conflict (list, key) do nothing;
