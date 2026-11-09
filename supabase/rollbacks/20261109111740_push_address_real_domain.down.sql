-- Undo for 20261109111740_push_address_real_domain.sql: the address goes back
-- to the old workers.dev one, for whichever site this is, and the function goes.
select vault.update_secret(
  d.id,
  case d.decrypted_secret
    when 'https://rhemamedical.app' then 'https://rhema-hospital.rhemamedical.workers.dev'
    when 'https://testing.rhemamedical.app' then 'https://rhema-hospital-testing.rhemamedical.workers.dev'
  end
)
from vault.decrypted_secrets d
where d.name = 'rhema_push_url'
  and d.decrypted_secret in ('https://rhemamedical.app', 'https://testing.rhemamedical.app');
drop function if exists private.move_push_address();
