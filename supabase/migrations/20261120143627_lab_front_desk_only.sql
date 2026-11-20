-- =============================================================================
-- 20261120143627_lab_front_desk_only.sql
--
-- What this is: a lab request goes to the Front Desk only, or to the Front
-- Desk and the Lab at once. There is no "straight to the lab" any more:
-- every request reaches the Front Desk for payment.
--
-- Why: Anthony, 2026-11-20 (request 233): "When it comes to lab tests, you
-- either send to the front desk only, or you send both to the lab and the
-- front desk... There's no time you will send to lab or pharmacy, straight
-- to lab or straight to pharmacy without it sending to front desk." And:
-- "Front desk only. The test will reach the lab when front desk has taken
-- money."
--
-- Rules:
--   - sent_to_lab: true when the doctor sent it to the Lab too. The Lab's
--     list shows a request sent to it, or one that is paid.
--   - Every new request waits for payment (status awaiting_payment). Paying
--     moves it to awaiting_test, as before.
--   - Requests made before this keep sent_to_lab true: the Lab already saw
--     them.
--   - Who may request, read or test does not change.
--
-- Never: send a request anywhere that the Front Desk does not see.
-- =============================================================================


-- ===== 1. Whether the Lab was sent it too =====
alter table public.lab_requests add column sent_to_lab boolean not null default true;


-- ===== 2. Request a test: the Front Desk only, or the Front Desk and the Lab =====
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
  -- front_desk: the Front Desk only; the Lab gets it once it is paid.
  -- both: the Front Desk and the Lab at once. laboratory: what an older
  -- screen sends for "Straight to the lab", now the same as both, because
  -- every request reaches the Front Desk (request 233).
  if send_to not in ('front_desk', 'both', 'laboratory') then
    raise exception 'Send it to the Front Desk, or to the Front Desk and the Lab' using errcode = '22023';
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

  -- Every request waits for payment at the Front Desk; the Lab may still
  -- do the test before it is paid (request 232).
  insert into public.lab_requests (patient_id, tests, note, status, sent_to_lab)
  values (
    patient, clean, nullif(trim(request_note), ''),
    'awaiting_payment'::public.lab_status,
    send_to <> 'front_desk'
  );
  return 'sent';
end;
$$;
