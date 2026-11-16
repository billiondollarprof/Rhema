-- =============================================================================
-- 20261116051615_antenatal_visits_and_client.sql
--
-- What this is: the rest of the hospital's antenatal card.
--   1. The visit table ("Anti-natal record"): one row per visit, with the
--      palpation (height of fundus, presentation and position, foetal heart
--      rate), urine, blood pressure, pulse, breathing, weight, Hb, oedema, the
--      drugs given, a remark, who examined her (the person signed in) and when
--      she comes back.
--   2. On the booking: the woman's own marital status, religion, education,
--      occupation and tribe; the medical history ticklist (asked, and which
--      ones were yes); and her surgical history.
--
-- Why: Anthony, 2026-11-16, with photos of the card from the midwife
-- (Consultant Room 2): "they do palpation... height of fundus... we need to add
-- columns for the palpation... check if we already have those data." Most of
-- the card was built on 2026-11-09 (request 170); these parts were missing.
-- And: "limit the typing to the bare minimum", so most of these are picked.
--
-- Rules: the same as the rest of the antenatal card. Only staff with medical
-- record access who have the record open read or write; the writer is always
-- the person signed in; a wrong visit is voided with a reason, never deleted;
-- every write is logged; a double tap saves once.
--
-- Never: let a visit be written in another person's name, or be deleted.
-- =============================================================================


-- ===== 1. The woman's own details and her histories, on the booking =====
alter table public.antenatal_bookings
  add column client_marital_status text check (client_marital_status in ('Single', 'Married', 'Divorced', 'Widowed', 'Separated')),
  add column client_religion  text check (client_religion is null or length(client_religion) <= 60),
  add column client_education text check (client_education is null or length(client_education) <= 80),
  add column client_occupation text check (client_occupation is null or length(client_occupation) <= 80),
  add column client_tribe     text check (client_tribe is null or length(client_tribe) <= 60),
  -- The medical history ticklist: was it asked, and which ones were yes.
  add column history_asked    boolean not null default false,
  add column history_yes      text[] not null default '{}' check (cardinality(history_yes) <= 20),
  add column surgery_type     text check (surgery_type is null or length(surgery_type) <= 120),
  add column surgery_reason   text check (surgery_reason is null or length(surgery_reason) <= 300);

grant update (client_marital_status, client_religion, client_education, client_occupation,
  client_tribe, history_asked, history_yes, surgery_type, surgery_reason)
  on public.antenatal_bookings to authenticated;


-- ===== 2. The visit table =====
create table public.antenatal_visits (
  id              bigint generated always as identity primary key,
  patient_id      bigint not null references public.patients (id),
  visit_on        date not null default current_date check (visit_on <= current_date),
  -- Palpation.
  fundal_height   smallint check (fundal_height between 8 and 45),
  presentation    text check (presentation in ('Cephalic', 'Breech', 'Transverse', 'Oblique', 'Not yet palpable')),
  position        text check (position in ('LOA', 'ROA', 'LOT', 'ROT', 'LOP', 'ROP', 'Not determined')),
  foetal_heart    smallint check (foetal_heart between 60 and 220),
  -- Urine, as the dipstick reads.
  urine_protein   text check (urine_protein in ('Nil', 'Trace', '+', '++', '+++')),
  urine_sugar     text check (urine_sugar in ('Nil', 'Trace', '+', '++', '+++')),
  systolic        smallint check (systolic between 40 and 300),
  diastolic       smallint check (diastolic between 20 and 200),
  pulse           smallint check (pulse between 20 and 260),
  respiration     smallint check (respiration between 4 and 80),
  weight_kg       numeric(5,1) check (weight_kg between 20 and 250),
  hb              numeric(4,1) check (hb between 2 and 25),
  oedema          text check (oedema in ('Nil', '+', '++', '+++')),
  drugs_given     text[] not null default '{}' check (cardinality(drugs_given) <= 20),
  remark          text check (remark is null or length(remark) <= 300),
  return_on       date,
  recorded_by     uuid not null default auth.uid() references public.staff (id),
  created_at      timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references public.staff (id),
  void_reason     text,
  constraint antenatal_visits_return_after check (return_on is null or return_on >= visit_on),
  constraint antenatal_visits_not_empty check (num_nonnulls(fundal_height, presentation, position,
    foetal_heart, urine_protein, urine_sugar, systolic, diastolic, pulse, respiration, weight_kg, hb,
    oedema, remark, return_on) > 0 or cardinality(drugs_given) > 0),
  constraint antenatal_visits_void_needs_reason
    check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);

create index antenatal_visits_patient_idx on public.antenatal_visits (patient_id, visit_on desc);
create index antenatal_visits_by_idx      on public.antenatal_visits (recorded_by);
create index antenatal_visits_voided_idx  on public.antenatal_visits (voided_by);

revoke all on public.antenatal_visits from anon, authenticated;
alter table public.antenatal_visits enable row level security;

grant select, insert on public.antenatal_visits to authenticated;
grant update (voided_at, voided_by, void_reason) on public.antenatal_visits to authenticated;

create policy antenatal_visits_read on public.antenatal_visits for select to authenticated
  using (private.can_use_record(patient_id));
create policy antenatal_visits_insert on public.antenatal_visits for insert to authenticated
  with check (private.can_use_record(patient_id) and recorded_by = (select auth.uid()));
create policy antenatal_visits_update on public.antenatal_visits for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and voided_by = (select auth.uid()));

create trigger antenatal_visits_activity after insert or update on public.antenatal_visits
  for each row execute function private.write_activity();
create trigger antenatal_visits_refuse_double before insert on public.antenatal_visits
  for each row execute function private.refuse_double('recorded_by', 'created_at');
