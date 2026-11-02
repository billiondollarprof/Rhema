-- =============================================================================
-- Undo for receipts: take_payment and receipt numbers go. Payments already
-- taken stay, without their receipt numbers.
-- =============================================================================

drop function if exists public.take_payment(bigint, public.payment_purpose, jsonb, public.payment_mode);
drop function if exists private.take_payment(bigint, public.payment_purpose, jsonb, public.payment_mode);
drop trigger if exists payments_protect_receipt_number on public.payments;
drop function if exists private.protect_receipt_number();
alter table public.payments drop column if exists receipt_number;
drop sequence if exists private.receipt_number_seq;
