-- =============================================================================
-- 20261120072145_family_file_first.sql
--
-- What this is: a family is registered first, with its own details (the
-- family name, which is the surname, a phone and the address), and saved
-- together with its first member, so a family is never empty. The Front
-- Desk can edit the family's details later.
--
-- Why: Anthony, 2026-11-19 and 2026-11-20 (request 228b): "when you choose a
-- family, you just fill in the first details of that family... their family
-- name, which is the surname only... the system will automatically enter
-- the date that family was created... Then the family's own address...
-- the system must insist... that you add at least one family member." And:
-- "There should be a way to edit the family address if need be." This
-- replaces "No family last name needed" (2026-11-02).
--
-- Rules:
--   - The family name is needed for a new family. Families made before this
--     keep working without one.
--   - register_family(family, member) saves the family and its first member
--     in one step: both are saved, or neither. Front Desk only. The member
--     gets their own RMC number and the family its FAM number, as before.
--     A double tap (same person, family name and first member within 30
--     seconds) is refused with "already registered", as for patients.
--   - Only the Front Desk adds or changes a family directly (it already
--     alone registers and edits patients, request 178). Starting a family
--     from a registered patient (start_family) does not change.
--   - The date the family was registered is created_at, set by the database.
--
-- Never: leave a family with nobody in it, or let anybody but the Front Desk
-- change a family's details.
-- =============================================================================


-- ===== 1. The family's own details =====
alter table public.families
  add column phone   text check (phone ~ '^0[0-9]{10}$'),
  add column address text check (char_length(address) <= 200),
  add column town    text check (char_length(town) <= 80),
  add column lga     text check (char_length(lga) <= 80),
  add column state   text check (char_length(state) <= 80),
  add column country text not null default 'Nigeria' check (char_length(country) between 2 and 80);

-- Searching families by name (Find patient: "James" shows the James family).
create index families_name_idx on public.families (lower(name));


-- ===== 2. Only the Front Desk adds or changes a family directly =====
drop policy families_write on public.families;
create policy families_write on public.families
  for insert to authenticated
  with check ((select private.has_permission('patients')) and (select private.is_front_desk()));

drop policy families_update on public.families;
create policy families_update on public.families
  for update to authenticated
  using ((select private.has_permission('patients')) and (select private.is_front_desk()))
  with check ((select private.has_permission('patients')) and (select private.is_front_desk()));


-- ===== 3. Register a family with its first member, in one step =====
-- family: name, phone, address, town, lga, state, country.
-- member: the patient's card, as Register patient or Register from old file
-- fills it in. Answers the family's id and the member's id.
create function private.register_family(family jsonb, member jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  clean_name text := regexp_replace(trim(coalesce(family ->> 'name', '')), '\s+', ' ', 'g');
  new_family bigint;
  new_patient bigint;
begin
  if not ((select private.has_permission('patients')) and (select private.is_front_desk())) then
    raise exception 'Only the Front Desk registers a family' using errcode = '42501';
  end if;
  if length(clean_name) not between 2 and 120 then
    raise exception 'Type the family name' using errcode = '22023';
  end if;
  if coalesce(length(trim(member ->> 'full_name')), 0) < 2 then
    raise exception 'Add at least one family member' using errcode = '22023';
  end if;

  -- A double tap: the same person, the same family name and the same first
  -- member within 30 seconds. Two taps at the same moment wait here for each
  -- other (the patients' own guard cannot see it: each tap is a new family).
  perform pg_advisory_xact_lock(hashtext('register_family:' || me::text || ':' || lower(clean_name)));
  if exists (
    select 1
    from public.families f
    join public.patients p on p.family_id = f.id
    where f.created_by = me
      and lower(f.name) = lower(clean_name)
      and f.created_at > now() - interval '30 seconds'
      and lower(p.full_name) = lower(regexp_replace(trim(member ->> 'full_name'), '\s+', ' ', 'g'))
  ) then
    raise exception 'already registered' using errcode = '23505';
  end if;

  insert into public.families (name, phone, address, town, lga, state, country, created_by)
  values (
    clean_name,
    nullif(trim(family ->> 'phone'), ''),
    nullif(trim(family ->> 'address'), ''),
    nullif(trim(family ->> 'town'), ''),
    nullif(trim(family ->> 'lga'), ''),
    nullif(trim(family ->> 'state'), ''),
    coalesce(nullif(trim(family ->> 'country'), ''), 'Nigeria'),
    me
  )
  returning id into new_family;

  -- The member: only the card's own columns, in the Front Desk's name.
  insert into public.patients (
    full_name, date_of_birth, sex, category, phone, email, address, town, lga, state, country,
    next_of_kin_name, next_of_kin_relationship, next_of_kin_phone,
    from_old_file, first_registered_on, family_id, created_by
  )
  values (
    regexp_replace(trim(member ->> 'full_name'), '\s+', ' ', 'g'),
    nullif(member ->> 'date_of_birth', '')::date,
    nullif(member ->> 'sex', '')::public.patient_sex,
    'family',
    nullif(trim(member ->> 'phone'), ''),
    nullif(trim(member ->> 'email'), ''),
    nullif(trim(member ->> 'address'), ''),
    nullif(trim(member ->> 'town'), ''),
    nullif(trim(member ->> 'lga'), ''),
    nullif(trim(member ->> 'state'), ''),
    coalesce(nullif(trim(member ->> 'country'), ''), 'Nigeria'),
    nullif(trim(member ->> 'next_of_kin_name'), ''),
    nullif(trim(member ->> 'next_of_kin_relationship'), ''),
    nullif(trim(member ->> 'next_of_kin_phone'), ''),
    coalesce((member ->> 'from_old_file')::boolean, false),
    nullif(member ->> 'first_registered_on', '')::date,
    new_family,
    me
  )
  returning id into new_patient;

  return jsonb_build_object('family_id', new_family, 'patient_id', new_patient);
end;
$$;

revoke execute on function private.register_family(jsonb, jsonb) from public, anon;
grant  execute on function private.register_family(jsonb, jsonb) to authenticated;

create function public.register_family(family jsonb, member jsonb)
returns jsonb
language sql
set search_path = ''
as $$ select private.register_family(family, member); $$;

revoke execute on function public.register_family(jsonb, jsonb) from public, anon;
grant  execute on function public.register_family(jsonb, jsonb) to authenticated;
