-- =============================================================================
-- Undo for 20261029200000_push_devices.sql
--
-- Removes the push for Call attention: the trigger, the device table and
-- its functions. It puts is_called() back to how the earlier migration had
-- it. On the live database this forgets every device that turned alerts
-- on, so each person would have to turn them on again; it needs Anthony's
-- yes in writing. pg_net is left switched on (other things may use it).
-- =============================================================================

drop trigger if exists attention_calls_push on public.attention_calls;
drop function if exists private.push_attention_call();

create or replace function private.is_called(called_kind public.room_kind, called_room bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    left join public.rooms r on r.id = s.room_id
    where s.id = (select auth.uid())
      and s.is_active
      and (
        (called_room is not null and s.room_id = called_room)
        or (called_room is null and r.kind = called_kind)
        or (s.room_id is null and called_kind::text = case s.role::text
              when 'front_desk' then 'front_desk'
              when 'nurse'      then 'nursing'
              when 'matron'     then 'matron'
              when 'pharmacy'   then 'pharmacy'
              when 'laboratory' then 'laboratory'
            end)
      )
  );
$$;
drop function if exists private.staff_is_called(uuid, public.room_kind, bigint);

drop function if exists public.register_push_device(text, text, text);
drop function if exists public.forget_push_device(text);
drop function if exists private.register_push_device(text, text, text);
drop function if exists private.forget_push_device(text);
drop table if exists public.push_devices;
