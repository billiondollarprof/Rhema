-- =============================================================================
-- 20261029160000_medical_record.sql
--
-- What this is: the medical record. Seven parts:
--   record_openings          who opened which patient's record, and when
--   medical_profiles         blood group, genotype, "no known allergies",
--                            last menstrual period, gravida and para
--   allergies                one row per allergy
--   conditions               a condition, active or resolved
--   patient_medications      what the patient is on, and its status:
--                            active (green), suspended (orange), stopped (red)
--   medication_status_log    every change of that status: who, when, why
--   medications_given        each dose given: the medicine, the dose, the
--                            exact time given, and who gave it
--   vital_signs              blood pressure, pulse, temperature, breathing,
--                            oxygen, weight, height
--   nursing_notes            a nurse's comment or report
--   consultation_notes       the doctor's notes: complaint, findings,
--                            assessment, plan
--
-- Why: docs/DATABASE.md sections 7 and 8, the hospital's note, and Anthony,
-- 2026-10-29: nurses "can suspend a particular drug, they can stop giving
-- somebody a particular medication... suspended... orange... stopped
-- permanently... red... still giving it... green".
--
-- The rules, enforced here in the database, not in the screens:
--   1. Only staff with the medical record permission (doctors, nurses, the
--      matron, the admin) can read or write any of it.
--   2. Opening a record is logged FIRST. A person can only read or write a
--      patient's record if they opened it in the last 12 hours, so the log
--      can never be skipped. The admin's activity log shows every opening.
--   3. Nothing clinical is ever deleted. A mistake is voided with a reason
--      and stays visible as voided.
--   4. Every write goes in the activity log (field names only, never values).
--   5. A medicine's status changes only forward through the log: the old
--      line is never rewritten. Stopped is final; a stopped medicine is
--      prescribed again as a new line.
--
-- Never: let the front desk, the lab or the pharmacy read these tables. They
-- have their own narrow views, built with their modules.
-- =============================================================================


-- ===== 1. Fixed lists =====

create type public.medication_status as enum ('active', 'suspended', 'stopped');
create type public.condition_status  as enum ('active', 'resolved');


-- ===== 2. Opening a record, and the 12 hour rule =====

create table public.record_openings (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients (id),
  staff_id    uuid not null default auth.uid() references public.staff (id),
  opened_at   timestamptz not null default now()
);

create index record_openings_lookup_idx on public.record_openings (staff_id, patient_id, opened_at desc);
create index record_openings_patient_idx on public.record_openings (patient_id);

-- "Has this person opened this patient's record in the last 12 hours, and
-- may they see medical records at all?" Every record table's rules ask this.
create function private.can_use_record(patient bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('medical') and exists (
    select 1 from public.record_openings
    where staff_id = (select auth.uid())
      and patient_id = patient
      and opened_at > now() - interval '12 hours'
  );
$$;

revoke execute on function private.can_use_record(bigint) from public, anon;
grant  execute on function private.can_use_record(bigint) to authenticated;


-- ===== 3. The record tables =====

create table public.medical_profiles (
  patient_id          bigint primary key references public.patients (id),
  blood_group         text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  genotype            text check (genotype in ('AA','AS','SS','AC','SC','CC')),
  no_known_allergies  boolean not null default false,
  last_menstrual_period date check (last_menstrual_period <= current_date),
  gravida             smallint check (gravida between 0 and 30),
  para                smallint check (para between 0 and 30),
  updated_by          uuid not null default auth.uid() references public.staff (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.allergies (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients (id),
  allergen    text not null check (length(trim(allergen)) between 2 and 120),
  reaction    text check (reaction is null or length(reaction) <= 300),
  severe      boolean not null default false,
  recorded_by uuid not null default auth.uid() references public.staff (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references public.staff (id),
  void_reason text,
  constraint allergies_void_needs_reason check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);

create table public.conditions (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients (id),
  name        text not null check (length(trim(name)) between 2 and 160),
  status      public.condition_status not null default 'active',
  recorded_by uuid not null default auth.uid() references public.staff (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references public.staff (id),
  void_reason text,
  constraint conditions_void_needs_reason check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);

create table public.patient_medications (
  id            bigint generated always as identity primary key,
  patient_id    bigint not null references public.patients (id),
  medicine      text not null check (length(trim(medicine)) between 2 and 160),
  dose          text check (dose is null or length(dose) <= 120),
  how_often     text check (how_often is null or length(how_often) <= 120),
  status        public.medication_status not null default 'active',
  added_by      uuid not null default auth.uid() references public.staff (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  voided_at     timestamptz,
  voided_by     uuid references public.staff (id),
  void_reason   text,
  constraint medications_void_needs_reason check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);

create table public.medication_status_log (
  id             bigint generated always as identity primary key,
  medication_id  bigint not null references public.patient_medications (id),
  patient_id     bigint not null references public.patients (id),
  old_status     public.medication_status,
  new_status     public.medication_status not null,
  reason         text check (reason is null or length(reason) <= 300),
  changed_by     uuid not null default auth.uid() references public.staff (id),
  changed_at     timestamptz not null default now()
);

create table public.medications_given (
  id             bigint generated always as identity primary key,
  patient_id     bigint not null references public.patients (id),
  medication_id  bigint references public.patient_medications (id),
  medicine       text not null check (length(trim(medicine)) between 2 and 160),
  dose           text check (dose is null or length(dose) <= 120),
  -- The exact time the dose was given. Defaults to now, and can be set to
  -- the real time if it is written down a little later (never the future).
  given_at       timestamptz not null default now() check (given_at <= now() + interval '5 minutes'),
  given_by       uuid not null default auth.uid() references public.staff (id),
  note           text check (note is null or length(note) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  voided_at      timestamptz,
  voided_by      uuid references public.staff (id),
  void_reason    text,
  constraint given_void_needs_reason check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);

create table public.vital_signs (
  id             bigint generated always as identity primary key,
  patient_id     bigint not null references public.patients (id),
  systolic       smallint check (systolic between 40 and 300),
  diastolic      smallint check (diastolic between 20 and 200),
  pulse          smallint check (pulse between 20 and 260),
  temperature_c  numeric(4,1) check (temperature_c between 30 and 45),
  breathing_rate smallint check (breathing_rate between 4 and 80),
  spo2           smallint check (spo2 between 50 and 100),
  weight_kg      numeric(5,1) check (weight_kg between 0.3 and 400),
  height_cm      numeric(5,1) check (height_cm between 20 and 260),
  recorded_by    uuid not null default auth.uid() references public.staff (id),
  recorded_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  voided_at      timestamptz,
  voided_by      uuid references public.staff (id),
  void_reason    text,
  constraint vitals_void_needs_reason check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0),
  constraint vitals_not_empty check (num_nonnulls(systolic, diastolic, pulse, temperature_c,
    breathing_rate, spo2, weight_kg, height_cm) > 0)
);

create table public.nursing_notes (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients (id),
  note        text not null check (length(trim(note)) between 1 and 4000),
  written_by  uuid not null default auth.uid() references public.staff (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references public.staff (id),
  void_reason text,
  constraint nursing_void_needs_reason check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);

create table public.consultation_notes (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients (id),
  complaint   text check (complaint is null or length(complaint) <= 4000),
  findings    text check (findings is null or length(findings) <= 4000),
  assessment  text check (assessment is null or length(assessment) <= 4000),
  plan        text check (plan is null or length(plan) <= 4000),
  written_by  uuid not null default auth.uid() references public.staff (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references public.staff (id),
  void_reason text,
  constraint consultation_void_needs_reason check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0),
  constraint consultation_not_empty check (num_nonnulls(complaint, findings, assessment, plan) > 0)
);

-- Look ups by patient, newest first.
create index allergies_patient_idx    on public.allergies (patient_id);
create index conditions_patient_idx   on public.conditions (patient_id);
create index medications_patient_idx  on public.patient_medications (patient_id);
create index med_log_medication_idx   on public.medication_status_log (medication_id);
create index med_log_patient_idx      on public.medication_status_log (patient_id);
create index given_patient_idx        on public.medications_given (patient_id, given_at desc);
create index given_medication_idx     on public.medications_given (medication_id);
create index vitals_patient_idx       on public.vital_signs (patient_id, recorded_at desc);
create index nursing_patient_idx      on public.nursing_notes (patient_id, created_at desc);
create index consultation_patient_idx on public.consultation_notes (patient_id, created_at desc);
-- Indexes on every "who" column, so the staff table's look ups stay fast.
create index record_openings_staff_idx  on public.record_openings (staff_id);
create index profiles_updated_by_idx    on public.medical_profiles (updated_by);
create index allergies_by_idx           on public.allergies (recorded_by);
create index allergies_voided_by_idx    on public.allergies (voided_by);
create index conditions_by_idx          on public.conditions (recorded_by);
create index conditions_voided_by_idx   on public.conditions (voided_by);
create index medications_by_idx         on public.patient_medications (added_by);
create index medications_voided_by_idx  on public.patient_medications (voided_by);
create index med_log_by_idx             on public.medication_status_log (changed_by);
create index given_by_idx               on public.medications_given (given_by);
create index given_voided_by_idx        on public.medications_given (voided_by);
create index vitals_by_idx              on public.vital_signs (recorded_by);
create index vitals_voided_by_idx       on public.vital_signs (voided_by);
create index nursing_by_idx             on public.nursing_notes (written_by);
create index nursing_voided_by_idx      on public.nursing_notes (voided_by);
create index consultation_by_idx        on public.consultation_notes (written_by);
create index consultation_voided_by_idx on public.consultation_notes (voided_by);


-- ===== 4. Medication status: every change goes in the log =====
-- Stopped is final. Suspended can go back to active. Each change writes one
-- line to medication_status_log with who, when, and the reason given.

create function private.log_medication_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.medication_status_log (medication_id, patient_id, old_status, new_status, changed_by)
    values (new.id, new.patient_id, null, new.status, (select auth.uid()));
  elsif new.status is distinct from old.status then
    if old.status = 'stopped' then
      raise exception 'A stopped medicine cannot be restarted. Add it again as a new medicine.';
    end if;
    insert into public.medication_status_log (medication_id, patient_id, old_status, new_status, reason, changed_by)
    values (new.id, new.patient_id, old.status, new.status,
            nullif(current_setting('rhema.status_reason', true), ''), (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke execute on function private.log_medication_status() from public, anon, authenticated;

create trigger medications_status_log after insert or update on public.patient_medications
  for each row execute function private.log_medication_status();

-- The screen calls this to change a status with a reason, in one step.
create function public.change_medication_status(medication bigint, status public.medication_status, reason text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform set_config('rhema.status_reason', coalesce(reason, ''), true);
  update public.patient_medications set status = change_medication_status.status where id = medication;
  if not found then
    raise exception 'That medicine was not found, or this record is not open';
  end if;
end;
$$;

revoke execute on function public.change_medication_status(bigint, public.medication_status, text) from public, anon;
grant  execute on function public.change_medication_status(bigint, public.medication_status, text) to authenticated;


-- ===== 5. Opening a record (the screen calls this first) =====

create function public.open_record(patient bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.record_openings (patient_id) values (patient);
$$;

revoke execute on function public.open_record(bigint) from public, anon;
grant  execute on function public.open_record(bigint) to authenticated;


-- ===== 6. Times and the activity log =====

create trigger profiles_touch     before update on public.medical_profiles    for each row execute function private.touch_updated_at();
create trigger allergies_touch    before update on public.allergies           for each row execute function private.touch_updated_at();
create trigger conditions_touch   before update on public.conditions          for each row execute function private.touch_updated_at();
create trigger medications_touch  before update on public.patient_medications for each row execute function private.touch_updated_at();
create trigger given_touch        before update on public.medications_given   for each row execute function private.touch_updated_at();
create trigger vitals_touch       before update on public.vital_signs         for each row execute function private.touch_updated_at();
create trigger nursing_touch      before update on public.nursing_notes       for each row execute function private.touch_updated_at();
create trigger consultation_touch before update on public.consultation_notes  for each row execute function private.touch_updated_at();

create trigger openings_activity     after insert on public.record_openings                for each row execute function private.write_activity();
create trigger profiles_activity     after insert or update on public.medical_profiles    for each row execute function private.write_activity();
create trigger allergies_activity    after insert or update on public.allergies           for each row execute function private.write_activity();
create trigger conditions_activity   after insert or update on public.conditions          for each row execute function private.write_activity();
create trigger medications_activity  after insert or update on public.patient_medications for each row execute function private.write_activity();
create trigger given_activity        after insert or update on public.medications_given   for each row execute function private.write_activity();
create trigger vitals_activity       after insert or update on public.vital_signs         for each row execute function private.write_activity();
create trigger nursing_activity      after insert or update on public.nursing_notes       for each row execute function private.write_activity();
create trigger consultation_activity after insert or update on public.consultation_notes  for each row execute function private.write_activity();


-- ===== 7. Grants: what can be done at all =====
-- No delete anywhere. Writers' names and times can never be changed. Only
-- the voiding columns (and a few named fields) can be updated.

revoke all on public.record_openings, public.medical_profiles, public.allergies, public.conditions,
  public.patient_medications, public.medication_status_log, public.medications_given,
  public.vital_signs, public.nursing_notes, public.consultation_notes
  from anon, authenticated;

grant select, insert on public.record_openings to authenticated;

grant select, insert on public.medical_profiles to authenticated;
grant update (blood_group, genotype, no_known_allergies, last_menstrual_period, gravida, para, updated_by)
  on public.medical_profiles to authenticated;

grant select, insert on public.allergies to authenticated;
grant update (voided_at, voided_by, void_reason) on public.allergies to authenticated;

grant select, insert on public.conditions to authenticated;
grant update (status, voided_at, voided_by, void_reason) on public.conditions to authenticated;

grant select, insert on public.patient_medications to authenticated;
grant update (status, voided_at, voided_by, void_reason) on public.patient_medications to authenticated;

-- The status log is written only by its trigger, never by hand.
grant select on public.medication_status_log to authenticated;

grant select, insert on public.medications_given to authenticated;
grant update (voided_at, voided_by, void_reason) on public.medications_given to authenticated;

grant select, insert on public.vital_signs to authenticated;
grant update (voided_at, voided_by, void_reason) on public.vital_signs to authenticated;

grant select, insert on public.nursing_notes to authenticated;
grant update (voided_at, voided_by, void_reason) on public.nursing_notes to authenticated;

grant select, insert on public.consultation_notes to authenticated;
grant update (voided_at, voided_by, void_reason) on public.consultation_notes to authenticated;


-- ===== 8. RLS: which rows =====

alter table public.record_openings       enable row level security;
alter table public.medical_profiles      enable row level security;
alter table public.allergies             enable row level security;
alter table public.conditions            enable row level security;
alter table public.patient_medications   enable row level security;
alter table public.medication_status_log enable row level security;
alter table public.medications_given     enable row level security;
alter table public.vital_signs           enable row level security;
alter table public.nursing_notes         enable row level security;
alter table public.consultation_notes    enable row level security;

-- Openings: anyone with the medical permission records their own opening
-- and sees their own; the log permission (admin) sees all of them.
create policy openings_insert on public.record_openings
  for insert to authenticated
  with check ((select private.has_permission('medical')) and staff_id = (select auth.uid()));
create policy openings_read on public.record_openings
  for select to authenticated
  using (staff_id = (select auth.uid()) or (select private.has_permission('logs')));

-- The same three rules for every record table: read if the record is open;
-- add if it is open and you are the writer; update (void, status) if open.
create policy profiles_read   on public.medical_profiles for select to authenticated using (private.can_use_record(patient_id));
create policy profiles_insert on public.medical_profiles for insert to authenticated
  with check (private.can_use_record(patient_id) and updated_by = (select auth.uid()));
create policy profiles_update on public.medical_profiles for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and updated_by = (select auth.uid()));

create policy allergies_read   on public.allergies for select to authenticated using (private.can_use_record(patient_id));
create policy allergies_insert on public.allergies for insert to authenticated
  with check (private.can_use_record(patient_id) and recorded_by = (select auth.uid()));
create policy allergies_update on public.allergies for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and (voided_by is null or voided_by = (select auth.uid())));

create policy conditions_read   on public.conditions for select to authenticated using (private.can_use_record(patient_id));
create policy conditions_insert on public.conditions for insert to authenticated
  with check (private.can_use_record(patient_id) and recorded_by = (select auth.uid()));
create policy conditions_update on public.conditions for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and (voided_by is null or voided_by = (select auth.uid())));

create policy medications_read   on public.patient_medications for select to authenticated using (private.can_use_record(patient_id));
create policy medications_insert on public.patient_medications for insert to authenticated
  with check (private.can_use_record(patient_id) and added_by = (select auth.uid()));
create policy medications_update on public.patient_medications for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and (voided_by is null or voided_by = (select auth.uid())));

create policy med_log_read on public.medication_status_log for select to authenticated using (private.can_use_record(patient_id));

create policy given_read   on public.medications_given for select to authenticated using (private.can_use_record(patient_id));
create policy given_insert on public.medications_given for insert to authenticated
  with check (private.can_use_record(patient_id) and given_by = (select auth.uid()));
create policy given_update on public.medications_given for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and (voided_by is null or voided_by = (select auth.uid())));

create policy vitals_read   on public.vital_signs for select to authenticated using (private.can_use_record(patient_id));
create policy vitals_insert on public.vital_signs for insert to authenticated
  with check (private.can_use_record(patient_id) and recorded_by = (select auth.uid()));
create policy vitals_update on public.vital_signs for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and (voided_by is null or voided_by = (select auth.uid())));

create policy nursing_read   on public.nursing_notes for select to authenticated using (private.can_use_record(patient_id));
create policy nursing_insert on public.nursing_notes for insert to authenticated
  with check (private.can_use_record(patient_id) and written_by = (select auth.uid()));
create policy nursing_update on public.nursing_notes for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and (voided_by is null or voided_by = (select auth.uid())));

create policy consultation_read   on public.consultation_notes for select to authenticated using (private.can_use_record(patient_id));
create policy consultation_insert on public.consultation_notes for insert to authenticated
  with check (private.can_use_record(patient_id) and written_by = (select auth.uid()));
create policy consultation_update on public.consultation_notes for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and (voided_by is null or voided_by = (select auth.uid())));


-- ===== 9. Fix: the patients table's "a void needs a reason" rule =====
-- Found by test 8 of this file on 2026-10-29. The foundation wrote the rule
-- as length(trim(void_reason)) > 0, which lets an EMPTY reason through:
-- when the reason is missing, the length is unknown, and the database only
-- refuses a rule that is false, not one that is unknown. Same rule, fixed.
alter table public.patients drop constraint void_needs_reason;
alter table public.patients add constraint void_needs_reason
  check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0);
