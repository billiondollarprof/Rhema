-- =============================================================================
-- 20261110151018_record_emails.sql
--
-- What this is: a list of every time a medical record was emailed to the
-- patient. One row per send: which patient, who sent it, when.
--
-- Why: Anthony, 2026-11-10: "the nurse should be able to forward medical
-- records to email if the patient's email is included... only with the
-- patient's consent, which means the patient provided their email. Doctors
-- and nurses should be able to as well." CLAUDE.md section 10: every read of
-- a medical record goes in the activity log. A record leaving by email is a
-- read that leaves the building, so it is written down first, and the Worker
-- sends nothing if this row cannot be written.
--
-- Rules:
--   - Only somebody with medical record access, with that patient's record
--     open, adds a row, and only in their own name.
--   - The list can be read by the person who sent, and by admins who may
--     read the logs. It is never changed or deleted.
--   - The row holds the patient's number and the sender, never the address
--     or anything medical. The activity log copy holds the same.
--   - The same send twice within 30 seconds is saved once.
--
-- Never: let somebody add a row for another person, or change one.
-- =============================================================================


-- ===== 1. The table =====

create table public.record_emails (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients (id),
  sent_by     uuid not null default auth.uid() references public.staff (id),
  sent_at     timestamptz not null default now()
);

create index record_emails_patient_idx on public.record_emails (patient_id, sent_at desc);

-- Supabase gives every new table full rights. Take them all away first,
-- then give back only what this table needs.
revoke all on public.record_emails from anon, authenticated;
alter table public.record_emails enable row level security;

grant select, insert on public.record_emails to authenticated;


-- ===== 2. Who can read and write =====

create policy record_emails_read on public.record_emails
  for select to authenticated
  using (sent_by = (select auth.uid()) or (select private.has_permission('logs')));

create policy record_emails_insert on public.record_emails
  for insert to authenticated
  with check (private.can_use_record(patient_id) and sent_by = (select auth.uid()));


-- ===== 3. The double tap guard and the activity log =====

create trigger record_emails_refuse_double
  before insert on public.record_emails
  for each row execute function private.refuse_double('sent_by', 'sent_at');

create trigger record_emails_activity
  after insert on public.record_emails
  for each row execute function private.write_activity();
