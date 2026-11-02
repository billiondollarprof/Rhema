-- =============================================================================
-- double_tap_guards: the same thing saved twice by a double tap, a slow
-- network retry or two taps at once is saved once (request 131).
--
-- Why: Anthony, 2026-11-02: "Remember Idempotency checks in all actions
-- that might cause a duplicate of exact results." CLAUDE.md section 10:
-- "A double action is stopped in the database... 30 seconds by default."
-- Payments, lab, prescriptions, files, invites and calls already have their
-- own guards. These tables did not: registering a patient, and every entry
-- in the medical record.
--
-- How: before a new row is saved, the database asks "has this same person
-- saved exactly this, for this patient, in the last 30 seconds?" Exactly
-- this means every column the same, apart from the row's number and its
-- times. A lock makes two taps at the same moment take turns.
--   - A record entry (note, reading, allergy, dose...): the second one is
--     quietly not saved. The screen reloads and shows one.
--   - A patient: the second is refused with "already registered", and the
--     screen shows the patient the first tap saved.
--
-- Not guarded on purpose: the medicine status log (suspend, resume, stop),
-- because a real suspend, resume and suspend inside 30 seconds must keep
-- every line; the status change itself cannot double.
--
-- Never: refuse something that differs in any way. Two different readings
-- a minute apart, or the same note by two people, are both kept.
-- =============================================================================


-- ===== 1. The shared guard =====
-- Trigger arguments: the column naming who saved it, the column of when.

create function private.refuse_double()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_column text := tg_argv[0];
  time_column   text := tg_argv[1];
  author        text := to_jsonb(new) ->> author_column;
  -- The row's number, its times, and the patient number (given by the
  -- database, different every time) never make two saves different.
  volatile      text[] := array['id', 'created_at', 'updated_at', 'recorded_at', 'given_at', 'changed_at', 'patient_number'];
  this_row      jsonb := to_jsonb(new) - volatile;
  seen          boolean;
begin
  if author is null then
    return new;
  end if;
  -- Two taps at the same moment wait here for each other.
  perform pg_advisory_xact_lock(hashtext('double:' || tg_table_name || ':' || author || ':' || md5(this_row::text)));
  execute format(
    'select exists (select 1 from %I.%I t where t.%I::text = $1 and t.%I > now() - interval ''30 seconds'' and (to_jsonb(t) - $3) = $2)',
    tg_table_schema, tg_table_name, author_column, time_column
  ) into seen using author, this_row, volatile;
  if not seen then
    return new;
  end if;
  if tg_table_name = 'patients' then
    raise exception 'already registered' using errcode = '23505';
  end if;
  -- A record entry: quietly not saved a second time.
  return null;
end;
$$;

revoke execute on function private.refuse_double() from public, anon, authenticated;


-- ===== 2. Where it guards =====

-- Named to run before patients_protect_number (triggers run in name order),
-- so a refused double tap never uses up a patient number.
create trigger patients_check_double
  before insert on public.patients
  for each row execute function private.refuse_double('created_by', 'created_at');

create trigger allergies_refuse_double
  before insert on public.allergies
  for each row execute function private.refuse_double('recorded_by', 'created_at');

create trigger conditions_refuse_double
  before insert on public.conditions
  for each row execute function private.refuse_double('recorded_by', 'created_at');

create trigger patient_medications_refuse_double
  before insert on public.patient_medications
  for each row execute function private.refuse_double('added_by', 'created_at');

create trigger medications_given_refuse_double
  before insert on public.medications_given
  for each row execute function private.refuse_double('given_by', 'created_at');

create trigger vital_signs_refuse_double
  before insert on public.vital_signs
  for each row execute function private.refuse_double('recorded_by', 'recorded_at');

create trigger nursing_notes_refuse_double
  before insert on public.nursing_notes
  for each row execute function private.refuse_double('written_by', 'created_at');

create trigger consultation_notes_refuse_double
  before insert on public.consultation_notes
  for each row execute function private.refuse_double('written_by', 'created_at');
