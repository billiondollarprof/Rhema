-- =============================================================================
-- antenatal_booking_and_consent
--
-- What this is: the hospital's antenatal booking card (the P.H.C. data
-- page) in the medical record, an operation consent form for any patient,
-- and the doctor's notice when a prescription has been dispensed.
--   1. antenatal_bookings: one per patient. Extra next of kin details
--      (occupation, religion, level of education, age, tribe), the totals
--      (abortions, miscarriages, total pregnancies, parity), and the consent
--      box "Would you like your delivery to be documented? (photos and
--      video)", with who ticked it and when.
--   2. antenatal_tests: the routine tests (PCV, RVS, blood group, genotype,
--      hepatitis B, hepatitis C, urinalysis, RBS/FBS, H. pylori, PT), each
--      with its result and the date it was done.
--   3. previous_pregnancies: as many as needed: date of birth, duration,
--      birth weight, method of delivery, sex, and if the baby died: age at
--      death, cause, alive or not.
--   4. operation_consents: for any patient. Who gives consent, for which
--      operation, relationship, address, a tick standing for the signature,
--      with the name and the date; and the witness the same way.
--   5. prescriptions.dispense_seen_at: the doctor who prescribed sees a
--      notice when it is dispensed, until they open it.
--
-- Why: Anthony, 2026-11-09, with a photo of the card: "The matron said these
-- information have to be there including the one written at the bottom
-- with pen, for consent." His answers: "yes to all"; "documented means
-- photos and video"; "no signature, you can put a checkbox to serve for the
-- signature, including name and date"; the consent form: "any patient
-- should have one"; religion, tribe and education: "yes". And: "once any
-- request is fulfilled, the doctor gets a notification."
--
-- Rules:
--   - Everything here is part of the medical record: read and written only
--     with the record open (private.can_use_record), and the writer is
--     always the person signed in. Every save is in the activity log.
--   - A consent is never edited after it is saved. A wrong one is voided
--     with a reason, and a new one is saved.
--   - A test, a pregnancy or a consent saved twice by a double tap is saved
--     once (private.refuse_double, 30 seconds).
--
-- Never: let anybody without the record open read or write any of it.
-- =============================================================================

-- ===== 1. The booking: one per patient =====
create table public.antenatal_bookings (
  patient_id          bigint primary key references public.patients (id),
  kin_occupation      text check (kin_occupation is null or length(kin_occupation) <= 80),
  kin_religion        text check (kin_religion is null or length(kin_religion) <= 60),
  kin_education       text check (kin_education is null or length(kin_education) <= 80),
  kin_age             smallint check (kin_age between 0 and 120),
  kin_tribe           text check (kin_tribe is null or length(kin_tribe) <= 60),
  abortions           smallint check (abortions between 0 and 30),
  miscarriages        smallint check (miscarriages between 0 and 30),
  total_pregnancies   smallint check (total_pregnancies between 0 and 30),
  parity              text check (parity is null or length(parity) <= 30),
  -- Null: not asked yet. True or false: her answer.
  documented_delivery boolean,
  documented_answered_by uuid references public.staff (id),
  documented_answered_at timestamptz,
  updated_by          uuid not null default auth.uid() references public.staff (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ===== 2. The routine tests =====
create table public.antenatal_tests (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients (id),
  test        text not null check (test in (
                'pcv', 'rvs', 'blood_group', 'genotype', 'hepatitis_b', 'hepatitis_c',
                'urinalysis', 'rbs_fbs', 'h_pylori', 'pt')),
  result      text not null check (length(trim(result)) between 1 and 200),
  tested_on   date check (tested_on <= current_date),
  recorded_by uuid not null default auth.uid() references public.staff (id),
  created_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references public.staff (id),
  void_reason text,
  constraint antenatal_tests_void_needs_reason
    check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);
create index antenatal_tests_patient_idx on public.antenatal_tests (patient_id);

-- ===== 3. Previous pregnancies =====
create table public.previous_pregnancies (
  id               bigint generated always as identity primary key,
  patient_id       bigint not null references public.patients (id),
  born_on          date check (born_on <= current_date),
  duration         text check (duration is null or length(duration) <= 40),
  birth_weight     text check (birth_weight is null or length(birth_weight) <= 20),
  delivery_method  text check (delivery_method is null or length(delivery_method) <= 60),
  baby_sex         text check (baby_sex in ('female', 'male')),
  baby_died        boolean not null default false,
  age_at_death     text check (age_at_death is null or length(age_at_death) <= 60),
  cause_of_death   text check (cause_of_death is null or length(cause_of_death) <= 200),
  recorded_by      uuid not null default auth.uid() references public.staff (id),
  created_at       timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references public.staff (id),
  void_reason      text,
  constraint previous_pregnancies_void_needs_reason
    check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);
create index previous_pregnancies_patient_idx on public.previous_pregnancies (patient_id);

-- ===== 4. Consent for an operation (any patient) =====
create table public.operation_consents (
  id               bigint generated always as identity primary key,
  patient_id       bigint not null references public.patients (id),
  consenting_name  text not null check (length(trim(consenting_name)) between 2 and 120),
  operation        text not null check (length(trim(operation)) between 2 and 200),
  relationship     text check (relationship is null or length(relationship) <= 60),
  address          text check (address is null or length(address) <= 300),
  -- The tick stands for the signature (his word): it must be ticked.
  consent_ticked   boolean not null check (consent_ticked),
  consented_on     date not null check (consented_on <= current_date),
  witness_name     text check (witness_name is null or length(trim(witness_name)) between 2 and 120),
  witness_ticked   boolean not null default false,
  witnessed_on     date check (witnessed_on <= current_date),
  recorded_by      uuid not null default auth.uid() references public.staff (id),
  created_at       timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references public.staff (id),
  void_reason      text,
  constraint operation_consents_witness_complete
    check (witness_name is null or (witness_ticked and witnessed_on is not null)),
  constraint operation_consents_void_needs_reason
    check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);
create index operation_consents_patient_idx on public.operation_consents (patient_id);

-- ===== 5. Who may read and write: the record rules =====
revoke all on public.antenatal_bookings, public.antenatal_tests,
  public.previous_pregnancies, public.operation_consents from anon, authenticated;
alter table public.antenatal_bookings   enable row level security;
alter table public.antenatal_tests      enable row level security;
alter table public.previous_pregnancies enable row level security;
alter table public.operation_consents   enable row level security;

grant select, insert on public.antenatal_bookings to authenticated;
grant update (kin_occupation, kin_religion, kin_education, kin_age, kin_tribe, abortions,
  miscarriages, total_pregnancies, parity, documented_delivery, documented_answered_by,
  documented_answered_at, updated_by) on public.antenatal_bookings to authenticated;
grant select, insert on public.antenatal_tests, public.previous_pregnancies,
  public.operation_consents to authenticated;
grant update (voided_at, voided_by, void_reason) on public.antenatal_tests,
  public.previous_pregnancies, public.operation_consents to authenticated;

create policy bookings_read on public.antenatal_bookings for select to authenticated
  using (private.can_use_record(patient_id));
create policy bookings_insert on public.antenatal_bookings for insert to authenticated
  with check (private.can_use_record(patient_id) and updated_by = (select auth.uid()));
create policy bookings_update on public.antenatal_bookings for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and updated_by = (select auth.uid()));

create policy tests_read on public.antenatal_tests for select to authenticated
  using (private.can_use_record(patient_id));
create policy tests_insert on public.antenatal_tests for insert to authenticated
  with check (private.can_use_record(patient_id) and recorded_by = (select auth.uid()));
create policy tests_update on public.antenatal_tests for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and voided_by = (select auth.uid()));

create policy pregnancies_read on public.previous_pregnancies for select to authenticated
  using (private.can_use_record(patient_id));
create policy pregnancies_insert on public.previous_pregnancies for insert to authenticated
  with check (private.can_use_record(patient_id) and recorded_by = (select auth.uid()));
create policy pregnancies_update on public.previous_pregnancies for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and voided_by = (select auth.uid()));

create policy consents_read on public.operation_consents for select to authenticated
  using (private.can_use_record(patient_id));
create policy consents_insert on public.operation_consents for insert to authenticated
  with check (private.can_use_record(patient_id) and recorded_by = (select auth.uid()));
create policy consents_update on public.operation_consents for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and voided_by = (select auth.uid()));

-- ===== 6. Times, the activity log, and the double tap guard =====
create trigger antenatal_bookings_touch before update on public.antenatal_bookings
  for each row execute function private.touch_updated_at();
create trigger antenatal_bookings_activity after insert or update on public.antenatal_bookings
  for each row execute function private.write_activity();
create trigger antenatal_tests_activity after insert or update on public.antenatal_tests
  for each row execute function private.write_activity();
create trigger previous_pregnancies_activity after insert or update on public.previous_pregnancies
  for each row execute function private.write_activity();
create trigger operation_consents_activity after insert or update on public.operation_consents
  for each row execute function private.write_activity();

create trigger antenatal_tests_refuse_double before insert on public.antenatal_tests
  for each row execute function private.refuse_double('recorded_by', 'created_at');
create trigger previous_pregnancies_refuse_double before insert on public.previous_pregnancies
  for each row execute function private.refuse_double('recorded_by', 'created_at');
create trigger operation_consents_refuse_double before insert on public.operation_consents
  for each row execute function private.refuse_double('recorded_by', 'created_at');

-- ===== 7. The doctor is told when a prescription is dispensed =====
alter table public.prescriptions add column dispense_seen_at timestamptz;

-- Marks one dispensed prescription seen, only by the doctor who wrote it.
create function private.mark_dispense_seen(prescription bigint)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with seen as (
    update public.prescriptions
       set dispense_seen_at = now()
     where id = prescription
       and prescribed_by = (select auth.uid())
       and status = 'dispensed'
       and dispense_seen_at is null
    returning 1
  )
  select exists (select 1 from seen);
$$;

create function public.mark_dispense_seen(prescription bigint)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.mark_dispense_seen(prescription) $$;

revoke execute on function private.mark_dispense_seen(bigint) from public, anon;
revoke execute on function public.mark_dispense_seen(bigint)  from public, anon;
grant  execute on function private.mark_dispense_seen(bigint) to authenticated;
grant  execute on function public.mark_dispense_seen(bigint)  to authenticated;
