-- =============================================================================
-- Undo 20261123192759_consulting_room_does_what_a_doctor_does.sql: only the
-- doctor role prescribes again, and only a doctor or the matron sets prices.
-- Loses no data.
-- =============================================================================

create or replace function private.is_doctor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and role = 'doctor' and can_medical
  );
$$;

create or replace function private.sets_prices()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and role in ('doctor', 'matron')
  );
$$;
