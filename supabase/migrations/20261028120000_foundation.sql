-- =============================================================================
-- 20261028120000_foundation.sql
--
-- What this is: the first database change for the RHEMA hospital system.
-- It creates staff, rooms, families, patients and the activity log, with the
-- security rules (RLS) that decide who may read or change each row.
--
-- Why: everything else in the app (queue, records, lab, pharmacy, messages)
-- hangs off these tables. The plan it follows is docs/DATABASE.md, approved
-- by Anthony on 2026-10-28.
--
-- Never:
--   - turn RLS off on any table here;
--   - give the "anon" role (people not signed in) any access;
--   - let anyone delete a patient or edit a log line;
--   - put patient details (names, phone numbers) into the activity log.
--
-- Undo: supabase/rollbacks/20261028120000_foundation.down.sql
-- =============================================================================


-- ===== 1. The private area for helper functions ==============================
-- Functions here are used by the security rules. This schema is not exposed
-- to the internet through Supabase's Data API, so nobody can call them from
-- outside.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;


-- ===== 2. Fixed lists ========================================================

create type public.staff_role as enum (
  'front_desk', 'doctor', 'nurse', 'pharmacy', 'laboratory', 'admin'
);

create type public.room_kind as enum (
  'front_desk', 'consultation', 'nursing', 'matron', 'laboratory', 'pharmacy'
);

create type public.patient_sex as enum ('female', 'male');

create type public.patient_category as enum ('individual', 'family', 'antenatal');


-- ===== 3. Rooms ==============================================================
-- The places staff work and patients are sent to. The admin can add or
-- rename rooms later without a code change.

create table public.rooms (
  id         bigint generated always as identity primary key,
  name       text not null unique check (length(trim(name)) between 2 and 60),
  kind       public.room_kind not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.rooms (name, kind) values
  ('Front Desk',         'front_desk'),
  ('Consultant Room 1',  'consultation'),
  ('Consultant Room 2',  'consultation'),
  ('Consultant Room 3',  'consultation'),
  ('Matron''s Office',   'matron'),
  ('Nursing Station 1',  'nursing'),
  ('Nursing Station 2',  'nursing'),
  ('Laboratory',         'laboratory'),
  ('Pharmacy',           'pharmacy');


-- ===== 4. Staff ==============================================================
-- One row per person who can sign in. The id is the same as their Supabase
-- sign in account, so "who is asking" is always auth.uid().

create table public.staff (
  id                   uuid primary key references auth.users (id) on delete restrict,
  full_name            text not null check (length(trim(full_name)) between 2 and 120),
  email                text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role                 public.staff_role not null,
  room_id              bigint references public.rooms (id),
  staff_tag            text unique,
  is_active            boolean not null default true,

  -- The six permissions from the invite screen in the RHEMA demo.
  can_patients         boolean not null default true,
  can_medical          boolean not null default false,
  can_pharmacy         boolean not null default false,
  can_lab              boolean not null default false,
  can_announce         boolean not null default false,
  can_logs             boolean not null default false,

  -- The lock screen PIN, stored hashed. Never readable through the API
  -- (see the column grants in section 9). Set by a later migration.
  pin_hash             text,
  pin_failed_attempts  integer not null default 0,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index staff_room_id_idx on public.staff (room_id);

-- Starting permissions come from the role, exactly as the demo's invite
-- screen sets them. The admin can change each one afterwards.
create function private.set_default_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.can_medical  := new.role in ('doctor', 'nurse', 'admin');
  new.can_pharmacy := new.role in ('pharmacy', 'doctor', 'admin');
  new.can_lab      := new.role in ('laboratory', 'doctor', 'admin');
  new.can_announce := new.role in ('admin', 'nurse');
  new.can_logs     := new.role = 'admin';
  return new;
end;
$$;

create trigger staff_default_permissions
  before insert on public.staff
  for each row execute function private.set_default_permissions();


-- ===== 5. Who is asking: the permission helpers ==============================
-- Each helper answers one question about the signed in person. They run as
-- the database owner (security definer) so they can read the staff table
-- without tripping its own rules, and every one checks auth.uid() itself.

create function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active
  );
$$;

create function private.has_permission(permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case permission
      when 'patients'  then can_patients
      when 'medical'   then can_medical
      when 'pharmacy'  then can_pharmacy
      when 'lab'       then can_lab
      when 'announce'  then can_announce
      when 'logs'      then can_logs
      else false
    end
    from public.staff
    where id = (select auth.uid()) and is_active
  ), false);
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and role = 'admin'
  );
$$;

revoke execute on function private.is_active_staff()       from public, anon;
revoke execute on function private.has_permission(text)    from public, anon;
revoke execute on function private.is_admin()              from public, anon;
grant  execute on function private.is_active_staff()       to authenticated;
grant  execute on function private.has_permission(text)    to authenticated;
grant  execute on function private.is_admin()              to authenticated;


-- ===== 6. Families and patients ==============================================

create table public.families (
  id         bigint generated always as identity primary key,
  name       text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

-- Patient numbers: RMC-000001, RMC-000002 and so on. Given by the database,
-- never typed, never changed.
create sequence private.patient_number_seq;

create function private.next_patient_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'RMC-' || lpad(nextval('private.patient_number_seq')::text, 6, '0');
$$;

revoke execute on function private.next_patient_number() from public, anon;
grant  execute on function private.next_patient_number() to authenticated;

create table public.patients (
  id                bigint generated always as identity primary key,
  -- Set only by the trigger below, so numbers never skip.
  patient_number    text not null unique,
  full_name         text not null check (length(trim(full_name)) between 2 and 120),
  date_of_birth     date not null check (date_of_birth <= current_date),
  sex               public.patient_sex not null,
  category          public.patient_category not null default 'individual',
  family_id         bigint references public.families (id),

  -- Contact. Phone numbers are stored as 11 digits, like 08035550126.
  phone             text check (phone ~ '^0[0-9]{10}$'),
  email             text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address           text,
  town              text,
  lga               text,
  state             text,
  country           text not null default 'Nigeria',

  -- Next of kin.
  next_of_kin_name          text,
  next_of_kin_relationship  text,
  next_of_kin_phone         text check (next_of_kin_phone ~ '^0[0-9]{10}$'),

  -- Mistakes are voided with a reason, never deleted.
  voided_at         timestamptz,
  voided_by         uuid references public.staff (id),
  void_reason       text,
  constraint void_needs_reason check (voided_at is null or length(trim(void_reason)) > 0),

  created_by        uuid not null default auth.uid() references public.staff (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index patients_family_id_idx   on public.patients (family_id);
create index patients_created_by_idx  on public.patients (created_by);
create index patients_voided_by_idx   on public.patients (voided_by);
create index patients_full_name_idx   on public.patients (lower(full_name));
create index patients_phone_idx       on public.patients (phone);

-- A patient number cannot be set by hand or changed later.
create function private.protect_patient_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.patient_number := private.next_patient_number();
  elsif new.patient_number is distinct from old.patient_number then
    raise exception 'A patient number cannot be changed';
  end if;
  return new;
end;
$$;

create trigger patients_protect_number
  before insert or update on public.patients
  for each row execute function private.protect_patient_number();


-- ===== 7. Keep updated_at current ============================================

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger staff_touch    before update on public.staff
  for each row execute function private.touch_updated_at();
create trigger patients_touch before update on public.patients
  for each row execute function private.touch_updated_at();


-- ===== 8. The activity log ===================================================
-- Written only by the database, through the trigger below. Nobody can add,
-- change or delete a line through the API, the admin included. It records
-- WHICH fields changed, never their values, so no patient details end up
-- in the log.

create table public.activity_log (
  id          bigint generated always as identity primary key,
  happened_at timestamptz not null default now(),
  actor_id    uuid references public.staff (id),
  action      text not null,
  table_name  text not null,
  record_id   text not null,
  patient_id  bigint references public.patients (id),
  changed_fields text[]
);

create index activity_log_actor_idx   on public.activity_log (actor_id, happened_at desc);
create index activity_log_patient_idx on public.activity_log (patient_id, happened_at desc);
create index activity_log_time_idx    on public.activity_log (happened_at desc);

create function private.write_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[];
  row_id  text;
  pat_id  bigint;
begin
  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into changed
    from jsonb_each(to_jsonb(new)) as after_values
    where after_values.value is distinct from (to_jsonb(old) -> after_values.key)
      and after_values.key not in ('updated_at', 'pin_hash', 'pin_failed_attempts');
  end if;

  row_id := (to_jsonb(new) ->> 'id');
  pat_id := case
    when tg_table_name = 'patients' then (to_jsonb(new) ->> 'id')::bigint
    else (to_jsonb(new) ->> 'patient_id')::bigint
  end;

  insert into public.activity_log (actor_id, action, table_name, record_id, patient_id, changed_fields)
  values ((select auth.uid()), lower(tg_op), tg_table_name, row_id, pat_id, changed);

  return new;
end;
$$;

revoke execute on function private.write_activity() from public, anon, authenticated;

create trigger patients_activity after insert or update on public.patients
  for each row execute function private.write_activity();
create trigger staff_activity    after insert or update on public.staff
  for each row execute function private.write_activity();
create trigger rooms_activity    after insert or update on public.rooms
  for each row execute function private.write_activity();
create trigger families_activity after insert or update on public.families
  for each row execute function private.write_activity();


-- ===== 9. Who may touch which table (grants) =================================
-- Grants say which actions are possible at all. The RLS rules in section 10
-- then decide which rows. Both have to allow an action for it to work.

revoke all on public.rooms, public.staff, public.families, public.patients, public.activity_log
  from anon, authenticated;

grant select                  on public.rooms        to authenticated;
grant insert, update          on public.rooms        to authenticated;

-- Staff: everything except the PIN columns can be read.
grant select (id, full_name, email, role, room_id, staff_tag, is_active,
              can_patients, can_medical, can_pharmacy, can_lab, can_announce, can_logs,
              created_at, updated_at)
  on public.staff to authenticated;
grant insert (id, full_name, email, role, room_id, staff_tag)
  on public.staff to authenticated;
grant update (full_name, role, room_id, staff_tag, is_active,
              can_patients, can_medical, can_pharmacy, can_lab, can_announce, can_logs)
  on public.staff to authenticated;

grant select, insert, update  on public.families     to authenticated;

-- Patients: no delete at all, and the number and author can never be edited.
grant select, insert          on public.patients     to authenticated;
grant update (full_name, date_of_birth, sex, category, family_id, phone, email,
              address, town, lga, state, country,
              next_of_kin_name, next_of_kin_relationship, next_of_kin_phone,
              voided_at, voided_by, void_reason)
  on public.patients to authenticated;

grant select                  on public.activity_log to authenticated;


-- ===== 10. Row level security (RLS) ==========================================

alter table public.rooms        enable row level security;
alter table public.staff        enable row level security;
alter table public.families     enable row level security;
alter table public.patients     enable row level security;
alter table public.activity_log enable row level security;

-- Rooms: every active staff member can see them; only the admin changes them.
create policy rooms_read on public.rooms
  for select to authenticated
  using ((select private.is_active_staff()));
create policy rooms_admin_insert on public.rooms
  for insert to authenticated
  with check ((select private.is_admin()));
create policy rooms_admin_update on public.rooms
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Staff: active staff can see their colleagues (for messages and alerts);
-- only the admin invites people or changes them.
create policy staff_read on public.staff
  for select to authenticated
  using ((select private.is_active_staff()));
create policy staff_admin_insert on public.staff
  for insert to authenticated
  with check ((select private.is_admin()));
create policy staff_admin_update on public.staff
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Families and patients: anyone with the "register and find patients"
-- permission. The medical record is in later tables with stricter rules.
create policy families_read on public.families
  for select to authenticated
  using ((select private.has_permission('patients')));
create policy families_write on public.families
  for insert to authenticated
  with check ((select private.has_permission('patients')));
create policy families_update on public.families
  for update to authenticated
  using ((select private.has_permission('patients')))
  with check ((select private.has_permission('patients')));

create policy patients_read on public.patients
  for select to authenticated
  using ((select private.has_permission('patients')));
create policy patients_insert on public.patients
  for insert to authenticated
  with check ((select private.has_permission('patients')) and created_by = (select auth.uid()));
create policy patients_update on public.patients
  for update to authenticated
  using ((select private.has_permission('patients')))
  with check ((select private.has_permission('patients')));

-- Activity log: read only, and only with the activity log permission.
create policy activity_log_read on public.activity_log
  for select to authenticated
  using ((select private.has_permission('logs')));
