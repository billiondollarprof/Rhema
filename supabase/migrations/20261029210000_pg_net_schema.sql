-- =============================================================================
-- 20261029210000_pg_net_schema.sql
--
-- What this is: moves pg_net's label out of the "public" schema into
-- "extensions", where Supabase wants add-ons kept.
--
-- Why: the security advisor on the testing database, 2026-10-29: "Extension
-- pg_net is installed in the public schema." The previous migration switched
-- pg_net on without saying where. pg_net's working parts (net.http_post and
-- its queue) always live in their own "net" schema, so the alert trigger
-- does not change.
--
-- How: pg_net cannot be moved while it is on, so it is switched off and on
-- again. Switching it off empties its own queue of web requests waiting to
-- go out, and its log of past replies. Neither holds hospital data, and on
-- the testing database the queue is empty because no keys are set yet.
-- It only does this where pg_net's label really is in "public".
--
-- Never: touch any table of ours. This file only moves the extension.
-- =============================================================================

do $$
begin
  if exists (
    select 1 from pg_extension
    where extname = 'pg_net' and extnamespace = 'public'::regnamespace
  ) then
    drop extension pg_net;
    create schema if not exists extensions;
    create extension pg_net with schema extensions;
  end if;
end $$;
