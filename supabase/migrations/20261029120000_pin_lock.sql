-- =============================================================================
-- 20261029120000_pin_lock.sql
--
-- What this is: the 4 digit PIN behind the lock screen and the nursing
-- station switch. Two things a signed in person can do:
--   set_my_pin(pin)    choose or change their own PIN;
--   check_my_pin(pin)  "is this my PIN?", answered ok, wrong, locked or
--                      no_pin.
--
-- Why: Anthony, 2026-10-29. On a shared computer (nursing station, lab,
-- pharmacy) each person taps their own name and types their own PIN, so
-- every action carries the name of the person whose PIN was used. The PIN
-- is checked here in the database, never only in the screen.
--
-- How it is kept safe:
--   - The PIN is stored scrambled with bcrypt (pgcrypto's crypt), never as
--     the digits. Nobody can read the column through the API (foundation,
--     section 9), not even the admin.
--   - After 5 wrong tries in a row the PIN stops working. The person then
--     signs in again with an email code and sets a new PIN.
--   - A person can only ever set or check their OWN PIN: both functions use
--     auth.uid(), never an id passed in.
--
-- The real work is in the private schema (not reachable from the web API)
-- and runs as the owner, because staff cannot write the PIN columns
-- themselves. The public functions are thin doors with the caller's own
-- rights, so Supabase's security check has nothing to warn about.
--
-- Never: return or log the PIN or its scrambled form. Never take a staff id
-- as an argument.
-- =============================================================================


-- ===== 1. The scrambling tool ================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;


-- ===== 2. The private workers ================================================

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

create or replace function private.check_my_pin(pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored   text;
  failures integer;
begin
  select pin_hash, pin_failed_attempts into stored, failures
  from public.staff
  where id = (select auth.uid()) and is_active;

  if not found then
    raise exception 'Not signed in as active staff';
  end if;
  if stored is null then
    return 'no_pin';
  end if;
  if failures >= 5 then
    return 'locked';
  end if;

  if pin is not null and extensions.crypt(pin, stored) = stored then
    -- Only write when there is something to reset, so a normal unlock
    -- adds no line to the activity log.
    if failures > 0 then
      update public.staff set pin_failed_attempts = 0 where id = (select auth.uid());
    end if;
    return 'ok';
  end if;

  update public.staff set pin_failed_attempts = failures + 1 where id = (select auth.uid());
  if failures + 1 >= 5 then
    return 'locked';
  end if;
  return 'wrong';
end;
$$;

revoke execute on function private.set_my_pin(text)   from public, anon;
revoke execute on function private.check_my_pin(text)  from public, anon;
grant  execute on function private.set_my_pin(text)    to authenticated;
grant  execute on function private.check_my_pin(text)  to authenticated;


-- ===== 3. The public doors the app calls =====================================

create or replace function public.set_my_pin(pin text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_my_pin(pin);
$$;

create or replace function public.check_my_pin(pin text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.check_my_pin(pin);
$$;

revoke execute on function public.set_my_pin(text)   from public, anon;
revoke execute on function public.check_my_pin(text) from public, anon;
grant  execute on function public.set_my_pin(text)   to authenticated;
grant  execute on function public.check_my_pin(text) to authenticated;


-- ===== 4. "Does this person have a PIN yet?" =================================
-- The app needs a yes or no, never the scrambled PIN itself.

create or replace function private.i_have_a_pin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pin_hash is not null from public.staff
    where id = (select auth.uid()) and is_active
  ), false);
$$;

create or replace function public.i_have_a_pin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.i_have_a_pin();
$$;

revoke execute on function private.i_have_a_pin() from public, anon;
revoke execute on function public.i_have_a_pin()  from public, anon;
grant  execute on function private.i_have_a_pin() to authenticated;
grant  execute on function public.i_have_a_pin()  to authenticated;
