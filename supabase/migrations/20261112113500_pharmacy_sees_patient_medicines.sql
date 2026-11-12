-- =============================================================================
-- 20261112113500_pharmacy_sees_patient_medicines.sql
--
-- What this is: the Pharmacy can see the medicines a patient has taken, and
-- only that: each medicine, its dose, how often, whether it is current,
-- suspended or stopped, and when it started. Nothing else of the medical
-- record.
--
-- Why: Anthony, 2026-11-12: "sometimes when people come, they don't remember
-- their drugs... I want the pharmacist to be able to see somebody's medical
-- records of their medication... the one they have stopped, the one they are
-- currently taking, and the one they suspended... so they can easily
-- dispense." The Pharmacy does not have medical record access, and keeps not
-- having it: this function hands back the medicines list and nothing more.
--
-- Rules:
--   - Only the Pharmacy (the role) may ask. Doctors, nurses and the matron
--     already have the record.
--   - Each ask is written to the activity log (who, which patient, when), as
--     every look at a medical record is (CLAUDE.md section 10).
--   - A removed (voided) line is not shown.
--   - Read only. The Pharmacy still cannot add or change a medicine on the
--     record.
--
-- Never: return a diagnosis, a note, a vital sign, an allergy or anything
-- from the medical record other than the medicines.
-- =============================================================================


-- ===== 1. The Pharmacy's list of a patient's medicines =====
create function private.patient_medicines_for_pharmacy(p_patient bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found jsonb;
begin
  if not (select private.is_pharmacist()) then
    raise exception 'Only the Pharmacy can look at a patient''s medicines here' using errcode = '42501';
  end if;
  if not exists (select 1 from public.patients where id = p_patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;

  -- Written down first: a look at the record is always logged.
  insert into public.activity_log (actor_id, action, table_name, record_id, patient_id)
  values ((select auth.uid()), 'read', 'patient_medications', p_patient::text, p_patient);

  select coalesce(jsonb_agg(row_to_json(line) order by line.rank, line.started desc), '[]'::jsonb)
  into found
  from (
    select
      m.id,
      m.medicine,
      m.dose,
      m.how_often,
      m.status,
      m.created_at as started,
      adder.full_name as added_by,
      last.new_status as last_change,
      last.reason as last_reason,
      last.changed_at as last_changed_at,
      case m.status when 'active' then 0 when 'suspended' then 1 else 2 end as rank
    from public.patient_medications m
    left join public.staff adder on adder.id = m.added_by
    left join lateral (
      select l.new_status, l.reason, l.changed_at
      from public.medication_status_log l
      where l.medication_id = m.id and l.old_status is not null
      order by l.changed_at desc
      limit 1
    ) last on true
    where m.patient_id = p_patient and m.voided_at is null
  ) line;

  return found;
end;
$$;

revoke execute on function private.patient_medicines_for_pharmacy(bigint) from public, anon;
grant  execute on function private.patient_medicines_for_pharmacy(bigint) to authenticated;

create function public.patient_medicines_for_pharmacy(p_patient bigint)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.patient_medicines_for_pharmacy(p_patient); $$;

revoke execute on function public.patient_medicines_for_pharmacy(bigint) from public, anon;
grant  execute on function public.patient_medicines_for_pharmacy(bigint) to authenticated;
