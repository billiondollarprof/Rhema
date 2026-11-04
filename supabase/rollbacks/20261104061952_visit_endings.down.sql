-- Undo visit_endings: no Move, no Has left, no ending the one before, no
-- end of day. Ended visits stay ended; only the reason is forgotten.

drop function if exists public.mark_left(bigint);
drop function if exists public.move_patient(bigint, bigint, text);
drop function if exists private.mark_left(bigint);
drop function if exists private.move_patient(bigint, bigint, text);
drop function if exists private.close_old_visits();

drop trigger if exists queue_end_previous on public.queue_entries;
drop function if exists private.end_previous_visit();
drop trigger if exists queue_stamp_end on public.queue_entries;
drop function if exists private.stamp_visit_end();

drop index if exists public.queue_patient_time_idx;
alter table public.queue_entries drop constraint if exists queue_done_has_reason;
alter table public.queue_entries drop column if exists finish_reason;
