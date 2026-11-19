-- =============================================================================
-- 20261119132802_front_desk_takes_vitals.sql
--
-- What this is: the Front Desk may take vital signs. A reading the Front
-- Desk saves goes into the same vital signs as the nurses' readings, so the
-- doctor sees it in the medical record. The Front Desk still never opens the
-- medical record.
--
-- Why: Anthony, 2026-11-19 (request 228c): "front desk used to enter vital
-- signs too... I want you to add a button where it says take vitals. That
-- take vitals is the same vital that will populate the vitals that is
-- inside of the medical record... so doctor can see the vitals that the
-- front desk has taken."
--
-- Rules:
--   - The Front Desk (role front_desk) may add a vital signs line for any
--     patient, in its own name only, and signed by itself only.
--   - The Front Desk reads back only the lines it saved itself, so a reply
--     lost on a poor network is not sent twice. It never sees anybody
--     else's readings, or any other part of the record.
--   - The Front Desk cannot void a reading. A wrong one is voided by the
--     nurse or the doctor from the record, with a reason, as before.
--   - Everything else stays: clinical staff with the record open add and
--     void readings; the double tap guard and the activity log still run on
--     every line.
--
-- Never: let the Front Desk read the medical record, save a reading in
-- another person's name, or sign as somebody else.
-- =============================================================================


-- ===== 1. Adding a reading: clinical staff with the record open, or the Front Desk =====
drop policy vitals_insert on public.vital_signs;
create policy vitals_insert on public.vital_signs for insert to authenticated
  with check (
    ((select private.can_use_record(patient_id)) or (select private.is_front_desk()))
    and recorded_by = (select auth.uid())
  );


-- ===== 2. The Front Desk reads back only its own readings =====
create policy vitals_read_own_front_desk on public.vital_signs for select to authenticated
  using ((select private.is_front_desk()) and recorded_by = (select auth.uid()));


-- ===== 3. Who may sign a reading =====
-- The Front Desk signs only as itself. Everybody else: as before, the signer
-- must be active clinical staff (so nobody signs in the Front Desk's name).
create function private.check_vitals_signed_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.signed_by is null then
    new.signed_by := (select auth.uid());
  end if;
  if (select private.is_front_desk()) then
    if new.signed_by is distinct from (select auth.uid()) then
      raise exception 'The Front Desk signs only as itself' using errcode = '42501';
    end if;
    return new;
  end if;
  if not exists (
    select 1 from public.staff s
    where s.id = new.signed_by and s.is_active and s.can_medical
  ) then
    raise exception 'Only active clinical staff can sign' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.check_vitals_signed_by() from public, anon, authenticated;

drop trigger vital_signs_signed_by on public.vital_signs;
create trigger vital_signs_signed_by before insert on public.vital_signs
  for each row execute function private.check_vitals_signed_by();
