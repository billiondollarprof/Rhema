-- =============================================================================
-- 20261112114324_pick_options.sql
--
-- What this is: short lists to pick from instead of typing: doses, how often,
-- allergens, allergic reactions and conditions. Each person can also type
-- one that is missing ("Other"); it stays on their own screen from then on,
-- and becomes standard for everybody once a second person types the same one.
--
-- Why: Anthony, 2026-11-12: "the doses should have a list to pick from and
-- others, just like strength... same with frequency (how often)... the
-- allergies should follow the same pattern... for virtually everything
-- repetitive, so they will have just little to write. When they choose Other,
-- they can type by hand, and also type notes by hand. The aim is to reduce
-- what they type by hand." And, for vital signs, the same learning rule:
-- "it remains for that nurse... except if the system finds the same one typed
-- by another nurse; then it automatically becomes standard."
--
-- Rules:
--   - Five lists: dose, frequency, allergen, reaction, condition.
--   - "The same" means the same words, ignoring capitals, spaces and
--     punctuation.
--   - Everybody with medical record access, and the Pharmacy, reads the
--     standard lines and their own; they add through a function, never by
--     hand. A person can remove a line they typed themselves.
--   - The starter lines are standard from the start.
--   - What is saved on a record is still the words; these lists only help
--     pick them.
--
-- Never: show one person's own typed line to another before a second person
-- has typed it, or let a standard line be removed.
-- =============================================================================


-- ===== 1. The tables =====
create table public.pick_options (
  id         bigint generated always as identity primary key,
  list       text not null check (list in ('dose', 'frequency', 'allergen', 'reaction', 'condition')),
  label      text not null check (length(trim(label)) between 1 and 80),
  key        text not null check (length(key) >= 1),
  standard   boolean not null default false,
  source     text not null default 'staff' check (source in ('starter', 'staff')),
  -- The order a starter list is shown in; typed lines come after.
  position   integer,
  created_at timestamptz not null default now(),
  unique (list, key)
);

create table public.pick_option_users (
  option_id bigint not null references public.pick_options (id),
  staff_id  uuid not null references public.staff (id),
  added_at  timestamptz not null default now(),
  primary key (option_id, staff_id)
);
create index pick_option_users_staff_idx on public.pick_option_users (staff_id);

revoke all on public.pick_options      from anon, authenticated;
revoke all on public.pick_option_users from anon, authenticated;
alter table public.pick_options      enable row level security;
alter table public.pick_option_users enable row level security;

grant select on public.pick_options      to authenticated;
grant select on public.pick_option_users to authenticated;


-- ===== 2. Who can read =====
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

-- Each person sees only their own lines.
create policy pick_option_users_read on public.pick_option_users
  for select to authenticated
  using (staff_id = (select auth.uid()));

create trigger pick_options_activity
  after insert or update on public.pick_options
  for each row execute function private.write_activity();


-- ===== 3. Type one that is missing =====
-- Returns the words to use. If the same thing is already there (a standard
-- line, or a line the person typed before), that line's own words come back,
-- so there is one spelling.
create function private.use_pick_option(p_list text, p_label text)
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

  -- A no-change update, so the line comes back whether it is new or not.
  insert into public.pick_options (list, label, key)
  values (p_list, clean_label, the_key)
  on conflict (list, key) do update set list = public.pick_options.list
  returning id, label, standard into found_id, found_label, is_standard;

  if not is_standard then
    insert into public.pick_option_users (option_id, staff_id)
    values (found_id, me)
    on conflict do nothing;

    -- A second person has typed it: it is standard now.
    update public.pick_options
    set standard = true
    where id = found_id and not standard
      and (select count(*) from public.pick_option_users where option_id = found_id) >= 2;
  end if;

  return found_label;
end;
$$;


-- ===== 4. Remove one I typed (a typing mistake stays nowhere) =====
create function private.forget_pick_option(p_list text, p_label text)
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
  -- Nobody uses it any more: it goes.
  if not exists (select 1 from public.pick_option_users where option_id = found_id) then
    delete from public.pick_options where id = found_id and not standard;
  end if;
end;
$$;

revoke execute on function private.use_pick_option(text, text)    from public, anon;
revoke execute on function private.forget_pick_option(text, text) from public, anon;
grant  execute on function private.use_pick_option(text, text)    to authenticated;
grant  execute on function private.forget_pick_option(text, text) to authenticated;

create function public.use_pick_option(p_list text, p_label text)
returns text language sql security invoker set search_path = ''
as $$ select private.use_pick_option(p_list, p_label); $$;

create function public.forget_pick_option(p_list text, p_label text)
returns void language sql security invoker set search_path = ''
as $$ select private.forget_pick_option(p_list, p_label); $$;

revoke execute on function public.use_pick_option(text, text)    from public, anon;
revoke execute on function public.forget_pick_option(text, text) from public, anon;
grant  execute on function public.use_pick_option(text, text)    to authenticated;
grant  execute on function public.forget_pick_option(text, text) to authenticated;


-- ===== 5. The starter lists =====
-- Usual words, written from general knowledge to save typing. Standard from
-- the start. They can be added to by typing "Other".
insert into public.pick_options (list, label, key, standard, source, position)
select list, label, private.vital_key(label), true, 'starter', position
from (values
  ('dose', '1/2 tablet', 1),
  ('dose', '1 tablet', 2),
  ('dose', '2 tablets', 3),
  ('dose', '3 tablets', 4),
  ('dose', '1 capsule', 5),
  ('dose', '2 capsules', 6),
  ('dose', '2.5 ml', 7),
  ('dose', '5 ml', 8),
  ('dose', '10 ml', 9),
  ('dose', '15 ml', 10),
  ('dose', '20 ml', 11),
  ('dose', '1 sachet', 12),
  ('dose', '1 ampoule', 13),
  ('dose', '1 vial', 14),
  ('dose', '1 puff', 15),
  ('dose', '2 puffs', 16),
  ('dose', '1 drop', 17),
  ('dose', '2 drops', 18),
  ('dose', '1 suppository', 19),
  ('dose', '100 mg', 20),
  ('dose', '250 mg', 21),
  ('dose', '500 mg', 22),
  ('dose', '1 g', 23),
  ('dose', 'As directed', 24),
  ('frequency', 'Once daily', 1),
  ('frequency', 'Twice daily', 2),
  ('frequency', 'Three times daily', 3),
  ('frequency', 'Four times daily', 4),
  ('frequency', 'At night', 5),
  ('frequency', 'In the morning', 6),
  ('frequency', 'Every 4 hours', 7),
  ('frequency', 'Every 6 hours', 8),
  ('frequency', 'Every 8 hours', 9),
  ('frequency', 'Every 12 hours', 10),
  ('frequency', 'Once only (stat)', 11),
  ('frequency', 'Once weekly', 12),
  ('frequency', 'When needed', 13),
  ('allergen', 'Penicillin', 1),
  ('allergen', 'Amoxicillin', 2),
  ('allergen', 'Ampicillin', 3),
  ('allergen', 'Cephalosporins', 4),
  ('allergen', 'Sulfonamides (sulfa drugs)', 5),
  ('allergen', 'Aspirin', 6),
  ('allergen', 'Ibuprofen', 7),
  ('allergen', 'Diclofenac', 8),
  ('allergen', 'Other painkillers (NSAIDs)', 9),
  ('allergen', 'Chloroquine', 10),
  ('allergen', 'Codeine', 11),
  ('allergen', 'Latex', 12),
  ('allergen', 'Adhesive plaster', 13),
  ('allergen', 'Iodine', 14),
  ('allergen', 'Contrast dye', 15),
  ('allergen', 'Egg', 16),
  ('allergen', 'Peanut', 17),
  ('allergen', 'Milk', 18),
  ('allergen', 'Fish', 19),
  ('allergen', 'Shellfish', 20),
  ('allergen', 'Wheat', 21),
  ('allergen', 'Dust', 22),
  ('allergen', 'Pollen', 23),
  ('allergen', 'Insect stings', 24),
  ('reaction', 'Rash', 1),
  ('reaction', 'Itching', 2),
  ('reaction', 'Hives', 3),
  ('reaction', 'Swelling of face or lips', 4),
  ('reaction', 'Difficulty breathing', 5),
  ('reaction', 'Wheezing', 6),
  ('reaction', 'Vomiting', 7),
  ('reaction', 'Diarrhoea', 8),
  ('reaction', 'Dizziness', 9),
  ('reaction', 'Fainting', 10),
  ('reaction', 'Fever', 11),
  ('reaction', 'Collapse (anaphylaxis)', 12),
  ('condition', 'Hypertension', 1),
  ('condition', 'Diabetes (type 2)', 2),
  ('condition', 'Diabetes (type 1)', 3),
  ('condition', 'Asthma', 4),
  ('condition', 'Sickle cell disease', 5),
  ('condition', 'Epilepsy', 6),
  ('condition', 'Heart failure', 7),
  ('condition', 'Stroke', 8),
  ('condition', 'Peptic ulcer', 9),
  ('condition', 'Hepatitis B', 10),
  ('condition', 'HIV', 11),
  ('condition', 'Tuberculosis', 12),
  ('condition', 'Arthritis', 13),
  ('condition', 'Anaemia', 14),
  ('condition', 'Kidney disease', 15),
  ('condition', 'Glaucoma', 16),
  ('condition', 'Thyroid disease', 17),
  ('condition', 'Fibroids', 18),
  ('condition', 'Enlarged prostate', 19),
  ('condition', 'Depression', 20)
) as starter (list, label, position);
