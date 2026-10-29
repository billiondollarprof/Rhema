-- =============================================================================
-- 20261029190000_attention_calls_rights.sql
--
-- What this is: takes away rights on the Call attention table that nobody
-- should have, and gives back only reading.
--
-- Why: on Supabase, every new table starts with full rights for signed in
-- users. Every other table in this repo starts with "revoke all"; the
-- attention_calls migration left that line out. The access rule (RLS)
-- still blocked changes through the app, but the rights themselves must
-- not be there. Found by test 7 in CI on 2026-10-29, before live.
--
-- Never: grant insert, update or delete here. Calls are made only through
-- call_attention().
-- =============================================================================

revoke all on public.attention_calls from anon, authenticated;
grant select on public.attention_calls to authenticated;
