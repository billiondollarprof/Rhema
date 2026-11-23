-- =============================================================================
-- 20261123192759_consulting_room_does_what_a_doctor_does.sql
--
-- What this is: anybody with medical access who works in a consulting room
-- (a doctor, the matron or a nurse) does what a doctor does: prescribe,
-- send a prescription on to the Pharmacy too, set prices and add a bill.
-- A doctor with no room assigned keeps all of it, as before.
--
-- Why: Anthony, 2026-11-23 (request 241): "I noticed that the matron does
-- not have access to prescribed drugs... anybody with a consultant room
-- must be able to prescribe, must be able to write consultant notes.
-- Everything that the doctor will do, as long as they are assigned to
-- consultant room... everybody with a consultant room can do everything
-- that a consultant can do." This replaces his note of 2026-11-20 that the
-- matron should not prescribe in the computer.
--
-- Rules:
--   - private.is_doctor() now means "acts as a doctor": the doctor role, or
--     a consulting room, with medical access, and active. Prescribing and
--     "send also" use it, so they follow.
--   - private.sets_prices() (prices and bills): the doctor or the matron, as
--     before, or anybody with medical access in a consulting room.
--   - Consultation notes already went by the consulting room (20261110141814).
--
-- Never: let somebody without medical access prescribe, even in a
-- consulting room.
-- =============================================================================


-- ===== 1. Acts as a doctor: the doctor role, or a consulting room =====
create or replace function private.is_doctor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    left join public.rooms r on r.id = s.room_id
    where s.id = (select auth.uid()) and s.is_active and s.can_medical
      and (s.role = 'doctor' or (r.is_active and r.kind = 'consultation'))
  );
$$;


-- ===== 2. Sets prices and adds bills: also anybody in a consulting room =====
create or replace function private.sets_prices()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    left join public.rooms r on r.id = s.room_id
    where s.id = (select auth.uid()) and s.is_active
      and (s.role in ('doctor', 'matron')
           or (s.can_medical and r.is_active and r.kind = 'consultation'))
  );
$$;
