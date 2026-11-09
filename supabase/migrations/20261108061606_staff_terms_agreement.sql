-- =============================================================================
-- 20261108061606_staff_terms_agreement.sql
--
-- What this is: when a member of staff agreed to the Terms of Use and the
-- Privacy Policy, and which version of the words they agreed to.
--
-- Why: Anthony, 2026-11-08 (request 156): "when a person is coming for the
-- first time as an invited staff, the terms... should be at the bottom
-- there for them to tick the button, so they are agreeing to protect
-- patients' information." The tick sits on the Choose your PIN screen.
-- Writing it in the database means the hospital can show who agreed, and
-- when, if it is ever asked (Nigeria Data Protection Act 2023).
--
-- Rules:
--   - A person can only record their OWN agreement, through
--     agree_to_terms(). Nobody can type a date in for somebody else.
--   - Staff can read the two new columns, like the rest of a staff row.
--   - The change is written in the activity log by the trigger the staff
--     table already has.
--
-- Never: let anybody set or clear another person's agreement.
-- =============================================================================

-- ===== 1. Two new columns on staff ==========================================
-- Empty until the person ticks the box. Nothing else in the row changes.
alter table public.staff
  add column terms_agreed_at timestamptz,
  add column terms_version   text;

-- Readable like the rest of the row. No insert or update rights: the only
-- way to fill them is the function below.
grant select (terms_agreed_at, terms_version) on public.staff to authenticated;


-- ===== 2. Recording my own agreement ========================================
-- Runs as the database owner, but only ever touches the row of the person
-- calling it (auth.uid()), and only while their account is on. The version
-- is the date of the words, for example 2026-11-08. Answers true when the
-- agreement was saved.
create function private.agree_to_terms(terms text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if terms is null or terms !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  update public.staff
     set terms_agreed_at = now(),
         terms_version   = terms
   where id = (select auth.uid())
     and is_active;
  return found;
end;
$$;

create function public.agree_to_terms(terms text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.agree_to_terms(terms);
$$;

revoke execute on function private.agree_to_terms(text) from public, anon;
revoke execute on function public.agree_to_terms(text)  from public, anon;
grant  execute on function private.agree_to_terms(text) to authenticated;
grant  execute on function public.agree_to_terms(text)  to authenticated;
