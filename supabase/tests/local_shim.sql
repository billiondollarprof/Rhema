-- =============================================================================
-- local_shim.sql
--
-- What this is: a small stand-in for the parts of Supabase that a plain
-- Postgres does not have: the anon, authenticated and service_role roles,
-- the auth schema, auth.users and auth.uid().
--
-- Why: it lets an agent test the migrations and security rules on a plain
-- Postgres in seconds, before GitHub tests them on a real Supabase.
--
-- Never: run this against Supabase itself. Supabase already has all of
-- this, and the real versions must not be replaced. scripts/db-test.sh
-- only loads this file when it is told the database is plain Postgres.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;
-- Supabase keeps add-ons such as pgcrypto in a schema called extensions.
create schema if not exists extensions;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table if not exists auth.users (
  id    uuid primary key,
  email text
);

-- The same as Supabase's auth.uid(): the signed in person's id, taken from
-- the request's JWT claims.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase gives every new table in public full rights for these roles.
-- Doing the same here means a migration that forgets "revoke all" fails on
-- this machine too, not only in CI (that happened on 2026-10-29).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
