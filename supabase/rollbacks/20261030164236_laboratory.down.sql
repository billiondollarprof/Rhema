-- =============================================================================
-- Undo for 20261030164236_laboratory.sql
--
-- Removes the Laboratory and the payments table: the functions, the alert,
-- the three tables and their lists of choices.
--
-- On the live database this loses every lab request, every result and every
-- payment recorded, so it needs Anthony's explicit yes in writing.
-- =============================================================================

drop function if exists public.mark_lab_result_seen(bigint);
drop function if exists public.record_lab_results(bigint, bigint, jsonb);
drop function if exists public.pay_lab_request(bigint, numeric, public.payment_mode);
drop function if exists public.request_lab(bigint, text[], text, text);

drop trigger if exists lab_requests_push on public.lab_requests;
drop function if exists private.push_lab_result();
drop function if exists private.mark_lab_result_seen(bigint);
drop function if exists private.record_lab_results(bigint, bigint, jsonb);
drop function if exists private.pay_lab_request(bigint, numeric, public.payment_mode);
drop function if exists private.request_lab(bigint, text[], text, text);

drop table if exists public.lab_results;
drop table if exists public.lab_requests;
drop table if exists public.payments;
drop function if exists private.can_take_payment();

drop type if exists public.lab_status;
drop type if exists public.payment_mode;
drop type if exists public.payment_purpose;
