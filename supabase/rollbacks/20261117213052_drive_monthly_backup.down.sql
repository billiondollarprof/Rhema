-- Undo drive_monthly_backup: back to how it was before.
drop function public.disconnect_drive();
drop function public.drive_link_status();
drop function public.finish_drive_link(uuid, text, text);
drop function public.start_drive_link();
drop function private.disconnect_drive();
drop function private.drive_link_status();
drop function private.finish_drive_link(uuid, text, text);
drop function private.start_drive_link();
drop table private.drive_link_starts;
drop table private.drive_link;
