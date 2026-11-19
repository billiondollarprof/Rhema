-- =============================================================================
-- Undo 20261119014627_consent_signature_scan.sql: the consent no longer
-- points at its scanned signature. The files themselves stay with the
-- patient. WARNING: which file belonged to which consent is lost.
-- =============================================================================

drop trigger if exists operation_consents_signature_same_patient on public.operation_consents;
drop function if exists private.consent_signature_same_patient();
alter table public.operation_consents drop column if exists signature_key;
