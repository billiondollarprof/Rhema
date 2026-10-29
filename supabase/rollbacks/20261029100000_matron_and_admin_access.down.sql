-- =============================================================================
-- Undo for 20261029100000_matron_and_admin_access.sql
--
-- Puts back the foundation's admin check (role = 'admin') and starting
-- access, and removes the admin power column and the last admin guard.
--
-- The 'matron' value stays in the role list, because Postgres cannot remove
-- a value from a list. It does nothing on its own. Before running this on a
-- database with real staff, change any matron to another role first.
-- =============================================================================

drop trigger if exists staff_keep_one_admin on public.staff;
drop function if exists private.keep_one_admin();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and role = 'admin'
  );
$$;

create or replace function private.set_default_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.can_medical  := new.role in ('doctor', 'nurse', 'admin');
  new.can_pharmacy := new.role in ('pharmacy', 'doctor', 'admin');
  new.can_lab      := new.role in ('laboratory', 'doctor', 'admin');
  new.can_announce := new.role in ('admin', 'nurse');
  new.can_logs     := new.role = 'admin';
  return new;
end;
$$;

alter table public.staff drop column if exists can_admin;
