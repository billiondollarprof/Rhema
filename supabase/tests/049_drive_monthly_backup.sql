-- =============================================================================
-- tests for drive_monthly_backup (request 226b, 2026-11-17).
--
-- What this proves:
--   1. Only an admin starts a link; the Front Desk is refused.
--   2. The admin's page finishes a link with a fresh code (anon until
--      migration 20261117215423; the admin who started it since); the
--      key is kept and the connection is logged; the same code twice, an
--      old code and an unknown code all answer expired.
--   3. Only an admin sees the link's state; nobody can read the key itself
--      from a screen; only an admin disconnects, and that is logged.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000491', 't049-admin@test.rhema'),
  ('00000000-0000-0000-0000-000000000492', 't049-desk@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000491', 'T49 Admin', 't049-admin@test.rhema', 'admin'),
  ('00000000-0000-0000-0000-000000000492', 'T49 Desk',  't049-desk@test.rhema',  'front_desk');

create temp table t049 (code uuid);
grant all on t049 to authenticated, anon;


-- ===== 1. Only an admin starts =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000492"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.start_drive_link();
    raise exception 'FAIL 1: the Front Desk started a Drive link';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000491"}', true);
set local role authenticated;
insert into t049 select public.start_drive_link();
reset role;
\echo 'PASS 1: only an admin starts'


-- ===== 2. The admin's page finishes, once =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000491"}', true);
set local role authenticated;
do $$
declare code uuid := (select t.code from t049 t);
begin
  if public.finish_drive_link(code, repeat('s', 40), 'hospital@example.com') <> 'done' then
    raise exception 'FAIL 2: a fresh code did not finish';
  end if;
  if public.finish_drive_link(code, repeat('x', 40), 'other@example.com') <> 'expired' then
    raise exception 'FAIL 2: the same code worked twice';
  end if;
  if public.finish_drive_link(gen_random_uuid(), repeat('x', 40), null) <> 'expired' then
    raise exception 'FAIL 2: an unknown code worked';
  end if;
end $$;
reset role;
do $$
begin
  if (select key_sealed from private.drive_link) <> repeat('s', 40) then
    raise exception 'FAIL 2: the key was not kept, or was replaced by a used code';
  end if;
  if not exists (select 1 from public.activity_log where action = 'drive_connected') then
    raise exception 'FAIL 2: connecting was not logged';
  end if;
  -- An old code: made 20 minutes ago, handed to the test table.
  delete from t049;
  with made as (
    insert into private.drive_link_starts (admin_id, created_at)
    values ('00000000-0000-0000-0000-000000000491', now() - interval '20 minutes')
    returning code
  )
  insert into t049 select code from made;
end $$;
set local role authenticated;
do $$
declare old_code uuid := (select code from t049);
begin
  if public.finish_drive_link(old_code, repeat('y', 40), null) <> 'expired' then
    raise exception 'FAIL 2: a code older than 15 minutes worked';
  end if;
end $$;
reset role;
\echo 'PASS 2: the admin page finishes once, with a fresh code'


-- ===== 3. State, the key, and Disconnect =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000492"}', true);
set local role authenticated;
do $$
begin
  if public.drive_link_status() is not null then
    raise exception 'FAIL 3: the Front Desk saw the Drive link';
  end if;
  begin
    perform 1 from private.drive_link;
    raise exception 'FAIL 3: the key could be read from a screen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.disconnect_drive();
    raise exception 'FAIL 3: the Front Desk disconnected Drive';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000491"}', true);
set local role authenticated;
do $$
declare state jsonb := public.drive_link_status();
begin
  if state ->> 'google_email' <> 'hospital@example.com' or state ? 'key_sealed' then
    raise exception 'FAIL 3: the admin did not see the link, or saw the key: %', state;
  end if;
  perform public.disconnect_drive();
  if public.drive_link_status() is not null then
    raise exception 'FAIL 3: disconnect left the link';
  end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.activity_log where action = 'drive_disconnected') then
    raise exception 'FAIL 3: disconnecting was not logged';
  end if;
end $$;
\echo 'PASS 3: state, the key and Disconnect'

rollback;
