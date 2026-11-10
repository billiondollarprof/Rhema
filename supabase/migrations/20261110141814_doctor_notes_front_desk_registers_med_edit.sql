-- =============================================================================
-- 20261110141814_doctor_notes_front_desk_registers_med_edit.sql
--
-- What this is: three rules about who may do what.
--   1. Only a doctor writes or voids a consultation note.
--   2. Only the Front Desk registers a patient.
--   3. A nurse (anybody with the record open) may correct a current
--      medicine's name, dose and how often, while it is not stopped.
--
-- Why: Anthony, 2026-11-10: "the nurses are able to perform some things only
-- doctors are supposed to do like consultation notes... only front desk
-- registers patients, while others can find a patient but not register
-- them... only when the medication is there... shall the nurse be able to
-- stop/suspend/edit that particular medication info."
--
-- Rules:
--   - Everybody with the record open still READS consultation notes.
--   - Notes already written by a nurse stay (nothing is deleted or changed).
--   - Finding and editing a patient is unchanged; only a new patient is
--     limited to the Front Desk.
--   - A stopped or voided medicine cannot be edited.
--
-- Never: let a nurse write a consultation note, or let anybody but the Front
-- Desk create a patient.
-- =============================================================================


-- ===== 1. Who is the Front Desk =====
create function private.is_front_desk()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and role = 'front_desk'
  );
$$;

revoke execute on function private.is_front_desk() from public, anon;
grant  execute on function private.is_front_desk() to authenticated;


-- ===== 2. Consultation notes: a doctor writes and voids =====
drop policy consultation_insert on public.consultation_notes;
create policy consultation_insert on public.consultation_notes for insert to authenticated
  with check (
    private.can_use_record(patient_id)
    and (select private.is_doctor())
    and written_by = (select auth.uid())
  );

drop policy consultation_update on public.consultation_notes;
create policy consultation_update on public.consultation_notes for update to authenticated
  using (private.can_use_record(patient_id) and (select private.is_doctor()))
  with check (
    private.can_use_record(patient_id)
    and (select private.is_doctor())
    and (voided_by is null or voided_by = (select auth.uid()))
  );


-- ===== 3. Patients: the Front Desk registers =====
drop policy patients_insert on public.patients;
create policy patients_insert on public.patients
  for insert to authenticated
  with check (
    (select private.has_permission('patients'))
    and (select private.is_front_desk())
    and created_by = (select auth.uid())
  );


-- ===== 4. Medications: correct the name, dose and how often =====
grant update (medicine, dose, how_often) on public.patient_medications to authenticated;

create function private.guard_medication_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.medicine, new.dose, new.how_often) is distinct from (old.medicine, old.dose, old.how_often)
     and (old.status = 'stopped' or old.voided_at is not null) then
    raise exception 'A stopped or removed medicine cannot be edited.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_medication_edit() from public, anon, authenticated;

create trigger medications_guard_edit
  before update on public.patient_medications
  for each row execute function private.guard_medication_edit();
