-- =============================================================================
-- drive_monthly_backup
--
-- What this is (request 226b, Anthony 2026-11-17, "Okay, yes, let's do
-- this"): a monthly text backup of the records into the hospital's own
-- Google Drive. Folders year by year, a zip per month, text only (no files).
-- One Google app under StellaXafe for every hospital; each hospital's admin
-- connects their Drive once with "Connect Google Drive" and Allow.
--
-- How the link is kept:
--   1. The admin taps Connect: start_drive_link() gives a one time code (it
--      lasts 15 minutes) that travels to Google and back.
--   2. Google sends the admin back to the Worker, which turns Google's answer
--      into a long lived key, SCRAMBLES it (the database never sees it
--      plain), and hands it in with finish_drive_link(code, ...).
--   3. The monthly job (GitHub, which already reads the database for the
--      backups) reads the scrambled key, unscrambles it with a secret only
--      it and the Worker hold, uploads the zip, and writes how it went.
--
-- Rules:
--   - Everything lives in the private schema: no screen can read the key.
--   - Only an admin starts a link, sees its state or disconnects it.
--   - A one time code works once, within 15 minutes.
--
-- Never: keep the Google key plain; let anybody but an admin connect,
-- disconnect, or see the link.
-- =============================================================================


-- ===== 1. The link, one per hospital =====
create table private.drive_link (
  id               smallint primary key default 1 check (id = 1),
  key_sealed       text not null check (length(key_sealed) between 20 and 4000),
  google_email     text check (google_email is null or length(google_email) <= 200),
  connected_by     uuid references public.staff (id),
  connected_at     timestamptz not null default now(),
  last_backup_at   timestamptz,
  last_backup_file text check (last_backup_file is null or length(last_backup_file) <= 200),
  last_problem     text check (last_problem is null or length(last_problem) <= 300)
);

revoke all on private.drive_link from public, anon, authenticated;
alter table private.drive_link enable row level security;

create index drive_link_connected_by_idx on private.drive_link (connected_by);


-- ===== 2. One time codes for Connect =====
create table private.drive_link_starts (
  code       uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references public.staff (id),
  created_at timestamptz not null default now(),
  used_at    timestamptz
);

revoke all on private.drive_link_starts from public, anon, authenticated;
alter table private.drive_link_starts enable row level security;

create index drive_link_starts_admin_idx on private.drive_link_starts (admin_id);


-- ===== 3. Start: the admin asks for a one time code =====
create function private.start_drive_link()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  made uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Only an admin connects Google Drive' using errcode = '42501';
  end if;
  -- Old codes are cleared as new ones are made.
  delete from private.drive_link_starts where created_at < now() - interval '1 day';
  insert into private.drive_link_starts (admin_id) values ((select auth.uid()))
  returning code into made;
  return made;
end;
$$;


-- ===== 4. Finish: the Worker hands in the scrambled key =====
-- Called by the Worker with the public key (the admin is on Google's page,
-- so there is no sign in here); the one time code is the proof. Answers
-- 'done', or 'expired' for a code that is unknown, used or too old.
create function private.finish_drive_link(code uuid, key_sealed text, google_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  started private.drive_link_starts;
begin
  select * into started from private.drive_link_starts s
  where s.code = finish_drive_link.code
  for update;
  if not found or started.used_at is not null
     or started.created_at < now() - interval '15 minutes' then
    return 'expired';
  end if;
  update private.drive_link_starts s set used_at = now() where s.code = finish_drive_link.code;
  insert into private.drive_link (id, key_sealed, google_email, connected_by)
  values (1, key_sealed, nullif(trim(google_email), ''), started.admin_id)
  on conflict (id) do update
    set key_sealed = excluded.key_sealed,
        google_email = excluded.google_email,
        connected_by = excluded.connected_by,
        connected_at = now(),
        last_problem = null;
  insert into public.activity_log (actor_id, action, table_name, record_id)
  values (started.admin_id, 'drive_connected', 'drive_link', '1');
  return 'done';
end;
$$;


-- ===== 5. What the admin sees, and Disconnect =====
create function private.drive_link_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not (select private.is_admin()) then null
    else (
      select jsonb_build_object(
        'connected', true,
        'google_email', d.google_email,
        'connected_at', d.connected_at,
        'last_backup_at', d.last_backup_at,
        'last_backup_file', d.last_backup_file,
        'last_problem', d.last_problem
      )
      from private.drive_link d
    )
  end;
$$;

create function private.disconnect_drive()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Only an admin disconnects Google Drive' using errcode = '42501';
  end if;
  delete from private.drive_link where id = 1;
  insert into public.activity_log (actor_id, action, table_name, record_id)
  values ((select auth.uid()), 'drive_disconnected', 'drive_link', '1');
end;
$$;


-- ===== 6. Who may call what =====
revoke execute on function private.start_drive_link() from public, anon;
revoke execute on function private.finish_drive_link(uuid, text, text) from public;
revoke execute on function private.drive_link_status() from public, anon;
revoke execute on function private.disconnect_drive() from public, anon;
grant  execute on function private.start_drive_link() to authenticated;
grant  execute on function private.finish_drive_link(uuid, text, text) to authenticated;
grant  execute on function private.drive_link_status() to authenticated;
grant  execute on function private.disconnect_drive() to authenticated;

create function public.start_drive_link()
returns uuid language sql security invoker set search_path = ''
as $$ select private.start_drive_link(); $$;
-- The Worker calls this one with the public key (anon), which has no way
-- into the private schema, so this door runs with the owner's rights and
-- hands straight on. The one time code inside is the only proof accepted.
create function public.finish_drive_link(code uuid, key_sealed text, google_email text)
returns text language sql security definer set search_path = ''
as $$ select private.finish_drive_link(code, key_sealed, google_email); $$;
create function public.drive_link_status()
returns jsonb language sql security invoker set search_path = ''
as $$ select private.drive_link_status(); $$;
create function public.disconnect_drive()
returns void language sql security invoker set search_path = ''
as $$ select private.disconnect_drive(); $$;

revoke execute on function public.start_drive_link() from public, anon;
revoke execute on function public.finish_drive_link(uuid, text, text) from public;
revoke execute on function public.drive_link_status() from public, anon;
revoke execute on function public.disconnect_drive() from public, anon;
grant  execute on function public.start_drive_link() to authenticated;
grant  execute on function public.finish_drive_link(uuid, text, text) to anon, authenticated;
grant  execute on function public.drive_link_status() to authenticated;
grant  execute on function public.disconnect_drive() to authenticated;
