-- =============================================================================
-- Undo for messages: removes messages, reads, announcements and their
-- functions. On the live database this deletes every message, so it needs
-- Anthony's explicit yes in writing.
-- =============================================================================

drop function if exists public.send_message(public.room_kind, bigint, text, uuid);
drop function if exists public.mark_messages_read(bigint[]);
drop function if exists public.send_announcement(text, date, uuid);
drop function if exists public.mark_announcement_read(bigint);
drop function if exists private.send_message(public.room_kind, bigint, text, uuid);
drop function if exists private.mark_messages_read(bigint[]);
drop function if exists private.send_announcement(text, date, uuid);
drop function if exists private.mark_announcement_read(bigint);
drop function if exists private.forget_old_messages();
drop table if exists public.announcement_reads;
drop table if exists public.announcements;
drop table if exists public.message_reads;
drop table if exists public.messages;
drop function if exists private.can_read_message(uuid, bigint, public.room_kind, bigint);
drop function if exists private.my_room();
