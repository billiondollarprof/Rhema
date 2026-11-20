-- =============================================================================
-- Undo 20261119211756_unpaid_expire_after_72_hours.sql: nothing expires any
-- more. Ones that already expired stay cancelled; only the expiry time goes.
-- =============================================================================

drop trigger prescriptions_refuse_expired on public.prescriptions;
drop trigger lab_requests_refuse_expired on public.lab_requests;
drop function private.refuse_expired_prescription();
drop function private.refuse_expired_lab_request();

drop function public.expire_unpaid();
drop function private.expire_unpaid();

drop function private.prescription_due_to_expire(public.prescriptions);
drop function private.lab_request_due_to_expire(public.lab_requests);

alter table public.prescriptions drop column expired_at;
alter table public.lab_requests  drop column expired_at;
