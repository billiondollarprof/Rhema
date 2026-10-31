-- =============================================================================
-- Undo for 20261031151251_pharmacy.sql
--
-- Removes the Pharmacy and the per line prices: the functions, the three
-- tables and the list of prescription states. Medicines already added to
-- patients' current medications by dispensing stay in the record.
--
-- On the live database this loses every prescription and every payment
-- line, so it needs Anthony's explicit yes in writing.
-- =============================================================================

drop function if exists public.dispense_prescription(bigint);
drop function if exists public.pay_prescription(bigint, jsonb, public.payment_mode);
drop function if exists public.prescribe(bigint, jsonb, text, text);
drop function if exists public.pay_lab_request_lines(bigint, jsonb, public.payment_mode);

drop function if exists private.dispense_prescription(bigint);
drop function if exists private.pay_prescription(bigint, jsonb, public.payment_mode);
drop function if exists private.prescribe(bigint, jsonb, text, text);
drop function if exists private.pay_lab_request_lines(bigint, jsonb, public.payment_mode);
drop function if exists private.record_payment_lines(bigint, public.payment_purpose, jsonb, public.payment_mode);

drop table if exists public.prescription_items;
drop table if exists public.prescriptions;
drop function if exists private.can_see_prescription(bigint, uuid);
drop table if exists public.payment_lines;
drop function if exists private.is_doctor();
drop type if exists public.prescription_status;
