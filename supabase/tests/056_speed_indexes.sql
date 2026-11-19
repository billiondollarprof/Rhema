-- =============================================================================
-- tests for speed_indexes (security review, 2026-11-19): the four lookup
-- lists exist. Runs inside one transaction that is rolled back.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

do $$
begin
  if (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
        'payments_received_by_idx', 'prescriptions_payment_id_idx',
        'lab_requests_payment_id_idx', 'stock_moves_prescription_id_idx')) <> 4 then
    raise exception 'FAIL 1: a speed index is missing';
  end if;
end $$;
\echo 'PASS 1: the four speed indexes are there'

rollback;
