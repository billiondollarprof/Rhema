-- =============================================================================
-- Undo 20261117215423_drive_link_signed_in_only.sql: puts back the first
-- version of finish_drive_link (any fresh code, from anybody, through a door
-- with the owner's rights) and removes the two "nobody" rules.
-- =============================================================================

drop policy if exists drive_link_starts_nobody on private.drive_link_starts;
drop policy if exists drive_link_nobody on private.drive_link;

alter function public.finish_drive_link(uuid, text, text) security definer;
grant execute on function public.finish_drive_link(uuid, text, text) to anon, authenticated;

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
