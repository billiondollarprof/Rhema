-- =============================================================================
-- Undo for family_profile: removes start_family and the family number.
-- Families and their members stay; a family without a name gets the name
-- "Family" so the old rule (a name is needed) holds again.
-- =============================================================================

drop function if exists public.start_family(bigint);
drop function if exists private.start_family(bigint);
drop trigger if exists families_protect_number on public.families;
drop function if exists private.protect_family_number();
update public.families set name = 'Family' where name is null;
alter table public.families alter column name set not null;
alter table public.families drop column if exists created_by;
alter table public.families drop column if exists family_number;
drop sequence if exists private.family_number_seq;
