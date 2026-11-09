-- Undo for antenatal_booking_and_consent: takes the four tables, the
-- notice column and its function away. Anything saved in them is lost, so
-- only before the hospital has used them.
drop function if exists public.mark_dispense_seen(bigint);
drop function if exists private.mark_dispense_seen(bigint);
alter table public.prescriptions drop column if exists dispense_seen_at;
drop table if exists public.operation_consents;
drop table if exists public.previous_pregnancies;
drop table if exists public.antenatal_tests;
drop table if exists public.antenatal_bookings;
