-- =============================================================================
-- 20261030120025_staff_invites.sql
--
-- What this is: the database side of Admin (request 112).
--   1. Invitations: the admin invites a person by email. The invitation
--      waits 72 hours, then runs out. It can be sent again or cancelled.
--   2. Only invited emails can sign up. Supabase's "allow new users to sign
--      up" is on (Anthony switched it on, 2026-10-30, option A), so this
--      rule is what keeps strangers out.
--   3. The first sign in turns the invitation into a staff account.
--   4. Suspend, unsuspend and revoke a staff member, each with the admin's
--      own PIN.
--   5. Signed in and signed out times, for the activity log screen.
--
-- Why: Anthony, 2026-10-30. "As long as they log in using that same email
-- that was invited... 72 hours instead of 48 hours for expiry... the admin
-- will see that this invitation has expired." "Suspend does not mean the
-- person will have to get a new invitation." "A revoked person... can be
-- re-added, and if they are re-added, it means they are coming in again to
-- start the account again." "Those actions will always go with the pin, the
-- admin's pin."
--
-- Rules:
--   - Only an admin reads invitations. Nobody writes them except through
--     the functions below, which check the admin themselves.
--   - Suspend, unsuspend, revoke and cancel need the admin's PIN, checked
--     here. Five wrong PINs lock the admin out, the same as the lock screen.
--   - is_active can no longer be changed straight through the API, only by
--     those functions, so nobody can skip the PIN.
--   - A suspended or revoked person keeps every record they made. Nothing is
--     ever deleted.
--
-- Never: let an email without a waiting invitation create a sign in
-- account. Never let an admin switch off their own account here.
-- =============================================================================


-- ===== 1. Staff: when a person was revoked ==================================
-- Suspended: is_active false, revoked_at empty. Revoked: revoked_at set.

alter table public.staff add column if not exists revoked_at timestamptz;
grant select (revoked_at) on public.staff to authenticated;

-- Switching a person off now always goes through section 7, with the PIN.
revoke update (is_active) on public.staff from authenticated;


-- ===== 2. The invitations table =============================================

create table public.staff_invites (
  id            bigint generated always as identity primary key,
  email         text not null
                check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name     text not null check (length(trim(full_name)) between 2 and 120),
  role          public.staff_role not null,
  room_id       bigint references public.rooms (id),
  -- The access ticks from the invite form, copied onto the staff row when
  -- the invitation is used.
  can_patients  boolean not null default true,
  can_medical   boolean not null default false,
  can_pharmacy  boolean not null default false,
  can_lab       boolean not null default false,
  can_announce  boolean not null default false,
  can_admin     boolean not null default false,
  -- Empty only when the database owner made it by hand (the first admin).
  invited_by    uuid references public.staff (id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '72 hours',
  -- waiting: not used yet (it has run out once expires_at has passed).
  -- accepted: the person signed in. cancelled: the admin took it back.
  -- replaced: a newer invitation for the same email took its place.
  status        text not null default 'waiting'
                check (status in ('waiting', 'accepted', 'cancelled', 'replaced')),
  accepted_at   timestamptz
);

-- One waiting invitation per email at a time.
create unique index staff_invites_one_waiting on public.staff_invites (email)
  where status = 'waiting';
create index staff_invites_created_idx on public.staff_invites (created_at desc);

-- Supabase gives every new table full rights. Take them all away first,
-- then give back only what this table needs: reading, for the admin.
revoke all on public.staff_invites from anon, authenticated;
alter table public.staff_invites enable row level security;
grant select on public.staff_invites to authenticated;

create policy staff_invites_read on public.staff_invites
  for select to authenticated
  using ((select private.is_admin()));

create trigger staff_invites_activity
  after insert or update on public.staff_invites
  for each row execute function private.write_activity();


-- ===== 3. Only invited emails can sign up ===================================
-- Supabase's sign in service connects as supabase_auth_admin. Every new
-- sign in account it makes must have a waiting invitation under 72 hours
-- old. The database owner (a migration, a test, or Anthony by hand in SQL)
-- is not stopped, so the very first admin can still be set up.

-- The question, asked as the database owner so it can read the invitations.
create function private.has_waiting_invite(person_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_invites
    where email = lower(trim(person_email))
      and status = 'waiting'
      and expires_at > now()
  );
$$;

-- The rule itself runs as whoever adds the account (not as the owner), so
-- it can tell the sign in service apart from the database owner.
create function private.only_invited_sign_ups()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'supabase_auth_admin' and not private.has_waiting_invite(new.email) then
    raise exception 'RHEMA: this email has no waiting invitation' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.has_waiting_invite(text) from public, anon, authenticated;
revoke execute on function private.only_invited_sign_ups() from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.has_waiting_invite(text) to supabase_auth_admin;
grant execute on function private.only_invited_sign_ups() to supabase_auth_admin;

create trigger rhema_only_invited_sign_ups
  before insert on auth.users
  for each row execute function private.only_invited_sign_ups();


-- ===== 4. Invite a person ====================================================
-- Answers: invited, already_sent (a double tap within 30 seconds),
-- already_staff, suspended (unsuspend them instead), already_invited.

create function private.invite_staff(
  person_email  text,
  person_name   text,
  person_role   public.staff_role,
  person_room   bigint,
  patients      boolean,
  medical       boolean,
  pharmacy      boolean,
  lab           boolean,
  announce      boolean,
  admin         boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(trim(person_email));
begin
  if not (select private.is_admin()) then
    raise exception 'Only an admin can invite staff' using errcode = '42501';
  end if;

  -- Two taps at the same moment wait here for each other.
  perform pg_advisory_xact_lock(hashtext('invite:' || clean_email));

  if exists (
    select 1 from public.staff_invites
    where email = clean_email
      and invited_by = (select auth.uid())
      and created_at > now() - interval '30 seconds'
  ) then
    return 'already_sent';
  end if;

  if exists (select 1 from public.staff where lower(email) = clean_email and is_active) then
    return 'already_staff';
  end if;
  if exists (
    select 1 from public.staff
    where lower(email) = clean_email and not is_active and revoked_at is null
  ) then
    return 'suspended';
  end if;
  if exists (
    select 1 from public.staff_invites
    where email = clean_email and status = 'waiting' and expires_at > now()
  ) then
    return 'already_invited';
  end if;

  -- An invitation that ran out makes way for the new one.
  update public.staff_invites set status = 'replaced'
  where email = clean_email and status = 'waiting';

  insert into public.staff_invites (
    email, full_name, role, room_id,
    can_patients, can_medical, can_pharmacy, can_lab, can_announce, can_admin,
    invited_by
  ) values (
    clean_email, trim(person_name), person_role, person_room,
    patients, medical, pharmacy, lab, announce, admin or person_role = 'admin',
    (select auth.uid())
  );
  return 'invited';
end;
$$;


-- ===== 5. Send an invitation again, or cancel it =============================
-- Again: for one that ran out or was cancelled. It gets a fresh 72 hours.

create function private.send_invite_again(invite_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.staff_invites;
begin
  if not (select private.is_admin()) then
    raise exception 'Only an admin can send invitations' using errcode = '42501';
  end if;

  select * into invite from public.staff_invites where id = invite_id;
  if not found then
    raise exception 'No such invitation' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('invite:' || invite.email));

  if invite.status = 'accepted' or invite.status = 'replaced' then
    return 'not_needed';
  end if;
  if invite.status = 'waiting' and invite.expires_at > now() then
    return 'still_waiting';
  end if;
  if exists (select 1 from public.staff where lower(email) = invite.email and is_active) then
    return 'already_staff';
  end if;
  if exists (
    select 1 from public.staff_invites
    where email = invite.email and status = 'waiting' and id <> invite.id
  ) then
    return 'already_invited';
  end if;

  update public.staff_invites
  set status = 'waiting',
      created_at = now(),
      expires_at = now() + interval '72 hours',
      invited_by = (select auth.uid())
  where id = invite.id;
  return 'invited';
end;
$$;

-- Cancel: with the admin's PIN. The person can be invited again later.
create function private.cancel_invite(invite_id bigint, pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pin_answer text;
begin
  if not (select private.is_admin()) then
    raise exception 'Only an admin can cancel invitations' using errcode = '42501';
  end if;
  pin_answer := private.check_my_pin(pin);
  if pin_answer <> 'ok' then
    return case pin_answer when 'locked' then 'locked' else 'wrong_pin' end;
  end if;

  update public.staff_invites set status = 'cancelled'
  where id = invite_id and status = 'waiting';
  return 'cancelled';
end;
$$;


-- ===== 6. The first sign in: the invitation becomes a staff account ==========
-- Called by the app straight after a code is accepted. A new person gets a
-- staff row. A person who was revoked and invited again gets their old row
-- back with the new details, and must choose a new PIN ("start the account
-- again"). Answers true when an invitation was used.

create function private.accept_my_invite()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me_id  uuid := (select auth.uid());
  invite public.staff_invites;
begin
  if me_id is null then
    return false;
  end if;

  select i.* into invite
  from public.staff_invites i
  join auth.users u on lower(u.email) = i.email
  where u.id = me_id and i.status = 'waiting' and i.expires_at > now()
  for update of i;
  if not found then
    return false;
  end if;

  if exists (select 1 from public.staff where id = me_id) then
    update public.staff
    set full_name = invite.full_name,
        role = invite.role,
        room_id = invite.room_id,
        is_active = true,
        revoked_at = null,
        pin_hash = null,
        pin_failed_attempts = 0
    where id = me_id;
  else
    -- The starting access comes from the role first (a trigger)...
    insert into public.staff (id, full_name, email, role, room_id)
    values (me_id, invite.full_name, invite.email, invite.role, invite.room_id);
  end if;

  -- ...then the ticks the admin chose on the invite form win.
  update public.staff
  set can_patients = invite.can_patients,
      can_medical  = invite.can_medical,
      can_pharmacy = invite.can_pharmacy,
      can_lab      = invite.can_lab,
      can_announce = invite.can_announce,
      can_admin    = invite.can_admin,
      can_logs     = invite.can_admin
  where id = me_id;

  update public.staff_invites
  set status = 'accepted', accepted_at = now()
  where id = invite.id;
  return true;
end;
$$;


-- ===== 7. Suspend, unsuspend or revoke a staff member, with the PIN =========
-- Answers: done, already, wrong_pin, locked (5 wrong PINs: sign in again),
-- not_yourself.

create function private.change_staff_access(person uuid, change text, pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pin_answer text;
  target     public.staff;
begin
  if not (select private.is_admin()) then
    raise exception 'Only an admin can change staff access' using errcode = '42501';
  end if;
  if change not in ('suspend', 'unsuspend', 'revoke') then
    raise exception 'Unknown change' using errcode = '22023';
  end if;
  if person = (select auth.uid()) then
    return 'not_yourself';
  end if;

  pin_answer := private.check_my_pin(pin);
  if pin_answer <> 'ok' then
    return case pin_answer when 'locked' then 'locked' else 'wrong_pin' end;
  end if;

  perform pg_advisory_xact_lock(hashtext('staff-access:' || person::text));
  select * into target from public.staff where id = person;
  if not found then
    raise exception 'No such staff member' using errcode = '22023';
  end if;

  if change = 'suspend' then
    if not target.is_active then return 'already'; end if;
    update public.staff set is_active = false where id = person;
  elsif change = 'unsuspend' then
    if target.is_active or target.revoked_at is not null then return 'already'; end if;
    update public.staff set is_active = true where id = person;
  else
    if target.revoked_at is not null then return 'already'; end if;
    update public.staff set is_active = false, revoked_at = now() where id = person;
  end if;
  return 'done';
end;
$$;


-- ===== 8. Signed in and signed out, for the activity log screen ==============
-- One row per stretch of use. The app says "seen" when the person signs in
-- or unlocks and every 3 minutes while they use it, and "end" when they
-- lock or sign out. "start" always begins a new stretch.

create table public.staff_sessions (
  id            bigint generated always as identity primary key,
  staff_id      uuid not null references public.staff (id),
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended_at      timestamptz
);

create index staff_sessions_staff_idx on public.staff_sessions (staff_id, started_at desc);
create index staff_sessions_started_idx on public.staff_sessions (started_at desc);

revoke all on public.staff_sessions from anon, authenticated;
alter table public.staff_sessions enable row level security;
grant select on public.staff_sessions to authenticated;

-- Your own, or everybody's with the activity log permission.
create policy staff_sessions_read on public.staff_sessions
  for select to authenticated
  using (
    staff_id = (select auth.uid()) and (select private.is_active_staff())
    or (select private.has_permission('logs'))
  );

create function private.note_presence(kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me_id   uuid := (select auth.uid());
  open_id bigint;
begin
  if not (select private.is_active_staff()) then
    return;
  end if;
  if kind not in ('start', 'seen', 'end') then
    raise exception 'Unknown kind' using errcode = '22023';
  end if;

  select id into open_id from public.staff_sessions
  where staff_id = me_id and ended_at is null
  order by started_at desc limit 1;

  if kind = 'start' then
    -- A stretch left open (a closed tab) ends where it was last seen.
    update public.staff_sessions set ended_at = last_seen_at
    where staff_id = me_id and ended_at is null;
    insert into public.staff_sessions (staff_id) values (me_id);
  elsif kind = 'seen' then
    -- Not seen for 10 minutes (a closed tab, a dead battery): that stretch
    -- ended when they were last seen, and this is a new one. So the time
    -- the app was shut never counts as time online.
    if open_id is not null and exists (
      select 1 from public.staff_sessions
      where id = open_id and last_seen_at < now() - interval '10 minutes'
    ) then
      update public.staff_sessions set ended_at = last_seen_at where id = open_id;
      open_id := null;
    end if;
    if open_id is null then
      insert into public.staff_sessions (staff_id) values (me_id);
    else
      update public.staff_sessions set last_seen_at = now() where id = open_id;
    end if;
  elsif open_id is not null then
    update public.staff_sessions set last_seen_at = now(), ended_at = now() where id = open_id;
  end if;
end;
$$;


-- ===== 9. What the app may call =============================================
-- The private functions are reached only through these thin wrappers.

revoke execute on function private.invite_staff(text, text, public.staff_role, bigint, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function private.send_invite_again(bigint)                from public, anon;
revoke execute on function private.cancel_invite(bigint, text)              from public, anon;
revoke execute on function private.accept_my_invite()                       from public, anon;
revoke execute on function private.change_staff_access(uuid, text, text)    from public, anon;
revoke execute on function private.note_presence(text)                      from public, anon;
grant  execute on function private.invite_staff(text, text, public.staff_role, bigint, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant  execute on function private.send_invite_again(bigint)                to authenticated;
grant  execute on function private.cancel_invite(bigint, text)              to authenticated;
grant  execute on function private.accept_my_invite()                       to authenticated;
grant  execute on function private.change_staff_access(uuid, text, text)    to authenticated;
grant  execute on function private.note_presence(text)                      to authenticated;

create function public.invite_staff(
  person_email text, person_name text, person_role public.staff_role, person_room bigint,
  patients boolean, medical boolean, pharmacy boolean, lab boolean, announce boolean, admin boolean
)
returns text language sql security invoker set search_path = ''
as $$ select private.invite_staff(person_email, person_name, person_role, person_room,
                                  patients, medical, pharmacy, lab, announce, admin); $$;

create function public.send_invite_again(invite_id bigint)
returns text language sql security invoker set search_path = ''
as $$ select private.send_invite_again(invite_id); $$;

create function public.cancel_invite(invite_id bigint, pin text)
returns text language sql security invoker set search_path = ''
as $$ select private.cancel_invite(invite_id, pin); $$;

create function public.accept_my_invite()
returns boolean language sql security invoker set search_path = ''
as $$ select private.accept_my_invite(); $$;

create function public.change_staff_access(person uuid, change text, pin text)
returns text language sql security invoker set search_path = ''
as $$ select private.change_staff_access(person, change, pin); $$;

create function public.note_presence(kind text)
returns void language sql security invoker set search_path = ''
as $$ select private.note_presence(kind); $$;

revoke execute on function public.invite_staff(text, text, public.staff_role, bigint, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function public.send_invite_again(bigint)                from public, anon;
revoke execute on function public.cancel_invite(bigint, text)              from public, anon;
revoke execute on function public.accept_my_invite()                       from public, anon;
revoke execute on function public.change_staff_access(uuid, text, text)    from public, anon;
revoke execute on function public.note_presence(text)                      from public, anon;
grant  execute on function public.invite_staff(text, text, public.staff_role, bigint, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant  execute on function public.send_invite_again(bigint)                to authenticated;
grant  execute on function public.cancel_invite(bigint, text)              to authenticated;
grant  execute on function public.accept_my_invite()                       to authenticated;
grant  execute on function public.change_staff_access(uuid, text, text)    to authenticated;
grant  execute on function public.note_presence(text)                      to authenticated;
