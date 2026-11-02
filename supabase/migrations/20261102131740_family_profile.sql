-- =============================================================================
-- family_profile: a family card number, and starting a family from a
-- patient (request 128, step 2).
--
-- Why: Anthony, 2026-11-02: "one family will have one card number for all
-- of them... they can use one card number to even search for the family."
-- He chose the family number: the family has its own number (FAM-000012),
-- and every member keeps their own RMC number inside, so records never mix.
-- "You register the mother, and then... add member." No family surname is
-- needed.
--
-- Rules:
--   - A family number is given by the database, never typed, never changed,
--     like a patient number.
--   - start_family(patient) makes a family from a registered patient and
--     answers its id. Tapped twice, it answers the same family.
--   - Anybody who may register patients may start a family and add members.
--
-- Never: let a family number be set by hand or changed.
-- =============================================================================


-- ===== 1. The family number =====

create sequence private.family_number_seq;

alter table public.families add column family_number text unique;
alter table public.families add column created_by uuid references public.staff (id);
-- No surname needed (Anthony, 2026-11-02).
alter table public.families alter column name drop not null;

-- Families made before this get their numbers now, in the order they were made.
update public.families
   set family_number = 'FAM-' || lpad(nextval('private.family_number_seq')::text, 6, '0')
 where family_number is null;
alter table public.families alter column family_number set not null;

-- Security definer: the number counter is private, as for patient numbers.
create function private.protect_family_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.family_number := 'FAM-' || lpad(nextval('private.family_number_seq')::text, 6, '0');
  elsif new.family_number is distinct from old.family_number then
    raise exception 'A family number cannot be changed';
  end if;
  return new;
end;
$$;

revoke execute on function private.protect_family_number() from public, anon, authenticated;

create trigger families_protect_number
  before insert or update on public.families
  for each row execute function private.protect_family_number();


-- ===== 2. Start a family from a patient =====
-- Answers the family's id. A patient already in a family answers that one,
-- so a double tap never makes two families.

create function private.start_family(patient bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.patients;
  new_family bigint;
begin
  if not private.has_permission('patients') then
    raise exception 'Only staff who register patients can start a family' using errcode = '42501';
  end if;
  select * into found from public.patients where id = patient and voided_at is null for update;
  if found.id is null then
    raise exception 'No such patient' using errcode = '22023';
  end if;
  if found.family_id is not null then
    return found.family_id;
  end if;
  insert into public.families (created_by) values (auth.uid()) returning id into new_family;
  update public.patients set family_id = new_family, category = 'family' where id = patient;
  return new_family;
end;
$$;

revoke execute on function private.start_family(bigint) from public, anon;
grant  execute on function private.start_family(bigint) to authenticated;

create function public.start_family(patient bigint)
returns bigint
language sql
security invoker
set search_path = ''
as $$ select private.start_family(patient) $$;

revoke execute on function public.start_family(bigint) from public, anon;
grant  execute on function public.start_family(bigint) to authenticated;
