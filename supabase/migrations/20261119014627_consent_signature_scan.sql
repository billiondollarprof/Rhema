-- =============================================================================
-- 20261119014627_consent_signature_scan.sql
--
-- What this is: a consent for an operation can carry the scanned signature
-- (or the signed form), stored as one of the patient's files.
--
-- Why: Anthony, 2026-11-18 (request 227l): the director asked for "a place
-- where they can upload signature, scan a signature and upload... since they
-- don't have electronic signature and they can't use fingerprints". The
-- picture is shrunk on the phone before it is sent (a few kilobytes) and
-- refused above 500 KB.
--
-- Rules:
--   - Optional: a consent without a scan still saves, as before.
--   - The file must be one of the same patient's files; checked here.
--   - Written once, with the consent (no update grant).
--
-- Never: link a consent to another patient's file.
-- =============================================================================


-- ===== 1. The column =====
alter table public.operation_consents
  -- The file key of one of this patient's files; the trigger below checks
  -- it exists and belongs to this patient.
  add column signature_key text;


-- ===== 2. The file must be this patient's =====
create function private.consent_signature_same_patient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.signature_key is not null and not exists (
    select 1 from public.patient_files f
    where f.file_key = new.signature_key and f.patient_id = new.patient_id
  ) then
    raise exception 'The signature must be one of this patient''s files' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.consent_signature_same_patient() from public, anon, authenticated;

create trigger operation_consents_signature_same_patient
  before insert or update on public.operation_consents
  for each row execute function private.consent_signature_same_patient();
