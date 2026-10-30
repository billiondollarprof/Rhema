-- =============================================================================
-- 008_staff_invites.sql: tests for Admin's database side (request 112).
--
-- What this is: proves that only an invited email can sign up, that the
-- invitation runs out after 72 hours, that the first sign in turns it into
-- a staff account with the admin's chosen access, that suspend, unsuspend,
-- revoke and cancel need the admin's own PIN, that nobody but an admin can
-- do any of it, and that the signed in times are kept and shown to the
-- right people.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin1@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a2', 'nurse1@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a3', 'desk1@test.rhema');
insert into public.staff (id, full_name, email, role, can_admin) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Admin One', 'admin1@test.rhema', 'doctor', true),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Nurse One', 'nurse1@test.rhema', 'nurse', false),
  ('00000000-0000-0000-0000-0000000000a3', 'Test Desk One', 'desk1@test.rhema', 'front_desk', false);

-- The admin chooses a PIN, as on their first sign in.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
select public.set_my_pin('1111');
reset role;


-- ===== 1. A stranger cannot sign up ==========================================
set local role supabase_auth_admin;
do $$
begin
  insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000b9', 'stranger@test.rhema');
  raise exception 'FAIL 1: an email with no invitation signed up';
exception when insufficient_privilege then
  null;
end $$;
reset role;
\echo 'PASS 1: an email with no invitation cannot sign up'


-- ===== 2. Only an admin can invite ===========================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
set local role authenticated;
do $$
begin
  perform public.invite_staff('new1@test.rhema', 'New Person', 'nurse', null,
                              true, true, false, false, false, false);
  raise exception 'FAIL 2: a nurse sent an invitation';
exception when insufficient_privilege then
  null;
end $$;
reset role;
\echo 'PASS 2: only an admin invites'


-- ===== 3. The admin invites; a double tap sends nothing new ==================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  if public.invite_staff(' New1@Test.rhema ', 'New Lab Nurse', 'nurse', null,
                         true, true, false, true, false, false) <> 'invited' then
    raise exception 'FAIL 3: the invitation was not made';
  end if;
  if public.invite_staff('new1@test.rhema', 'New Lab Nurse', 'nurse', null,
                         true, true, false, true, false, false) <> 'already_sent' then
    raise exception 'FAIL 3: a double tap made a second invitation';
  end if;
  if (select count(*) from public.staff_invites where email = 'new1@test.rhema') <> 1 then
    raise exception 'FAIL 3: expected exactly one invitation';
  end if;
  if (select expires_at - created_at from public.staff_invites where email = 'new1@test.rhema')
     <> interval '72 hours' then
    raise exception 'FAIL 3: the invitation does not last 72 hours';
  end if;
  if public.invite_staff('desk1@test.rhema', 'Test Desk One', 'front_desk', null,
                         true, false, false, false, false, false) <> 'already_staff' then
    raise exception 'FAIL 3: an active staff member was invited again';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.staff_invites) <> 0 then
    raise exception 'FAIL 3: a nurse can read invitations';
  end if;
end $$;
reset role;
\echo 'PASS 3: one invitation, 72 hours, no double, no inviting staff twice, admin only reads'


-- ===== 4. The invited email can sign up; a run out invitation cannot =========
insert into public.staff_invites (email, full_name, role, created_at, expires_at)
values ('late@test.rhema', 'Late Person', 'nurse', now() - interval '73 hours', now() - interval '1 hour');
set local role supabase_auth_admin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'new1@test.rhema');
do $$
begin
  insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000b2', 'late@test.rhema');
  raise exception 'FAIL 4: an invitation that ran out still let somebody sign up';
exception when insufficient_privilege then
  null;
end $$;
reset role;
\echo 'PASS 4: invited signs up, run out does not'


-- ===== 5. The first sign in makes the staff account with the chosen access ===
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
set local role authenticated;
do $$
begin
  if not public.accept_my_invite() then
    raise exception 'FAIL 5: the invitation was not used';
  end if;
  if public.accept_my_invite() then
    raise exception 'FAIL 5: the same invitation was used twice';
  end if;
end $$;
reset role;
do $$
declare
  member public.staff;
begin
  select * into member from public.staff where id = '00000000-0000-0000-0000-0000000000b1';
  if not found or not member.is_active then raise exception 'FAIL 5: no active staff row'; end if;
  if member.full_name <> 'New Lab Nurse' then raise exception 'FAIL 5: wrong name'; end if;
  -- A nurse does not get the laboratory by default; the admin ticked it.
  if not member.can_lab then raise exception 'FAIL 5: the admin''s tick was lost'; end if;
  if member.can_admin then raise exception 'FAIL 5: became an admin without the tick'; end if;
  if (select status from public.staff_invites where email = 'new1@test.rhema') <> 'accepted' then
    raise exception 'FAIL 5: the invitation is not marked used';
  end if;
end $$;
\echo 'PASS 5: the first sign in makes the account, with the admin''s ticks'


-- ===== 6. Somebody with no invitation gets nothing from accept ===============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
do $$
begin
  if public.accept_my_invite() then raise exception 'FAIL 6: accepted with no invitation'; end if;
end $$;
reset role;
\echo 'PASS 6: no invitation, nothing changes'


-- ===== 7. Suspend needs the right PIN; nobody switches off themselves ========
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  if public.change_staff_access('00000000-0000-0000-0000-0000000000a3', 'suspend', '9999') <> 'wrong_pin' then
    raise exception 'FAIL 7: a wrong PIN suspended somebody';
  end if;
  if public.change_staff_access('00000000-0000-0000-0000-0000000000a1', 'suspend', '1111') <> 'not_yourself' then
    raise exception 'FAIL 7: the admin suspended themselves';
  end if;
  if public.change_staff_access('00000000-0000-0000-0000-0000000000a3', 'suspend', '1111') <> 'done' then
    raise exception 'FAIL 7: the right PIN did not suspend';
  end if;
  if public.change_staff_access('00000000-0000-0000-0000-0000000000a3', 'suspend', '1111') <> 'already' then
    raise exception 'FAIL 7: suspending twice did not say already';
  end if;
end $$;
reset role;
do $$
begin
  if (select is_active from public.staff where email = 'desk1@test.rhema') then
    raise exception 'FAIL 7: the desk is still active';
  end if;
  if (select pin_failed_attempts from public.staff where email = 'admin1@test.rhema') <> 0 then
    raise exception 'FAIL 7: the right PIN did not clear the wrong try';
  end if;
end $$;
\echo 'PASS 7: suspend needs the right PIN, never yourself'


-- ===== 8. A suspended person sees nothing and cannot be invited ==============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.staff) <> 0 then
    raise exception 'FAIL 8: a suspended person can read the staff list';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  if public.invite_staff('desk1@test.rhema', 'Test Desk One', 'front_desk', null,
                         true, false, false, false, false, false) <> 'suspended' then
    raise exception 'FAIL 8: a suspended person was invited instead of unsuspended';
  end if;
  if public.change_staff_access('00000000-0000-0000-0000-0000000000a3', 'unsuspend', '1111') <> 'done' then
    raise exception 'FAIL 8: unsuspend failed';
  end if;
end $$;
reset role;
do $$
begin
  if not (select is_active from public.staff where email = 'desk1@test.rhema') then
    raise exception 'FAIL 8: the desk is not back';
  end if;
end $$;
\echo 'PASS 8: suspended sees nothing; unsuspend brings them back'


-- ===== 9. Revoke, then invite again: the account starts again =================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
select public.set_my_pin('2222');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  if public.change_staff_access('00000000-0000-0000-0000-0000000000a3', 'revoke', '1111') <> 'done' then
    raise exception 'FAIL 9: revoke failed';
  end if;
  if public.change_staff_access('00000000-0000-0000-0000-0000000000a3', 'unsuspend', '1111') <> 'already' then
    raise exception 'FAIL 9: a revoked person was unsuspended without a new invitation';
  end if;
  if public.invite_staff('desk1@test.rhema', 'Test Desk Again', 'front_desk', null,
                         true, false, false, false, false, false) <> 'invited' then
    raise exception 'FAIL 9: a revoked person could not be invited again';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
do $$
begin
  if not public.accept_my_invite() then raise exception 'FAIL 9: the new invitation was not used'; end if;
end $$;
reset role;
do $$
declare
  member public.staff;
begin
  select * into member from public.staff where email = 'desk1@test.rhema';
  if not member.is_active or member.revoked_at is not null then
    raise exception 'FAIL 9: not active again';
  end if;
  if member.pin_hash is not null then raise exception 'FAIL 9: the old PIN was kept'; end if;
  if member.full_name <> 'Test Desk Again' then raise exception 'FAIL 9: the new name was not used'; end if;
end $$;
\echo 'PASS 9: revoke, invite again, the account starts again with a new PIN'


-- ===== 10. Nobody switches a person on or off without the functions ==========
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  update public.staff set is_active = false where email = 'nurse1@test.rhema';
  raise exception 'FAIL 10: the admin switched somebody off without a PIN';
exception when insufficient_privilege then
  null;
end $$;
reset role;
\echo 'PASS 10: switching off always goes through the PIN'


-- ===== 11. Cancel needs the PIN; a cancelled invitation can be sent again =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
select public.invite_staff('new2@test.rhema', 'New Two', 'pharmacy', null,
                           true, false, true, false, false, false);
do $$
declare
  invite_id bigint := (select id from public.staff_invites where email = 'new2@test.rhema');
begin
  if public.cancel_invite(invite_id, '0000') <> 'wrong_pin' then
    raise exception 'FAIL 11: a wrong PIN cancelled an invitation';
  end if;
  if public.cancel_invite(invite_id, '1111') <> 'cancelled' then
    raise exception 'FAIL 11: the right PIN did not cancel';
  end if;
  if public.send_invite_again(invite_id) <> 'invited' then
    raise exception 'FAIL 11: a cancelled invitation could not be sent again';
  end if;
  if (select status from public.staff_invites where id = invite_id) <> 'waiting' then
    raise exception 'FAIL 11: the invitation is not waiting again';
  end if;
  if public.send_invite_again(invite_id) <> 'still_waiting' then
    raise exception 'FAIL 11: a waiting invitation was sent again';
  end if;
end $$;
reset role;
\echo 'PASS 11: cancel needs the PIN; it can be sent again'


-- ===== 12. A run out invitation is sent again with a fresh 72 hours ==========
update public.staff_invites
set created_at = now() - interval '80 hours', expires_at = now() - interval '8 hours'
where email = 'new2@test.rhema';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
declare
  invite_id bigint := (select id from public.staff_invites where email = 'new2@test.rhema');
begin
  if public.send_invite_again(invite_id) <> 'invited' then
    raise exception 'FAIL 12: a run out invitation was not sent again';
  end if;
  if (select expires_at from public.staff_invites where id = invite_id) < now() + interval '71 hours' then
    raise exception 'FAIL 12: no fresh 72 hours';
  end if;
end $$;
reset role;
\echo 'PASS 12: a run out invitation gets a fresh 72 hours'


-- ===== 13. Signed in times: kept, and shown to the right people ==============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
set local role authenticated;
select public.note_presence('start');
select public.note_presence('seen');
select public.note_presence('end');
do $$
begin
  if (select count(*) from public.staff_sessions) <> 1 then
    raise exception 'FAIL 13: the nurse should see exactly her own one stretch';
  end if;
  if (select ended_at from public.staff_sessions) is null then
    raise exception 'FAIL 13: signing out was not kept';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
select public.note_presence('start');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.staff_sessions) <> 1 then
    raise exception 'FAIL 13: the nurse can see the admin''s times';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.staff_sessions) <> 2 then
    raise exception 'FAIL 13: the admin should see everybody''s times';
  end if;
end $$;
reset role;
-- A stretch not seen for 10 minutes ends where it was last seen.
update public.staff_sessions set last_seen_at = now() - interval '30 minutes', started_at = now() - interval '40 minutes'
where staff_id = '00000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
select public.note_presence('seen');
reset role;
do $$
begin
  if (select count(*) from public.staff_sessions where staff_id = '00000000-0000-0000-0000-0000000000a1') <> 2 then
    raise exception 'FAIL 13: a stretch after a long gap did not start fresh';
  end if;
  if exists (
    select 1 from public.staff_sessions
    where staff_id = '00000000-0000-0000-0000-0000000000a1'
      and ended_at is not null and ended_at > now() - interval '20 minutes'
  ) then
    raise exception 'FAIL 13: the gap was counted as time online';
  end if;
end $$;
\echo 'PASS 13: times kept; your own, or everybody''s for the admin; gaps never count'


-- ===== 14. Five wrong PINs lock the admin out ================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
declare
  answer text;
begin
  for attempt in 1..5 loop
    answer := public.change_staff_access('00000000-0000-0000-0000-0000000000a2', 'suspend', '0000');
  end loop;
  if answer <> 'locked' then raise exception 'FAIL 14: five wrong PINs did not lock'; end if;
  if public.change_staff_access('00000000-0000-0000-0000-0000000000a2', 'suspend', '1111') <> 'locked' then
    raise exception 'FAIL 14: the right PIN worked after the lock out';
  end if;
end $$;
reset role;
do $$
begin
  if not (select is_active from public.staff where email = 'nurse1@test.rhema') then
    raise exception 'FAIL 14: the nurse was suspended during a lock out';
  end if;
end $$;
\echo 'PASS 14: five wrong PINs lock the admin out'


-- ===== 15. Somebody not signed in can call none of it ========================
set local role anon;
do $$
begin
  perform public.accept_my_invite();
  raise exception 'FAIL 15: anon called accept_my_invite';
exception when insufficient_privilege then
  null;
end $$;
do $$
begin
  perform public.change_staff_access('00000000-0000-0000-0000-0000000000a2', 'suspend', '1111');
  raise exception 'FAIL 15: anon called change_staff_access';
exception when insufficient_privilege then
  null;
end $$;
reset role;
\echo 'PASS 15: nothing works for somebody not signed in'


-- ===== 16. An invitation that ran out cannot be used to sign in =============
-- (A person who already has a sign in account, e.g. one revoked earlier.)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b3', 'old@test.rhema');
insert into public.staff_invites (email, full_name, role, created_at, expires_at)
values ('old@test.rhema', 'Old Person', 'nurse', now() - interval '73 hours', now() - interval '1 hour');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3"}', true);
set local role authenticated;
do $$
begin
  if public.accept_my_invite() then
    raise exception 'FAIL 16: an invitation that ran out was used';
  end if;
end $$;
reset role;
\echo 'PASS 16: an invitation that ran out cannot be used'

rollback;
