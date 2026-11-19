-- =============================================================================
-- 20261119011959_antenatal_details_into_booking.sql
--
-- What this is:
--   1. Removes the eight patient columns added by 20261118211434. They were
--      a copy of what the antenatal booking already keeps, and are empty.
--   2. Lets the Front Desk fill in, and read back, only the antenatal card's
--      details in the booking: the mother's marital status, religion,
--      education and occupation; the next of kin's occupation, religion,
--      education and age. Nothing else in the medical record.
--
-- Why: Anthony, 2026-11-19 (request 227g): "if you added 8 empty columns
-- that have nothing... remove them... saving what the front desk types
-- into the same antenatal booking so the [nurse] sees it already filled
-- in... I think that's okay."
--
-- Rules:
--   - Only the Front Desk (who registers and edits patients) or somebody
--     who may open the record, and only for an antenatal patient.
--   - Only these nine details; the booking's other parts stay medical only.
--   - Every save goes in the activity log (the booking's own trigger).
--
-- Never: let the Front Desk read or write any other part of the booking.
-- =============================================================================


-- ===== 1. The empty copy goes (Anthony's yes, 2026-11-19) =====
alter table public.patients
  drop column if exists marital_status,
  drop column if exists religion,
  drop column if exists education_level,
  drop column if exists occupation,
  drop column if exists next_of_kin_occupation,
  drop column if exists next_of_kin_religion,
  drop column if exists next_of_kin_education_level,
  drop column if exists next_of_kin_age;


-- ===== 2. Who may fill them in =====
create function private.may_fill_antenatal(patient bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patients p
    where p.id = patient and p.category = 'antenatal'
  ) and (
    ((select private.has_permission('patients')) and (select private.is_front_desk()))
    or private.can_use_record(patient)
  );
$$;


-- ===== 3. Read them back (for Edit patient) =====
create function private.antenatal_details(patient bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.may_fill_antenatal(patient) then null else (
    select jsonb_build_object(
      'client_marital_status', b.client_marital_status,
      'client_religion', b.client_religion,
      'client_education', b.client_education,
      'client_occupation', b.client_occupation,
      'kin_occupation', b.kin_occupation,
      'kin_religion', b.kin_religion,
      'kin_education', b.kin_education,
      'kin_age', b.kin_age
    )
    from public.antenatal_bookings b where b.patient_id = patient
  ) end;
$$;


-- ===== 4. Save them (registration, Edit patient) =====
-- details: the nine keys above, each text or null (kin_age a number).
-- Answers 'saved'. A detail left out of details is left as it was.
create function private.save_antenatal_details(patient bigint, details jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  t constant jsonb := coalesce(details, '{}'::jsonb);
begin
  if not private.may_fill_antenatal(patient) then
    raise exception 'Only the Front Desk fills in antenatal details' using errcode = '42501';
  end if;
  insert into public.antenatal_bookings (patient_id, updated_by)
  values (patient, (select auth.uid()))
  on conflict (patient_id) do nothing;
  update public.antenatal_bookings b set
    client_marital_status = case when t ? 'client_marital_status' then nullif(trim(t ->> 'client_marital_status'), '') else b.client_marital_status end,
    client_religion   = case when t ? 'client_religion'   then nullif(trim(t ->> 'client_religion'), '')   else b.client_religion end,
    client_education  = case when t ? 'client_education'  then nullif(trim(t ->> 'client_education'), '')  else b.client_education end,
    client_occupation = case when t ? 'client_occupation' then nullif(trim(t ->> 'client_occupation'), '') else b.client_occupation end,
    kin_occupation    = case when t ? 'kin_occupation'    then nullif(trim(t ->> 'kin_occupation'), '')    else b.kin_occupation end,
    kin_religion      = case when t ? 'kin_religion'      then nullif(trim(t ->> 'kin_religion'), '')      else b.kin_religion end,
    kin_education     = case when t ? 'kin_education'     then nullif(trim(t ->> 'kin_education'), '')     else b.kin_education end,
    kin_age           = case when t ? 'kin_age'           then (nullif(t ->> 'kin_age', ''))::smallint     else b.kin_age end,
    updated_by = (select auth.uid())
  where b.patient_id = patient;
  return 'saved';
end;
$$;


-- ===== 5. Who may call what =====
revoke execute on function private.may_fill_antenatal(bigint) from public, anon;
revoke execute on function private.antenatal_details(bigint) from public, anon;
revoke execute on function private.save_antenatal_details(bigint, jsonb) from public, anon;
grant  execute on function private.may_fill_antenatal(bigint) to authenticated;
grant  execute on function private.antenatal_details(bigint) to authenticated;
grant  execute on function private.save_antenatal_details(bigint, jsonb) to authenticated;

create function public.antenatal_details(patient bigint)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.antenatal_details(patient); $$;
create function public.save_antenatal_details(patient bigint, details jsonb)
returns text language sql security invoker set search_path = ''
as $$ select private.save_antenatal_details(patient, details); $$;

revoke execute on function public.antenatal_details(bigint) from public, anon;
revoke execute on function public.save_antenatal_details(bigint, jsonb) from public, anon;
grant  execute on function public.antenatal_details(bigint) to authenticated;
grant  execute on function public.save_antenatal_details(bigint, jsonb) to authenticated;
