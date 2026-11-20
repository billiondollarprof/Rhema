-- =============================================================================
-- Undo 20261120072145_family_file_first.sql: families lose their own phone
-- and address, and anybody who finds patients may add or change a family
-- again. Families and members already saved stay.
-- =============================================================================

drop function public.register_family(jsonb, jsonb);
drop function private.register_family(jsonb, jsonb);

drop policy families_update on public.families;
create policy families_update on public.families
  for update to authenticated
  using ((select private.has_permission('patients')))
  with check ((select private.has_permission('patients')));

drop policy families_write on public.families;
create policy families_write on public.families
  for insert to authenticated
  with check ((select private.has_permission('patients')));

drop index public.families_name_idx;

alter table public.families
  drop column phone,
  drop column address,
  drop column town,
  drop column lga,
  drop column state,
  drop column country;
