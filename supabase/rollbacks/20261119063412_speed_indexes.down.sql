-- Undo 20261119063412_speed_indexes.sql: removes the four lookup lists.
-- No data is touched.
drop index if exists public.stock_moves_prescription_id_idx;
drop index if exists public.lab_requests_payment_id_idx;
drop index if exists public.prescriptions_payment_id_idx;
drop index if exists public.payments_received_by_idx;
