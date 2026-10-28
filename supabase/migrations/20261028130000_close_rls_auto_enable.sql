-- =============================================================================
-- 20261028130000_close_rls_auto_enable.sql
--
-- What this is: stops people outside the database from calling Supabase's
-- own function public.rls_auto_enable().
--
-- Why: the live project was created with "automatic RLS" switched on. That
-- option added this function, and the security advisor warned that anybody
-- (anon) and any signed in user (authenticated) could call it through the
-- web API. Anthony approved closing it on 2026-10-28.

The line names "public" (every role) as well as anon and authenticated.
Postgres lets every role run a new function by default, so revoking from
anon and authenticated alone leaves them able to run it. That was proved
on a local copy before this line changed.
--
-- The function only exists on the live project. Testing and CI were made
-- without that option, so there this file does nothing. Supabase itself
-- still uses the function as before, because its owner keeps the right.
--
-- Never: drop or change the function itself. It is Supabase's, not ours.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
