-- =============================================================================
-- 20261111160406_medicine_list.sql
--
-- What this is: the hospital's list of medicines (and things like syringes)
-- with their strengths, to pick from instead of typing. Only the Pharmacy
-- adds to it and edits it. A doctor or nurse who types something that is not
-- in the list adds it as PENDING: only that person (and the Pharmacy) sees it,
-- they can use it at once, and it becomes standard for everybody when the
-- Pharmacy confirms it.
--
-- Why: Anthony, 2026-11-11, after a day at the hospital: "they will just tick
-- the medicine... then tick the milligram... in case it is not in the list,
-- they can just add it... the system should remember it... Only the
-- pharmacist edits and adds the list... the doctor can add, but it will be
-- pending the pharmacist's confirmation... it becomes a standard for
-- everybody in the hospital once the pharmacist confirms it. Otherwise, only
-- the person who entered it before can see it." And: "you can populate it
-- first" (a starter list, to be checked by the Pharmacy).
--
-- Rules:
--   - One row is one medicine and one strength (Paracetamol 500 mg tablet).
--   - Pharmacy (the role) adds, edits, confirms and switches off. Nobody
--     deletes. Doctors, nurses, the matron and admins with record access may
--     read the standard list and add pending ones.
--   - The starter list is standard from the start and marked "starter" until
--     the Pharmacy confirms it.
--   - Writing goes through functions, so the same medicine is never listed
--     twice, and the app never has to be trusted with status.
--
-- Never: let anybody but the Pharmacy make a medicine standard, or let one
-- person see another person's pending medicine.
-- =============================================================================


-- ===== 1. Who is the Pharmacy, and who may use the list =====
-- The role, not the "can dispense" tick: doctors and admins hold that tick too.
create function private.is_pharmacist()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and role = 'pharmacy'
  );
$$;

create function private.can_see_medicines()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_pharmacist() or private.has_permission('medical');
$$;

revoke execute on function private.is_pharmacist()      from public, anon;
revoke execute on function private.can_see_medicines()  from public, anon;
grant  execute on function private.is_pharmacist()      to authenticated;
grant  execute on function private.can_see_medicines()  to authenticated;


-- ===== 2. The table =====
create table public.medicine_list (
  id           bigint generated always as identity primary key,
  name         text not null check (length(trim(name)) between 2 and 120),
  strength     text check (strength is null or length(trim(strength)) between 1 and 60),
  kind         text not null default 'medicine' check (kind in ('medicine', 'item')),
  status       text not null default 'pending' check (status in ('standard', 'pending')),
  -- Where it came from: the Pharmacy, a doctor or nurse (pending), or the
  -- starter list that the Pharmacy has not confirmed yet.
  source       text not null default 'pharmacy' check (source in ('pharmacy', 'staff', 'starter')),
  is_active    boolean not null default true,
  added_by     uuid default auth.uid() references public.staff (id),
  created_at   timestamptz not null default now(),
  confirmed_by uuid references public.staff (id),
  confirmed_at timestamptz
);

-- The same medicine and strength is listed once as standard...
create unique index medicine_list_standard_key
  on public.medicine_list (lower(trim(name)), lower(coalesce(trim(strength), '')))
  where status = 'standard';
-- ...and once per person as pending.
create unique index medicine_list_pending_key
  on public.medicine_list (added_by, lower(trim(name)), lower(coalesce(trim(strength), '')))
  where status = 'pending';

revoke all on public.medicine_list from anon, authenticated;
alter table public.medicine_list enable row level security;

grant select on public.medicine_list to authenticated;
-- The Pharmacy corrects a name or strength and switches a line off. Status
-- is never set from the app: only the functions below change it.
grant update (name, strength, kind, is_active) on public.medicine_list to authenticated;


-- ===== 3. Who can read and edit =====
create policy medicine_list_read on public.medicine_list
  for select to authenticated
  using (
    (select private.can_see_medicines())
    and (
      (select private.is_pharmacist())
      or (status = 'standard' and is_active)
      or (status = 'pending' and is_active and added_by = (select auth.uid()))
    )
  );

create policy medicine_list_update on public.medicine_list
  for update to authenticated
  using ((select private.is_pharmacist()))
  with check ((select private.is_pharmacist()));

create trigger medicine_list_activity
  after insert or update on public.medicine_list
  for each row execute function private.write_activity();


-- ===== 4. Add one (the Pharmacy: standard; anybody else: pending) =====
-- Returns the number of the line to use. If the same medicine and strength
-- is already standard, that line is returned and nothing new is made.
create function private.add_medicine(p_name text, p_strength text, p_kind text default 'medicine')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  clean_strength text := nullif(regexp_replace(trim(coalesce(p_strength, '')), '\s+', ' ', 'g'), '');
  found bigint;
  me uuid := (select auth.uid());
begin
  if not (select private.can_see_medicines()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if length(clean_name) not between 2 and 120
     or (clean_strength is not null and length(clean_strength) > 60)
     or p_kind not in ('medicine', 'item') then
    raise exception 'Check the name and the strength' using errcode = '22023';
  end if;

  select id into found from public.medicine_list
  where status = 'standard' and lower(name) = lower(clean_name)
    and lower(coalesce(strength, '')) = lower(coalesce(clean_strength, ''));
  if found is not null then
    if (select private.is_pharmacist()) then
      update public.medicine_list set is_active = true where id = found and not is_active;
    end if;
    return found;
  end if;

  if (select private.is_pharmacist()) then
    insert into public.medicine_list (name, strength, kind, status, source, added_by, confirmed_by, confirmed_at)
    values (clean_name, clean_strength, p_kind, 'standard', 'pharmacy', me, me, now())
    returning id into found;
    -- Anybody's pending line for the same thing is now covered by this one.
    update public.medicine_list set is_active = false
    where status = 'pending' and lower(name) = lower(clean_name)
      and lower(coalesce(strength, '')) = lower(coalesce(clean_strength, ''));
    return found;
  end if;

  select id into found from public.medicine_list
  where status = 'pending' and added_by = me and lower(name) = lower(clean_name)
    and lower(coalesce(strength, '')) = lower(coalesce(clean_strength, ''));
  if found is not null then
    update public.medicine_list set is_active = true where id = found and not is_active;
    return found;
  end if;

  insert into public.medicine_list (name, strength, kind, status, source, added_by)
  values (clean_name, clean_strength, p_kind, 'pending', 'staff', me)
  returning id into found;
  return found;
end;
$$;


-- ===== 5. The Pharmacy confirms a pending line, or a starter line =====
create function private.confirm_medicine(p_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  line public.medicine_list;
  twin bigint;
  me uuid := (select auth.uid());
begin
  if not (select private.is_pharmacist()) then
    raise exception 'Only the Pharmacy can confirm a medicine' using errcode = '42501';
  end if;
  select * into line from public.medicine_list where id = p_id for update;
  if not found then
    raise exception 'No such medicine' using errcode = '22023';
  end if;
  if line.status = 'standard' then
    update public.medicine_list set source = 'pharmacy', confirmed_by = me, confirmed_at = now(), is_active = true
    where id = p_id;
    return p_id;
  end if;
  -- The same thing is already standard: this pending line is folded into it.
  select id into twin from public.medicine_list
  where status = 'standard' and lower(name) = lower(line.name)
    and lower(coalesce(strength, '')) = lower(coalesce(line.strength, ''));
  if twin is not null then
    update public.medicine_list set is_active = false where id = p_id;
    return twin;
  end if;
  update public.medicine_list
  set status = 'standard', source = 'pharmacy', is_active = true, confirmed_by = me, confirmed_at = now()
  where id = p_id;
  return p_id;
end;
$$;

-- "These are all fine": every starter line confirmed at once.
create function private.confirm_starter_medicines()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not (select private.is_pharmacist()) then
    raise exception 'Only the Pharmacy can confirm a medicine' using errcode = '42501';
  end if;
  update public.medicine_list
  set source = 'pharmacy', confirmed_by = (select auth.uid()), confirmed_at = now()
  where source = 'starter';
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function private.add_medicine(text, text, text)    from public, anon;
revoke execute on function private.confirm_medicine(bigint)          from public, anon;
revoke execute on function private.confirm_starter_medicines()       from public, anon;
grant  execute on function private.add_medicine(text, text, text)    to authenticated;
grant  execute on function private.confirm_medicine(bigint)          to authenticated;
grant  execute on function private.confirm_starter_medicines()       to authenticated;

create function public.add_medicine(p_name text, p_strength text, p_kind text default 'medicine')
returns bigint language sql security invoker set search_path = ''
as $$ select private.add_medicine(p_name, p_strength, p_kind); $$;

create function public.confirm_medicine(p_id bigint)
returns bigint language sql security invoker set search_path = ''
as $$ select private.confirm_medicine(p_id); $$;

create function public.confirm_starter_medicines()
returns integer language sql security invoker set search_path = ''
as $$ select private.confirm_starter_medicines(); $$;

revoke execute on function public.add_medicine(text, text, text)    from public, anon;
revoke execute on function public.confirm_medicine(bigint)          from public, anon;
revoke execute on function public.confirm_starter_medicines()       from public, anon;
grant  execute on function public.add_medicine(text, text, text)    to authenticated;
grant  execute on function public.confirm_medicine(bigint)          to authenticated;
grant  execute on function public.confirm_starter_medicines()       to authenticated;


-- ===== 6. The starter list =====
-- Usual medicines and supplies, with usual strengths, written from general
-- knowledge to save the Pharmacy typing. STANDARD from the start, marked
-- "starter" until the Pharmacy confirms them. The Pharmacy's own list
-- replaces or adds to it (Anthony: "the pharmacy will send their list").
insert into public.medicine_list (name, strength, kind, status, source, added_by)
select name, strength, kind, 'standard', 'starter', null
from (values
  ('Paracetamol', '500 mg tablet', 'medicine'),
  ('Paracetamol', '120 mg/5 ml syrup', 'medicine'),
  ('Paracetamol', '1 g/100 ml infusion', 'medicine'),
  ('Ibuprofen', '200 mg tablet', 'medicine'),
  ('Ibuprofen', '400 mg tablet', 'medicine'),
  ('Ibuprofen', '100 mg/5 ml syrup', 'medicine'),
  ('Diclofenac', '50 mg tablet', 'medicine'),
  ('Diclofenac', '75 mg/3 ml injection', 'medicine'),
  ('Aspirin', '75 mg tablet', 'medicine'),
  ('Aspirin', '300 mg tablet', 'medicine'),
  ('Tramadol', '50 mg capsule', 'medicine'),
  ('Amoxicillin', '250 mg capsule', 'medicine'),
  ('Amoxicillin', '500 mg capsule', 'medicine'),
  ('Amoxicillin', '125 mg/5 ml syrup', 'medicine'),
  ('Amoxicillin and clavulanic acid', '625 mg tablet', 'medicine'),
  ('Amoxicillin and clavulanic acid', '1 g tablet', 'medicine'),
  ('Ampicillin', '500 mg capsule', 'medicine'),
  ('Ampicillin', '500 mg injection', 'medicine'),
  ('Flucloxacillin', '250 mg capsule', 'medicine'),
  ('Flucloxacillin', '500 mg capsule', 'medicine'),
  ('Ciprofloxacin', '500 mg tablet', 'medicine'),
  ('Metronidazole', '200 mg tablet', 'medicine'),
  ('Metronidazole', '400 mg tablet', 'medicine'),
  ('Metronidazole', '500 mg/100 ml infusion', 'medicine'),
  ('Azithromycin', '250 mg tablet', 'medicine'),
  ('Azithromycin', '500 mg tablet', 'medicine'),
  ('Erythromycin', '250 mg tablet', 'medicine'),
  ('Erythromycin', '500 mg tablet', 'medicine'),
  ('Doxycycline', '100 mg capsule', 'medicine'),
  ('Cotrimoxazole', '480 mg tablet', 'medicine'),
  ('Cotrimoxazole', '960 mg tablet', 'medicine'),
  ('Ceftriaxone', '500 mg injection', 'medicine'),
  ('Ceftriaxone', '1 g injection', 'medicine'),
  ('Cefuroxime', '250 mg tablet', 'medicine'),
  ('Cefuroxime', '500 mg tablet', 'medicine'),
  ('Gentamicin', '80 mg/2 ml injection', 'medicine'),
  ('Artemether and lumefantrine', '20/120 mg tablet', 'medicine'),
  ('Artesunate', '60 mg injection', 'medicine'),
  ('Artesunate and amodiaquine', '100/270 mg tablet', 'medicine'),
  ('Sulfadoxine and pyrimethamine', '500/25 mg tablet', 'medicine'),
  ('Quinine', '300 mg tablet', 'medicine'),
  ('Quinine', '600 mg/2 ml injection', 'medicine'),
  ('Omeprazole', '20 mg capsule', 'medicine'),
  ('Omeprazole', '40 mg capsule', 'medicine'),
  ('Omeprazole', '40 mg injection', 'medicine'),
  ('Esomeprazole', '20 mg tablet', 'medicine'),
  ('Esomeprazole', '40 mg tablet', 'medicine'),
  ('Cimetidine', '200 mg tablet', 'medicine'),
  ('Cimetidine', '400 mg tablet', 'medicine'),
  ('Metoclopramide', '10 mg tablet', 'medicine'),
  ('Metoclopramide', '10 mg/2 ml injection', 'medicine'),
  ('Hyoscine butylbromide', '10 mg tablet', 'medicine'),
  ('Hyoscine butylbromide', '20 mg/1 ml injection', 'medicine'),
  ('Oral rehydration salts', '1 sachet', 'medicine'),
  ('Loperamide', '2 mg capsule', 'medicine'),
  ('Bisacodyl', '5 mg tablet', 'medicine'),
  ('Zinc sulphate', '20 mg dispersible tablet', 'medicine'),
  ('Loratadine', '10 mg tablet', 'medicine'),
  ('Cetirizine', '10 mg tablet', 'medicine'),
  ('Chlorpheniramine', '4 mg tablet', 'medicine'),
  ('Promethazine', '25 mg tablet', 'medicine'),
  ('Promethazine', '25 mg/1 ml injection', 'medicine'),
  ('Amlodipine', '5 mg tablet', 'medicine'),
  ('Amlodipine', '10 mg tablet', 'medicine'),
  ('Lisinopril', '5 mg tablet', 'medicine'),
  ('Lisinopril', '10 mg tablet', 'medicine'),
  ('Nifedipine', '10 mg tablet', 'medicine'),
  ('Nifedipine', '20 mg tablet', 'medicine'),
  ('Atenolol', '50 mg tablet', 'medicine'),
  ('Hydrochlorothiazide', '25 mg tablet', 'medicine'),
  ('Furosemide', '40 mg tablet', 'medicine'),
  ('Furosemide', '20 mg/2 ml injection', 'medicine'),
  ('Methyldopa', '250 mg tablet', 'medicine'),
  ('Metformin', '500 mg tablet', 'medicine'),
  ('Metformin', '850 mg tablet', 'medicine'),
  ('Glibenclamide', '5 mg tablet', 'medicine'),
  ('Atorvastatin', '10 mg tablet', 'medicine'),
  ('Atorvastatin', '20 mg tablet', 'medicine'),
  ('Atorvastatin', '40 mg tablet', 'medicine'),
  ('Folic acid', '5 mg tablet', 'medicine'),
  ('Ferrous sulphate', '200 mg tablet', 'medicine'),
  ('Vitamin B complex', '1 tablet', 'medicine'),
  ('Vitamin C', '100 mg tablet', 'medicine'),
  ('Vitamin C', '500 mg tablet', 'medicine'),
  ('Salbutamol', '2 mg tablet', 'medicine'),
  ('Salbutamol', '4 mg tablet', 'medicine'),
  ('Salbutamol', '100 mcg inhaler', 'medicine'),
  ('Prednisolone', '5 mg tablet', 'medicine'),
  ('Dexamethasone', '4 mg/1 ml injection', 'medicine'),
  ('Hydrocortisone', '100 mg injection', 'medicine'),
  ('Diazepam', '5 mg tablet', 'medicine'),
  ('Diazepam', '10 mg tablet', 'medicine'),
  ('Diazepam', '10 mg/2 ml injection', 'medicine'),
  ('Misoprostol', '200 mcg tablet', 'medicine'),
  ('Oxytocin', '10 IU/1 ml injection', 'medicine'),
  ('Magnesium sulphate', '50% injection', 'medicine'),
  ('Tetanus toxoid', '0.5 ml injection', 'medicine'),
  ('Lidocaine', '2% injection', 'medicine'),
  ('Sodium chloride 0.9%', '500 ml infusion', 'medicine'),
  ('Dextrose 5%', '500 ml infusion', 'medicine'),
  ('Ringer''s lactate', '500 ml infusion', 'medicine'),
  ('Water for injection', '10 ml', 'medicine'),
  ('Syringe', '2 ml', 'item'),
  ('Syringe', '5 ml', 'item'),
  ('Syringe', '10 ml', 'item'),
  ('IV cannula', '20G', 'item'),
  ('IV cannula', '22G', 'item'),
  ('IV cannula', '24G', 'item'),
  ('Infusion giving set', '1 set', 'item'),
  ('Cotton wool', '1 roll', 'item'),
  ('Gauze', '1 pack', 'item'),
  ('Adhesive plaster', '1 roll', 'item')
) as starter (name, strength, kind);
