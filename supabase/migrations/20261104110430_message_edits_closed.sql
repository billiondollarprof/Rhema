-- =============================================================================
-- message_edits_closed: a written rule on message_edits that lets nobody
-- read it from the app.
--
-- Why: the testing database's security check (2026-11-04) warned "RLS
-- enabled, no policies" on message_edits, made by
-- messages_general_tags_edits. The table was already closed (no rights,
-- RLS on); this says so in a rule, so the warning is answered, not
-- accepted. Nothing anybody can do changes.
--
-- Never: open this table to the app. The old wording of a changed message
-- is kept for the record only.
-- =============================================================================

-- ===== 1. Nobody reads it =====
create policy message_edits_nobody on public.message_edits
  for select to authenticated
  using (false);
