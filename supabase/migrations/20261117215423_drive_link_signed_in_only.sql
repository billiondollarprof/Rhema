-- =============================================================================
-- 20261117215423_drive_link_signed_in_only.sql
--
-- What this is: "Connect Google Drive" is now finished by the signed in
-- admin's own page, not by the Worker. So finish_drive_link no longer opens
-- to anybody signed out, and the one time code only works for the admin
-- who started it.
--
-- Why: request 226b, 2026-11-17. The testing database's security check
-- refused the first version: a door that ran with the owner's rights and
-- that anybody signed out could knock on. This closes that door rather than
-- asking for the warning to be accepted.
--
-- Rules:
--   - finish_drive_link: signed in only, runs with the caller's rights, and
--     the code must belong to the admin calling, who is still an admin.
--   - The two private tables say "nobody" out loud (a rule that always
--     answers no), so the check sees a rule and not an oversight.
--
-- Never: let anybody signed out reach finish_drive_link, or let a code
-- started by one admin be finished by somebody else.
-- =============================================================================


-- ===== 1. The code must belong to the admin finishing it =====
create or replace function private.finish_drive_link(code uuid, key_sealed text, google_email text)
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
     or started.created_at < now() - interval '15 minutes'
     or started.admin_id is distinct from (select auth.uid())
     or not (select private.is_admin()) then
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


-- ===== 2. The public door: signed in only, with the caller's rights =====
alter function public.finish_drive_link(uuid, text, text) security invoker;
revoke execute on function public.finish_drive_link(uuid, text, text) from public, anon;
grant  execute on function public.finish_drive_link(uuid, text, text) to authenticated;


-- ===== 3. "Nobody" rules on the two private tables =====
create policy drive_link_nobody on private.drive_link
  for all to authenticated using (false) with check (false);
create policy drive_link_starts_nobody on private.drive_link_starts
  for all to authenticated using (false) with check (false);
