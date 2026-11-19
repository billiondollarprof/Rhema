-- =============================================================================
-- 20261119063412_speed_indexes.sql
--
-- What this is: four lookup lists (indexes) so a few searches stay fast as
-- the records grow. No data changes; nobody sees a difference but speed.
--
-- Why: the security and robustness review, 2026-11-19; Supabase's advisor
-- named these links as having no index. Anthony's yes, the same day.
--   1. payments by who took them: History, "money I took this shift".
--   2. and 3. prescriptions and lab tests by their payment: Waiting for
--      payment (request 227k).
--   4. stock moves by prescription: the Pharmacy's stock record.
--
-- Never: change or remove any data.
-- =============================================================================

create index if not exists payments_received_by_idx on public.payments (received_by);
create index if not exists prescriptions_payment_id_idx on public.prescriptions (payment_id);
create index if not exists lab_requests_payment_id_idx on public.lab_requests (payment_id);
create index if not exists stock_moves_prescription_id_idx on public.stock_moves (prescription_id);
