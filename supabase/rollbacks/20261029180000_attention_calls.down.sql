-- =============================================================================
-- Undo for 20261029180000_attention_calls.sql
--
-- Removes Call attention: the function the app calls, the helpers, and the
-- table. On the live database this loses the record of who called whom, so
-- it needs Anthony's explicit yes in writing.
-- =============================================================================

drop function if exists public.call_attention(public.room_kind, bigint);
drop function if exists private.call_attention(public.room_kind, bigint);
drop table if exists public.attention_calls;
drop function if exists private.is_called(public.room_kind, bigint);
