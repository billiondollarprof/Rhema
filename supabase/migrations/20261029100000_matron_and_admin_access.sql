-- =============================================================================
-- 20261029100000_matron_and_admin_access.sql
--
-- What this is: two changes to how staff get their access.
--   1. A new role, matron. She starts with the same access as a nurse (the
--      full patient record) plus announcements.
--   2. Admin becomes an extra power that any staff member can be given, the
--      way WhatsApp makes a member a group admin. A doctor or a matron can
--      also be an admin. The admin power is: invite and change staff, and
--      read the activity log. It lives in the new column can_admin.
--
-- Why: Anthony, 2026-10-29. "Some directors do prefer to add maybe a matron
-- to also have an admin access... the only difference is that admin sees
-- logs and admin is able to invite someone." The director is invited as a
-- doctor with admin ticked. The plain "admin" role stays, for somebody
-- whose only job is the admin work.
--
-- Never: let the hospital lose its last admin. Section 5 refuses any change
-- that would leave nobody able to invite or manage staff.
-- =============================================================================


-- ===== 1. The matron role ====================================================
-- "if not exists" lets this file run again safely after its undo file,
-- because Postgres cannot remove a value from a list once it is added.

alter type public.staff_role add value if not exists 'matron';


-- ===== 2. The admin power ====================================================

alter table public.staff
  add column if not exists can_admin boolean not null default false;

-- Anybody already invited with the admin role keeps being an admin.
update public.staff set can_admin = true where role = 'admin' and not can_admin;


-- ===== 3. Starting access, from the role =====================================
-- Same as before, with matron added. can_admin is not overwritten unless the
-- role is admin, so "also make this person an admin" at invite time stays.

create or replace function private.set_default_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.can_medical  := new.role::text in ('doctor', 'nurse', 'matron', 'admin');
  new.can_pharmacy := new.role::text in ('pharmacy', 'doctor', 'admin');
  new.can_lab      := new.role::text in ('laboratory', 'doctor', 'admin');
  new.can_announce := new.role::text in ('admin', 'nurse', 'matron');
  new.can_admin    := new.can_admin or new.role::text = 'admin';
  new.can_logs     := new.can_admin;
  return new;
end;
$$;


-- ===== 4. "Is this person an admin?" now reads the admin power ===============
-- Before: role = 'admin'. Now: the can_admin tick, whatever the role.
-- Every rule that used is_admin() (rooms, staff) follows this by itself.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and can_admin
  );
$$;


-- ===== 5. Never lose the last admin ==========================================

create or replace function private.keep_one_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (old.can_admin and old.is_active)
     and not (new.can_admin and new.is_active)
     and not exists (
       select 1 from public.staff
       where can_admin and is_active and id <> old.id
     ) then
    raise exception 'This is the last admin. Make somebody else an admin first.';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_keep_one_admin on public.staff;
create trigger staff_keep_one_admin
  before update on public.staff
  for each row execute function private.keep_one_admin();


-- ===== 6. Who may read and set the admin power ===============================
-- Same as the other permission columns: everybody signed in can read it,
-- only an admin can set it (the RLS rules from the foundation decide that).

grant select (can_admin)           on public.staff to authenticated;
grant insert (can_admin)           on public.staff to authenticated;
grant update (can_admin)           on public.staff to authenticated;
