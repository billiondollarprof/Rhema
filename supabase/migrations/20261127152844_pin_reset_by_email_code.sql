-- =============================================================================
-- 20261127152844_pin_reset_by_email_code.sql
--
-- What this is: a person whose PIN is locked (5 wrong tries), or who forgot
-- it, confirms it is them with a code sent to their email and then chooses
-- a new PIN. Two pieces:
--   my_pin_state()   "none", "set" or "locked", so the app knows whether to
--                    ask for the PIN, for a first PIN, or for an email code.
--   set_my_pin(pin)  unchanged for a first PIN. Replacing a PIN that already
--                    exists now needs a sign in with an email code in the
--                    last 15 minutes.
--
-- Why: Anthony, 2026-11-27 (request 259): "Somebody recently tried their PIN
-- multiple times... the system is not letting them log in again. Even after
-- they have waited for so many minutes." The fault: after 5 wrong tries the
-- app sent the person to sign in with an email code, but i_have_a_pin() still
-- said yes, so the app went straight back to the locked PIN and signed them
-- out again, for ever. And: "under the place they used to put PIN... forget
-- PIN... enter their email, get a code, and reset their PIN."
--
-- How "an email code in the last 15 minutes" is known: Supabase puts the
-- moment of sign in into the session's token (the "amr" claim: the method
-- and the time). Refreshing the token keeps that moment, so a person who
-- signed in yesterday cannot reset a PIN without a new code today. The app
-- cannot fake it: the token is signed by Supabase.
--
-- Rules:
--   - my_pin_state(): only ever about the person asking. Never the PIN.
--   - set_my_pin(): a first PIN (none stored) as before. A new PIN over an
--     existing one only within 15 minutes of an email code sign in,
--     otherwise refused with "fresh_sign_in_needed". It clears the 5 tries.
--   - i_have_a_pin() is kept as it was, for any screen still asking it.
--
-- Never: return or log the PIN or its scrambled form. Never let a person
-- touch anybody else's PIN.
-- =============================================================================


-- ===== 1. "What state is my PIN in?" =========================================
create or replace function private.my_pin_state()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when pin_hash is null then 'none'
      when pin_failed_attempts >= 5 then 'locked'
      else 'set'
    end
    from public.staff
    where id = (select auth.uid()) and is_active
  ), 'none');
$$;

create or replace function public.my_pin_state()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.my_pin_state();
$$;

revoke execute on function private.my_pin_state() from public, anon;
revoke execute on function public.my_pin_state()  from public, anon;
grant  execute on function private.my_pin_state() to authenticated;
grant  execute on function public.my_pin_state()  to authenticated;


-- ===== 2. When did this session sign in? =====================================
-- The newest moment in the token's "amr" list, as a time. Null when the
-- token has none (then a PIN that exists cannot be replaced).
create or replace function private.signed_in_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select to_timestamp(max((entry ->> 'timestamp')::double precision))
  from jsonb_array_elements(
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'amr',
      '[]'::jsonb
    )
  ) as entry
  where jsonb_typeof(entry) = 'object' and (entry ->> 'timestamp') ~ '^[0-9]+(\.[0-9]+)?$';
$$;

revoke execute on function private.signed_in_at() from public, anon;
grant  execute on function private.signed_in_at() to authenticated;


-- ===== 3. Set my PIN: a new one over an old one needs a fresh email code =====
create or replace function private.set_my_pin(pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored text;
  signed_in timestamptz;
begin
  if not private.is_active_staff() then
    raise exception 'Not signed in as active staff';
  end if;
  if pin is null or pin !~ '^[0-9]{4}$' then
    raise exception 'The PIN must be 4 digits';
  end if;

  -- The row is locked so two saves at the same moment run one after the other.
  select pin_hash into stored
  from public.staff
  where id = (select auth.uid())
  for update;

  if stored is not null then
    signed_in := private.signed_in_at();
    if signed_in is null or signed_in < now() - interval '15 minutes' then
      raise exception 'fresh_sign_in_needed' using errcode = '42501';
    end if;
  end if;

  update public.staff
  set pin_hash = extensions.crypt(pin, extensions.gen_salt('bf')),
      pin_failed_attempts = 0
  where id = (select auth.uid());
end;
$$;
