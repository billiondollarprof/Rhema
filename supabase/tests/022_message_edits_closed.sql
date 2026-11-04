-- =============================================================================
-- 022_message_edits_closed.sql: tests for message_edits_closed.
--
-- What this is: proves message_edits has its written rule, and that a
-- signed in person and somebody signed out still read nothing from it.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== 1. The rule is there, and the table stays closed =====
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'message_edits'
                   and policyname = 'message_edits_nobody') then
    raise exception 'FAIL 1: message_edits has no written rule';
  end if;
  if has_table_privilege('authenticated', 'public.message_edits', 'select')
     or has_table_privilege('anon', 'public.message_edits', 'select') then
    raise exception 'FAIL 1: message_edits can be read from the app';
  end if;
end $$;
\echo 'PASS 1: message_edits has its rule and nobody reads it from the app'

rollback;
