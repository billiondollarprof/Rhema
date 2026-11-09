-- =============================================================================
-- 025_push_address_real_domain.sql: tests for push_address_real_domain.
--
-- What this is: proves live's old address becomes rhemamedical.app, testing's
-- becomes testing.rhemamedical.app, any other value is left alone, and
-- nobody signed in can run the move.
--
-- Runs inside one transaction that is rolled back. No real secret.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== 1. Live's old address moves to live's new one =========================
delete from vault.secrets where name = 'rhema_push_url';
select vault.create_secret('https://rhema-hospital.rhemamedical.workers.dev', 'rhema_push_url');
select private.move_push_address();
do $$
begin
  if (select decrypted_secret from vault.decrypted_secrets where name = 'rhema_push_url')
     <> 'https://rhemamedical.app' then
    raise exception 'FAIL 1: live''s address did not move to rhemamedical.app';
  end if;
end $$;
\echo 'PASS 1: live moves to rhemamedical.app'


-- ===== 2. Testing's old address moves to testing's new one ===================
delete from vault.secrets where name = 'rhema_push_url';
select vault.create_secret('https://rhema-hospital-testing.rhemamedical.workers.dev', 'rhema_push_url');
select private.move_push_address();
do $$
begin
  if (select decrypted_secret from vault.decrypted_secrets where name = 'rhema_push_url')
     <> 'https://testing.rhemamedical.app' then
    raise exception 'FAIL 2: testing''s address did not move to testing.rhemamedical.app';
  end if;
end $$;
\echo 'PASS 2: testing moves to testing.rhemamedical.app, never to live'


-- ===== 3. Anything else is left alone, and other secrets too =================
delete from vault.secrets where name in ('rhema_push_url', 'rhema_push_secret');
select vault.create_secret('https://somewhere.else.example', 'rhema_push_url');
select vault.create_secret('made-up-secret', 'rhema_push_secret');
select private.move_push_address();
do $$
begin
  if (select decrypted_secret from vault.decrypted_secrets where name = 'rhema_push_url')
     <> 'https://somewhere.else.example'
     or (select decrypted_secret from vault.decrypted_secrets where name = 'rhema_push_secret')
     <> 'made-up-secret' then
    raise exception 'FAIL 3: a value that is not an old address was changed';
  end if;
end $$;
\echo 'PASS 3: other values and other secrets are left alone'


-- ===== 4. Nobody signed in may run it ========================================
do $$
begin
  if has_function_privilege('authenticated', 'private.move_push_address()', 'execute')
     or has_function_privilege('anon', 'private.move_push_address()', 'execute') then
    raise exception 'FAIL 4: the app may run the move';
  end if;
end $$;
\echo 'PASS 4: only the database owner runs the move'

rollback;
