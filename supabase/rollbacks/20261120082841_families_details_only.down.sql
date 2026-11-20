-- =============================================================================
-- Undo 20261120082841_families_details_only.sql: the Front Desk may again
-- add a family directly and change any column of it.
-- =============================================================================

create policy families_write on public.families
  for insert to authenticated
  with check ((select private.has_permission('patients')) and (select private.is_front_desk()));
grant insert on public.families to authenticated;

revoke update (name, phone, address, town, lga, state, country) on public.families from authenticated;
grant update on public.families to authenticated;
