-- =============================================================================
-- 20261120040440_consultants_void_own_notes_only.sql
--
-- What this is: a consultant voids (and so corrects) only their own
-- consultation notes. Any consultant still reads every note and writes their
-- own, so a patient started in one room is carried on in another.
--
-- Why: Anthony, 2026-11-20 (request 229): "let each consultant only be able
-- to cancel or void their own consultation... they'll be able to continue
-- consultation, they'll be able to read the conversation, but they cannot
-- edit, cancel, correct, or void another. They can only void their own or
-- correct their own." Before this, any consultant with a consultation room
-- could void another consultant's note.
--
-- Rules:
--   - "Their own": the person who wrote the note, or the clinician it was
--     signed by (request 224: typed by one, seen by another).
--   - Correct is void and a filled in copy, so it follows the same rule.
--   - Reading and writing notes do not change.
--
-- Never: let a consultant void or correct another consultant's note.
-- =============================================================================


-- ===== 1. Void only your own note =====
drop policy consultation_update on public.consultation_notes;
create policy consultation_update on public.consultation_notes for update to authenticated
  using (
    private.can_use_record(patient_id)
    and (select private.has_consulting_room())
    and (written_by = (select auth.uid()) or signed_by = (select auth.uid()))
  )
  with check (
    private.can_use_record(patient_id)
    and (select private.has_consulting_room())
    and (voided_by is null or voided_by = (select auth.uid()))
  );
