-- Undo message_edits_closed: remove the written rule (the table stays closed).
drop policy if exists message_edits_nobody on public.message_edits;
