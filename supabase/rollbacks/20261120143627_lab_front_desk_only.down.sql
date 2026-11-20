-- =============================================================================
-- Undo 20261120143627_lab_front_desk_only.sql: the old request_lab ("front
-- desk" or "straight to the lab") and no sent_to_lab column.
-- =============================================================================

create or replace function private.request_lab(patient bigint, wanted text[], request_note text, send_to text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text[];
begin
  if not (select private.has_permission('medical')) then
    raise exception 'Only doctors, nurses and the matron can request lab tests' using errcode = '42501';
  end if;
  if send_to not in ('front_desk', 'laboratory') then
    raise exception 'Send it to the Front Desk or the Laboratory' using errcode = '22023';
  end if;
  if not exists (select 1 from public.patients where id = patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;

  -- Each test once, without spaces at the ends, in the order given.
  select array_agg(test order by first_at) into clean
  from (
    select trim(item) as test, min(position) as first_at
    from unnest(wanted) with ordinality as given(item, position)
    where length(trim(item)) between 2 and 80
    group by trim(item)
  ) tidy;
  if clean is null or cardinality(clean) = 0 or cardinality(clean) > 20 then
    raise exception 'Choose between 1 and 20 tests' using errcode = '22023';
  end if;

  -- Two taps at the same moment wait here for each other.
  perform pg_advisory_xact_lock(hashtext('lab-request:' || (select auth.uid())::text || ':' || patient::text));
  if exists (
    select 1 from public.lab_requests
    where requested_by = (select auth.uid())
      and patient_id = patient
      and tests = clean
      and requested_at > now() - interval '30 seconds'
  ) then
    return 'already_sent';
  end if;

  insert into public.lab_requests (patient_id, tests, note, status)
  values (
    patient, clean, nullif(trim(request_note), ''),
    case send_to when 'front_desk' then 'awaiting_payment'::public.lab_status
                 else 'awaiting_test'::public.lab_status end
  );
  return 'sent';
end;
$$;

alter table public.lab_requests drop column sent_to_lab;
