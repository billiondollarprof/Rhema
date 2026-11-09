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

-- Supabase's sign in service connects as supabase_auth_admin and adds
-- every new sign in account to auth.users (Admin invites, 2026-10-30).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin;
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
grant usage on schema auth to supabase_auth_admin;
grant select, insert on auth.users to supabase_auth_admin;

-- Supabase gives every new table in public full rights for these roles.
-- Doing the same here means a migration that forgets "revoke all" fails on
-- this machine too, not only in CI (that happened on 2026-10-29).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

-- ===== pg_net and Vault stand-ins (Call attention push, 2026-10-29) =====
-- Supabase has pg_net (the database calls a web address) and Vault (secrets
-- kept inside the database). Plain Postgres has neither. These stand-ins
-- have the same names and shapes, so the migration and its tests run here.
-- The stand-in http_post only writes the request into the queue table, the
-- same table the real pg_net reads from, so a test can look at it.
create schema if not exists net;
create table if not exists net.http_request_queue (
  id bigserial primary key,
  method text not null,
  url text not null,
  headers jsonb,
  body bytea,
  timeout_milliseconds integer
);
create or replace function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint
language sql
as $$
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('POST', url, headers, convert_to(body::text, 'UTF8'), timeout_milliseconds)
  returning id;
$$;

create schema if not exists vault;
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  secret text not null
);
create or replace view vault.decrypted_secrets as
  select id, name, secret as decrypted_secret from vault.secrets;
create or replace function vault.create_secret(
  new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null
) returns uuid
language sql
as $$
  insert into vault.secrets (name, secret) values (new_name, new_secret) returning id;
$$;
-- Supabase's vault.update_secret, the parts we use: a new value, by id.
create or replace function vault.update_secret(
  secret_id uuid, new_secret text default null, new_name text default null,
  new_description text default null, new_key_id uuid default null
) returns void
language sql
as $$
  update vault.secrets set secret = coalesce(new_secret, secret) where id = secret_id;
$$;
