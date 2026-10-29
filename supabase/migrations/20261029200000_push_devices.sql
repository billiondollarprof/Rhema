-- =============================================================================
-- 20261029200000_push_devices.sql
--
-- What this is: Call attention, step 2. When a room is called, the phones
-- and computers of the people on duty there get a notification, even when
-- the app is closed.
--
-- Why: Anthony, 2026-10-29, "yes" to step 2. The notification says only
-- "Nursing Station is calling Front Desk": no names, no patients.
--
-- How it works, in order:
--   1. A person taps "Turn on" on a device. The browser gives a push address
--      for that device, and register_push_device() keeps it in
--      push_devices, under that person's account.
--   2. A call is saved in attention_calls (the earlier migration).
--   3. The trigger in section 5 picks the devices of the people being
--      called (the same rule as the card on the screen), and sends their
--      push addresses to our Worker with pg_net, signed with a shared
--      secret kept in Vault.
--   4. The Worker encrypts the notification and sends it to each device.
--
-- Rules:
--   - A person can only add, see and remove their own devices.
--   - Nobody's browser ever receives another person's push address. Only
--     the database and the Worker see them.
--   - The address of the Worker and the shared secret live in Vault, set by
--     the push-keys workflow. Until they are set, nothing is sent.
--   - A failed send never stops the call itself being saved.
--
-- Never: put a name, a patient or anything clinical in the notification.
-- =============================================================================


-- ===== 1. pg_net, so the database can call the Worker =====
-- On Supabase it is there to switch on. The local test database has a
-- stand-in with the same name (supabase/tests/local_shim.sql).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end $$;


-- ===== 2. The table of devices =====

create table public.push_devices (
  id            bigint generated always as identity primary key,
  staff_id      uuid not null references public.staff (id),
  -- The push address the browser gave. Each browser has its own.
  endpoint      text not null check (endpoint like 'https://%' and length(endpoint) <= 1000),
  -- The two keys the browser gave, used to encrypt the message for it.
  p256dh        text not null check (length(p256dh) between 20 and 200),
  auth_key      text not null check (length(auth_key) between 10 and 100),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  -- A shared desk computer can carry several people, one row each.
  constraint push_devices_one_per_person unique (staff_id, endpoint)
);

create index push_devices_endpoint_idx on public.push_devices (endpoint);

-- Supabase gives every new table full rights. Take them all away. People
-- read their own rows; adding and removing go through the functions below.
revoke all on public.push_devices from anon, authenticated;
alter table public.push_devices enable row level security;
grant select on public.push_devices to authenticated;

create policy push_devices_read_own on public.push_devices
  for select to authenticated
  using (staff_id = (select auth.uid()));

create trigger push_devices_activity
  after insert on public.push_devices
  for each row execute function private.write_activity();


-- ===== 3. Adding and removing your own device =====

-- Add this device for the signed in person, or refresh it if it is there.
create function private.register_push_device(endpoint text, p256dh text, auth_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
-- The inputs share their names with the columns, so the inputs are always
-- written in full (register_push_device.endpoint) to keep the two apart.
begin
  if not (select private.is_active_staff()) then
    raise exception 'Only active staff can turn on alerts' using errcode = '42501';
  end if;
  insert into public.push_devices (staff_id, endpoint, p256dh, auth_key)
  values (
    (select auth.uid()),
    register_push_device.endpoint,
    register_push_device.p256dh,
    register_push_device.auth_key
  )
  on conflict on constraint push_devices_one_per_person do update
    set p256dh = excluded.p256dh, auth_key = excluded.auth_key, last_seen_at = now();
end;
$$;

-- Remove this device for the signed in person only (turning alerts off,
-- or signing out of this device). Other people on the same computer keep
-- theirs.
create function private.forget_push_device(endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_devices
  where staff_id = (select auth.uid()) and push_devices.endpoint = forget_push_device.endpoint;
$$;

revoke execute on function private.register_push_device(text, text, text) from public, anon;
revoke execute on function private.forget_push_device(text) from public, anon;
grant  execute on function private.register_push_device(text, text, text) to authenticated;
grant  execute on function private.forget_push_device(text) to authenticated;

-- The app calls these. They run as the person signed in and hand over to
-- the private functions above, so the security advisor has nothing to flag.
create function public.register_push_device(endpoint text, p256dh text, auth_key text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.register_push_device(endpoint, p256dh, auth_key);
$$;

create function public.forget_push_device(endpoint text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.forget_push_device(endpoint);
$$;

revoke execute on function public.register_push_device(text, text, text) from public, anon;
revoke execute on function public.forget_push_device(text) from public, anon;
grant  execute on function public.register_push_device(text, text, text) to authenticated;
grant  execute on function public.forget_push_device(text) to authenticated;


-- ===== 4. Who is called: the same rule, for any person =====
-- The earlier migration answered "am I called?" for the signed in person.
-- The trigger below needs the same answer for every person, so the rule
-- moves into staff_is_called(), and is_called() now asks it about the
-- signed in person. What is_called() answers does not change.

create function private.staff_is_called(person uuid, called_kind public.room_kind, called_room bigint)
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
    where s.id = person
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

revoke execute on function private.staff_is_called(uuid, public.room_kind, bigint) from public, anon, authenticated;

create or replace function private.is_called(called_kind public.room_kind, called_room bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.staff_is_called((select auth.uid()), called_kind, called_room);
$$;


-- ===== 5. On each new call: send the push =====

create function private.push_attention_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_url text;
  push_secret text;
  targets jsonb;
  from_words text;
  to_words text;
begin
  -- Not set up yet (the push-keys workflow has not run): send nothing.
  select decrypted_secret into worker_url from vault.decrypted_secrets where name = 'rhema_push_url';
  select decrypted_secret into push_secret from vault.decrypted_secrets where name = 'rhema_push_secret';
  if worker_url is null or push_secret is null then
    return new;
  end if;

  -- The devices of everyone being called, once each, but never a device the
  -- caller uses (a shared desk computer would ring its own caller).
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', d.endpoint, 'p256dh', d.p256dh, 'auth', d.auth_key)), '[]'::jsonb)
  into targets
  from (
    select distinct on (pd.endpoint) pd.endpoint, pd.p256dh, pd.auth_key
    from public.push_devices pd
    where pd.staff_id <> new.called_by
      and private.staff_is_called(pd.staff_id, new.to_kind, new.to_room_id)
      and pd.endpoint not in (select mine.endpoint from public.push_devices mine where mine.staff_id = new.called_by)
    order by pd.endpoint, pd.last_seen_at desc
  ) d;

  if jsonb_array_length(targets) = 0 then
    return new;
  end if;

  -- The words: rooms only, never a person's name.
  select coalesce((select name from public.rooms where id = new.from_room_id), 'Someone') into from_words;
  select coalesce(
    (select name from public.rooms where id = new.to_room_id),
    case new.to_kind
      when 'front_desk'   then 'Front Desk'
      when 'nursing'      then 'Nursing Station'
      when 'laboratory'   then 'Laboratory'
      when 'pharmacy'     then 'Pharmacy'
      when 'consultation' then 'Consultant'
      when 'matron'       then 'Matron'
    end
  ) into to_words;

  -- A failed send must never stop the call being saved.
  begin
    perform net.http_post(
      url := worker_url || '/api/push/attention',
      body := jsonb_build_object(
        'call_id', new.id,
        'title', 'Call attention',
        'body', from_words || ' is calling ' || to_words,
        'targets', targets
      ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Rhema-Push-Secret', push_secret),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'Call attention push for call % could not be queued: %', new.id, sqlstate;
  end;
  return new;
end;
$$;

revoke execute on function private.push_attention_call() from public, anon, authenticated;

create trigger attention_calls_push
  after insert on public.attention_calls
  for each row execute function private.push_attention_call();
