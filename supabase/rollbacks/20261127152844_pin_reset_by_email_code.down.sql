-- =============================================================================
-- Undo for 20261127152844_pin_reset_by_email_code.sql
--
-- What this removes: my_pin_state() and signed_in_at(), and puts set_my_pin
-- back as it was (any signed in person could replace their own PIN). No
-- data is lost: no table or column is touched.
-- =============================================================================

drop function if exists public.my_pin_state();
drop function if exists private.my_pin_state();
drop function if exists private.signed_in_at();

create or replace function private.set_my_pin(pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_staff() then
    raise exception 'Not signed in as active staff';
  end if;
  if pin is null or pin !~ '^[0-9]{4}$' then
    raise exception 'The PIN must be 4 digits';
  end if;

  update public.staff
  set pin_hash = extensions.crypt(pin, extensions.gen_salt('bf')),
      pin_failed_attempts = 0
  where id = (select auth.uid());
end;
$$;
