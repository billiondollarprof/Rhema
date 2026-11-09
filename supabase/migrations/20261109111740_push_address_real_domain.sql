-- =============================================================================
-- 20261109111740_push_address_real_domain.sql
--
-- What this is: the address the database sends Call attention alerts to
-- (Vault secret rhema_push_url) moves from the old workers.dev address to
-- the hospital's own address.
--
-- Why: the site moved to rhemamedical.app (live) and testing.rhemamedical.app
-- (testing) on 2026-11-06. Anthony, 2026-11-09: "moving phone alerts to
-- rhemamedical.app. Yes, you should do that." After this, the old address
-- can send people to the new one without breaking alerts.
--
-- Rules:
--   - Only the two known old addresses change, each to its own site's new
--     one. Any other value is left exactly as it is.
--   - The keys (VAPID, the shared secret) do not change, so no phone has to
--     turn alerts on again.
--
-- Never: send testing's alerts to live, or live's to testing.
-- =============================================================================

-- ===== 1. The move, as a function so its test can run it again =====
create function private.move_push_address()
returns void
language sql
security definer
set search_path = ''
as $$
  select vault.update_secret(
    d.id,
    case d.decrypted_secret
      when 'https://rhema-hospital.rhemamedical.workers.dev' then 'https://rhemamedical.app'
      when 'https://rhema-hospital-testing.rhemamedical.workers.dev' then 'https://testing.rhemamedical.app'
    end
  )
  from vault.decrypted_secrets d
  where d.name = 'rhema_push_url'
    and d.decrypted_secret in (
      'https://rhema-hospital.rhemamedical.workers.dev',
      'https://rhema-hospital-testing.rhemamedical.workers.dev'
    );
$$;

revoke execute on function private.move_push_address() from public, anon, authenticated;

-- ===== 2. Run it once, now =====
select private.move_push_address();
