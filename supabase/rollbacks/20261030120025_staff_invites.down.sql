-- =============================================================================
-- Undo for 20261030120025_staff_invites.sql
--
-- Removes Admin's database side: the invitations, the sign up rule, the
-- suspend, unsuspend and revoke function, and the signed in times. Puts
-- back the right to change is_active straight through the API.
--
-- On the live database this loses every invitation and every signed in
-- time, so it needs Anthony's explicit yes in writing. It also lets any
-- email sign up again while "allow new users to sign up" is on, so switch
-- that setting off first.
-- =============================================================================

drop function if exists public.note_presence(text);
drop function if exists public.change_staff_access(uuid, text, text);
drop function if exists public.accept_my_invite();
drop function if exists public.cancel_invite(bigint, text);
drop function if exists public.send_invite_again(bigint);
drop function if exists public.invite_staff(text, text, public.staff_role, bigint, boolean, boolean, boolean, boolean, boolean, boolean);

drop function if exists private.note_presence(text);
drop function if exists private.change_staff_access(uuid, text, text);
drop function if exists private.accept_my_invite();
drop function if exists private.cancel_invite(bigint, text);
drop function if exists private.send_invite_again(bigint);
drop function if exists private.invite_staff(text, text, public.staff_role, bigint, boolean, boolean, boolean, boolean, boolean, boolean);

drop trigger if exists rhema_only_invited_sign_ups on auth.users;
drop function if exists private.only_invited_sign_ups();
drop function if exists private.has_waiting_invite(text);
revoke usage on schema private from supabase_auth_admin;

drop table if exists public.staff_sessions;
drop table if exists public.staff_invites;

grant update (is_active) on public.staff to authenticated;
-- Loses the record of who was revoked and when.
alter table public.staff drop column if exists revoked_at;
