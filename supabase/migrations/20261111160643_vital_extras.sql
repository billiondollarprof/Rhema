-- =============================================================================
-- 20261111160643_vital_extras.sql
--
-- What this is: "Other" vital signs. A nurse or doctor records a measure that
-- has no box (blood sugar, say) by typing its name once. It stays on that
-- person's own screen from then on. When a SECOND person types the same name,
-- it becomes standard and shows as a box for everybody.
--
-- Why: Anthony, 2026-11-11: "what about a vital sign that is not among those
-- boxes? Put something like 'other'... the nurse should not have to type it
-- every time. If they have done it before, let it remain... it remains for
-- that nurse and for that doctor in their own account. It doesn't become a
-- standard, except if the system finds that the same vital sign that this
-- person types, another nurse has typed it again. Then the system learns to
-- automatically make it standard."
--
-- Rules:
--   - "The same" means the same words, ignoring capitals, spaces and
--     punctuation ("Blood sugar" and "blood-sugar" are one measure).
--   - Everybody with medical record access may use a measure; the writer is
--     always the person signed in.
--   - A reading belongs to one patient and is only seen by staff who have
--     that record open. A wrong one is voided with a reason, never deleted.
--   - Measures are made through a function; the app never writes them.
--
-- Never: show one person's own measures to another before a second person has
-- typed the same one, or let a reading be written in another person's name.
-- =============================================================================


-- ===== 1. Telling two spellings apart from one measure =====
create function private.vital_key(t text)
returns text
language sql
immutable
set search_path = ''
as $$ select trim(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', ' ', 'g')); $$;


-- ===== 2. The measures, and who uses each =====
create table public.vital_measures (
  id         bigint generated always as identity primary key,
  name       text not null check (length(trim(name)) between 2 and 60),
  unit       text check (unit is null or length(trim(unit)) between 1 and 20),
  key        text not null unique check (length(key) >= 2),
  standard   boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.vital_measure_users (
  measure_id bigint not null references public.vital_measures (id),
  staff_id   uuid not null references public.staff (id),
  added_at   timestamptz not null default now(),
  primary key (measure_id, staff_id)
);
create index vital_measure_users_staff_idx on public.vital_measure_users (staff_id);

revoke all on public.vital_measures      from anon, authenticated;
revoke all on public.vital_measure_users from anon, authenticated;
alter table public.vital_measures      enable row level security;
alter table public.vital_measure_users enable row level security;

grant select on public.vital_measures      to authenticated;
grant select on public.vital_measure_users to authenticated;

create policy vital_measures_read on public.vital_measures
  for select to authenticated
  using (
    (select private.has_permission('medical'))
    and (
      standard
      or exists (
        select 1 from public.vital_measure_users u
        where u.measure_id = vital_measures.id and u.staff_id = (select auth.uid())
      )
    )
  );

-- Each person sees only their own lines.
create policy vital_measure_users_read on public.vital_measure_users
  for select to authenticated
  using (staff_id = (select auth.uid()));

create trigger vital_measures_activity
  after insert or update on public.vital_measures
  for each row execute function private.write_activity();


-- ===== 3. Use a measure (made if new; standard when a second person uses it) =====
create function private.use_vital_measure(p_name text, p_unit text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  clean_unit text := nullif(regexp_replace(trim(coalesce(p_unit, '')), '\s+', ' ', 'g'), '');
  the_key text := private.vital_key(clean_name);
  found bigint;
  me uuid := (select auth.uid());
begin
  if not (select private.has_permission('medical')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if length(clean_name) not between 2 and 60 or length(the_key) < 2
     or (clean_unit is not null and length(clean_unit) > 20) then
    raise exception 'Check the name and the unit' using errcode = '22023';
  end if;

  insert into public.vital_measures (name, unit, key)
  values (clean_name, clean_unit, the_key)
  on conflict (key) do update set unit = coalesce(public.vital_measures.unit, excluded.unit)
  returning id into found;

  insert into public.vital_measure_users (measure_id, staff_id)
  values (found, me)
  on conflict do nothing;

  -- A second person has typed it: it is standard now.
  update public.vital_measures
  set standard = true
  where id = found and not standard
    and (select count(*) from public.vital_measure_users where measure_id = found) >= 2;

  return found;
end;
$$;

revoke execute on function private.use_vital_measure(text, text) from public, anon;
grant  execute on function private.use_vital_measure(text, text) to authenticated;

create function public.use_vital_measure(p_name text, p_unit text default null)
returns bigint language sql security invoker set search_path = ''
as $$ select private.use_vital_measure(p_name, p_unit); $$;

revoke execute on function public.use_vital_measure(text, text) from public, anon;
grant  execute on function public.use_vital_measure(text, text) to authenticated;


-- ===== 4. The readings =====
create table public.vital_extras (
  id          bigint generated always as identity primary key,
  patient_id  bigint not null references public.patients (id),
  measure_id  bigint not null references public.vital_measures (id),
  -- The name and unit as they were when the reading was taken.
  name        text not null check (length(trim(name)) between 2 and 60),
  unit        text check (unit is null or length(trim(unit)) between 1 and 20),
  value       numeric(9,2) not null check (value between -100000 and 100000),
  recorded_by uuid not null default auth.uid() references public.staff (id),
  recorded_at timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references public.staff (id),
  void_reason text,
  constraint vital_extras_void_needs_reason check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);

create index vital_extras_patient_idx   on public.vital_extras (patient_id, recorded_at desc);
create index vital_extras_measure_idx   on public.vital_extras (measure_id);
create index vital_extras_by_idx        on public.vital_extras (recorded_by);
create index vital_extras_voided_by_idx on public.vital_extras (voided_by);

revoke all on public.vital_extras from anon, authenticated;
alter table public.vital_extras enable row level security;

grant select, insert on public.vital_extras to authenticated;
grant update (voided_at, voided_by, void_reason) on public.vital_extras to authenticated;

create policy vital_extras_read on public.vital_extras
  for select to authenticated
  using (private.can_use_record(patient_id));

-- The measure must be one this person can see (their own, or standard).
create policy vital_extras_insert on public.vital_extras
  for insert to authenticated
  with check (
    private.can_use_record(patient_id)
    and recorded_by = (select auth.uid())
    and exists (select 1 from public.vital_measures m where m.id = measure_id)
  );

create policy vital_extras_update on public.vital_extras
  for update to authenticated
  using (private.can_use_record(patient_id))
  with check (private.can_use_record(patient_id) and (voided_by is null or voided_by = (select auth.uid())));

create trigger vital_extras_refuse_double
  before insert on public.vital_extras
  for each row execute function private.refuse_double('recorded_by', 'recorded_at');

create trigger vital_extras_activity
  after insert or update on public.vital_extras
  for each row execute function private.write_activity();
