-- =============================================================================
-- tests for drive_link_signed_in_only (request 226b, 2026-11-17).
--
-- What this proves:
--   1. Nobody signed out can reach finish_drive_link, and its door runs
--      with the caller's rights, not the owner's.
--   2. A code finishes only for the admin who started it: another admin,
--      and the Front Desk, get 'expired' and change nothing.
--   3. The two private tables carry a "nobody" rule.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000501', 't050-admin@test.rhema'),
  ('00000000-0000-0000-0000-000000000502', 't050-admin2@test.rhema'),
  ('00000000-0000-0000-0000-000000000503', 't050-desk@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000501', 'T50 Admin',  't050-admin@test.rhema',  'admin'),
  ('00000000-0000-0000-0000-000000000502', 'T50 Admin2', 't050-admin2@test.rhema', 'admin'),
  ('00000000-0000-0000-0000-000000000503', 'T50 Desk',   't050-desk@test.rhema',   'front_desk');

create temp table t050 (code uuid);
grant all on t050 to authenticated, anon;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000501"}', true);
set local role authenticated;
insert into t050 select public.start_drive_link();
reset role;


-- ===== 1. Nobody signed out =====
select set_config('request.jwt.claims', '{}', true);
set local role anon;
do $$
declare code uuid := (select t.code from t050 t);
begin
  begin
    perform public.finish_drive_link(code, repeat('a', 40), null);
    raise exception 'FAIL 1: somebody signed out reached finish_drive_link';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if (select p.prosecdef from pg_proc p
      where p.oid = 'public.finish_drive_link(uuid, text, text)'::regprocedure) then
    raise exception 'FAIL 1: the public door still runs with the owner''s rights';
  end if;
  if has_function_privilege('anon', 'public.finish_drive_link(uuid, text, text)', 'execute') then
    raise exception 'FAIL 1: somebody signed out may still call finish_drive_link';
  end if;
end $$;
\echo 'PASS 1: nobody signed out'


-- ===== 2. Only the admin who started it =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000502"}', true);
set local role authenticated;
do $$
declare code uuid := (select t.code from t050 t);
begin
  if public.finish_drive_link(code, repeat('b', 40), 'other@example.com') <> 'expired' then
    raise exception 'FAIL 2: another admin finished somebody else''s code';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000503"}', true);
set local role authenticated;
do $$
declare code uuid := (select t.code from t050 t);
begin
  if public.finish_drive_link(code, repeat('c', 40), 'desk@example.com') <> 'expired' then
    raise exception 'FAIL 2: the Front Desk finished a Drive link';
  end if;
end $$;
reset role;
do $$
begin
  if exists (select 1 from private.drive_link) then
    raise exception 'FAIL 2: a refused finish still saved a key';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000501"}', true);
set local role authenticated;
do $$
declare code uuid := (select t.code from t050 t);
begin
  if public.finish_drive_link(code, repeat('d', 40), 'hospital@example.com') <> 'done' then
    raise exception 'FAIL 2: the admin who started it could not finish';
  end if;
end $$;
reset role;
do $$
begin
  if (select key_sealed from private.drive_link) <> repeat('d', 40) then
    raise exception 'FAIL 2: the right key was not kept';
  end if;
end $$;
-- An admin who starts a code and then stops being an admin cannot finish it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000502"}', true);
set local role authenticated;
delete from t050;
insert into t050 select public.start_drive_link();
reset role;
update public.staff set can_admin = false where id = '00000000-0000-0000-0000-000000000502';
set local role authenticated;
do $$
declare code uuid := (select t.code from t050 t);
begin
  if public.finish_drive_link(code, repeat('e', 40), 'late@example.com') <> 'expired' then
    raise exception 'FAIL 2: somebody no longer an admin finished a Drive link';
  end if;
end $$;
reset role;
\echo 'PASS 2: only the admin who started it'


-- ===== 3. The "nobody" rules =====
do $$
begin
  if (select count(*) from pg_policies
      where schemaname = 'private'
        and policyname in ('drive_link_nobody', 'drive_link_starts_nobody')
        and qual = 'false') <> 2 then
    raise exception 'FAIL 3: a private Drive table has no "nobody" rule';
  end if;
end $$;
\echo 'PASS 3: the "nobody" rules'

rollback;
