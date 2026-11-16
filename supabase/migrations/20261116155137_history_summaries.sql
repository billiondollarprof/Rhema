-- =============================================================================
-- 20261116155137_history_summaries.sql
--
-- What this is: the numbers behind History in the menu. Four read only
-- functions, each answering only the people it is for:
--   1. money_summary: the Front Desk and admins. Total taken, by category
--      (the card split into Individual, Family and Antenatal), by how it was
--      paid (cash, POS, transfer), the payments, and the patients registered.
--      The Front Desk ALWAYS gets only what they took themselves; an admin
--      gets everybody, or one person they choose (Anthony, 2026-11-16: "the
--      front desk just want to know the one they themselves collected...
--      admin is now the one that sees everything that each and everyone
--      collected").
--   1b. my_shift_start: when this person last signed in with the email code
--      (unlocking with the PIN does not change it). The Front Desk's shift
--      runs from then: "from the time their own session started... some of
--      them, their session can last for 48 hours".
--   2. lab_summary: the Laboratory. Counts only, no money.
--   3. pharmacy_summary: the Pharmacy. Counts only, no money.
--   4. my_summary: anybody, about their own work only: the patients they
--      worked on and how many notes, readings, requests and prescriptions.
--
-- Why: Anthony, 2026-11-16 (requests 215 and 216): "they want to know how
-- much they made when they were on duty... by category... by mode of
-- payment... the total paid... count the cash they have and know that it
-- matches... Pharmacy and lab only see numbers... each consultant can still
-- see their own history."
--
-- Rules: every function checks who is asking, reads only, writes nothing,
-- and covers at most 400 days. Voided payments are left out.
--
-- Never: give the Laboratory, the Pharmacy or a consultant any amount of
-- money, or one person another person's work.
-- =============================================================================


-- ===== 0. A period is sane: from before to, at most 400 days =====
create function private.check_period(p_from timestamptz, p_to timestamptz)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'Choose a period of up to 400 days' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function private.check_period(timestamptz, timestamptz) from public, anon, authenticated;


-- ===== 1. Money: the Front Desk and admins =====
create function private.money_summary(p_from timestamptz, p_to timestamptz, p_mine boolean, p_staff uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  answer jsonb;
  -- Whose payments: the Front Desk only ever their own; an admin everybody,
  -- or one person (p_staff), or their own (p_mine).
  only_staff uuid;
begin
  if not (select private.can_take_payment()) then
    raise exception 'Only the Front Desk and admins see money' using errcode = '42501';
  end if;
  perform private.check_period(p_from, p_to);
  if not (select private.is_admin()) then
    only_staff := me;
  elsif p_mine then
    only_staff := me;
  else
    only_staff := p_staff;
  end if;

  with paid as (
    select p.id, p.amount, p.mode::text as mode, p.received_at, p.receipt_number,
           pt.patient_number, s.full_name as taken_by,
           case when p.purpose = 'registration_card' then 'card_' || pt.category::text
                else p.purpose::text end as category
    from public.payments p
    join public.patients pt on pt.id = p.patient_id
    left join public.staff s on s.id = p.received_by
    where p.received_at >= p_from and p.received_at < p_to
      and p.voided_at is null
      and (only_staff is null or p.received_by = only_staff)
  )
  select jsonb_build_object(
    'total', coalesce((select sum(amount) from paid), 0),
    'count', (select count(*) from paid),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('key', category, 'count', n, 'amount', total) order by total desc)
      from (select category, count(*) as n, sum(amount) as total from paid group by category) c
    ), '[]'::jsonb),
    'by_mode', coalesce((
      select jsonb_agg(jsonb_build_object('key', mode, 'count', n, 'amount', total) order by mode)
      from (select mode, count(*) as n, sum(amount) as total from paid group by mode) m
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'at', received_at, 'receipt', receipt_number, 'patient', patient_number,
        'category', category, 'mode', mode, 'amount', amount, 'taken_by', taken_by
      ) order by received_at desc)
      from (select * from paid order by received_at desc limit 500) latest
    ), '[]'::jsonb),
    'registered', coalesce((
      select jsonb_agg(jsonb_build_object(
        'at', created_at, 'patient', patient_number, 'category', category::text,
        'old_file', from_old_file
      ) order by created_at desc)
      from (
        select created_at, patient_number, category, from_old_file from public.patients
        where created_at >= p_from and created_at < p_to and voided_at is null
          and (only_staff is null or created_by = only_staff)
        order by created_at desc limit 500
      ) r
    ), '[]'::jsonb)
  ) into answer;
  return answer;
end;
$$;


-- ===== 1b. When this person last signed in (the start of their shift) =====
create function private.my_shift_start()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select u.last_sign_in_at from auth.users u
  where u.id = (select auth.uid()) and (select private.is_active_staff());
$$;


-- ===== 2. The Laboratory: counts only =====
create function private.lab_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  answer jsonb;
begin
  if not (select private.has_permission('lab')) then
    raise exception 'Only the Laboratory sees these numbers' using errcode = '42501';
  end if;
  perform private.check_period(p_from, p_to);
  select jsonb_build_object(
    'requested', (select count(*) from public.lab_requests
                  where requested_at >= p_from and requested_at < p_to and status <> 'voided'),
    'done', (select count(*) from public.lab_requests
             where completed_at >= p_from and completed_at < p_to and status = 'completed'),
    'waiting', (select count(*) from public.lab_requests where status = 'awaiting_test'),
    'unpaid', (select count(*) from public.lab_requests where status = 'awaiting_payment'),
    'by_test', coalesce((
      select jsonb_agg(jsonb_build_object('test', test, 'count', n) order by n desc, test)
      from (
        select test, count(*) as n from public.lab_results
        where recorded_at >= p_from and recorded_at < p_to and voided_at is null
        group by test
      ) t
    ), '[]'::jsonb)
  ) into answer;
  return answer;
end;
$$;


-- ===== 3. The Pharmacy: counts only =====
-- How much of each drug: the number at the start of the quantity, added up,
-- with the words after it as the unit ("10 tablets" counts 10 tablets).
create function private.pharmacy_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  answer jsonb;
begin
  if not (select private.has_permission('pharmacy')) then
    raise exception 'Only the Pharmacy sees these numbers' using errcode = '42501';
  end if;
  perform private.check_period(p_from, p_to);
  with given as (
    select i.drug || coalesce(' ' || i.strength, '') as drug,
           nullif(substring(coalesce(i.quantity, '') from '^\s*([0-9]+(?:\.[0-9]+)?)'), '')::numeric as how_many,
           nullif(trim(regexp_replace(coalesce(i.quantity, ''), '^\s*[0-9]+(?:\.[0-9]+)?', '')), '') as unit
    from public.prescriptions p
    join public.prescription_items i on i.prescription_id = p.id
    where p.status = 'dispensed' and p.dispensed_at >= p_from and p.dispensed_at < p_to
  )
  select jsonb_build_object(
    'dispensed', (select count(*) from public.prescriptions
                  where status = 'dispensed' and dispensed_at >= p_from and dispensed_at < p_to),
    'waiting', (select count(*) from public.prescriptions where status = 'awaiting_dispense'),
    'unpaid', (select count(*) from public.prescriptions where status = 'awaiting_payment'),
    'by_drug', coalesce((
      select jsonb_agg(jsonb_build_object('drug', drug, 'times', n, 'amount', total, 'unit', unit)
                       order by n desc, drug)
      from (
        select drug, count(*) as n, sum(how_many) as total, max(unit) as unit
        from given group by drug
      ) d
    ), '[]'::jsonb)
  ) into answer;
  return answer;
end;
$$;


-- ===== 4. My own work: anybody, about themselves only =====
create function private.my_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  answer jsonb;
begin
  if not (select private.is_active_staff()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform private.check_period(p_from, p_to);
  with work as (
    select patient_id, created_at as at, 'consultation' as kind from public.consultation_notes
      where written_by = me and created_at >= p_from and created_at < p_to and voided_at is null
    union all
    select patient_id, created_at, 'nursing' from public.nursing_notes
      where written_by = me and created_at >= p_from and created_at < p_to and voided_at is null
    union all
    select patient_id, recorded_at, 'vitals' from public.vital_signs
      where recorded_by = me and recorded_at >= p_from and recorded_at < p_to and voided_at is null
    union all
    select patient_id, requested_at, 'lab' from public.lab_requests
      where requested_by = me and requested_at >= p_from and requested_at < p_to
    union all
    select patient_id, prescribed_at, 'prescription' from public.prescriptions
      where prescribed_by = me and prescribed_at >= p_from and prescribed_at < p_to
    union all
    select patient_id, given_at, 'dose' from public.medications_given
      where given_by = me and given_at >= p_from and given_at < p_to and voided_at is null
  )
  select jsonb_build_object(
    'patients', (select count(distinct patient_id) from work),
    'counts', coalesce((
      select jsonb_object_agg(kind, n) from (select kind, count(*) as n from work group by kind) k
    ), '{}'::jsonb),
    'list', coalesce((
      select jsonb_agg(jsonb_build_object('patient', pt.patient_number, 'at', last_at, 'times', n)
                       order by last_at desc)
      from (
        select patient_id, max(at) as last_at, count(*) as n from work group by patient_id
        order by max(at) desc limit 300
      ) w
      join public.patients pt on pt.id = w.patient_id
    ), '[]'::jsonb)
  ) into answer;
  return answer;
end;
$$;


-- ===== 5. What the app may call =====
revoke execute on function private.money_summary(timestamptz, timestamptz, boolean, uuid) from public, anon;
revoke execute on function private.my_shift_start() from public, anon;
grant  execute on function private.my_shift_start() to authenticated;
revoke execute on function private.lab_summary(timestamptz, timestamptz) from public, anon;
revoke execute on function private.pharmacy_summary(timestamptz, timestamptz) from public, anon;
revoke execute on function private.my_summary(timestamptz, timestamptz) from public, anon;
grant  execute on function private.money_summary(timestamptz, timestamptz, boolean, uuid) to authenticated;
grant  execute on function private.lab_summary(timestamptz, timestamptz) to authenticated;
grant  execute on function private.pharmacy_summary(timestamptz, timestamptz) to authenticated;
grant  execute on function private.my_summary(timestamptz, timestamptz) to authenticated;

create function public.money_summary(p_from timestamptz, p_to timestamptz, p_mine boolean, p_staff uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.money_summary(p_from, p_to, p_mine, p_staff); $$;
create function public.my_shift_start()
returns timestamptz language sql security invoker set search_path = ''
as $$ select private.my_shift_start(); $$;
revoke execute on function public.my_shift_start() from public, anon;
grant  execute on function public.my_shift_start() to authenticated;
create function public.lab_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.lab_summary(p_from, p_to); $$;
create function public.pharmacy_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.pharmacy_summary(p_from, p_to); $$;
create function public.my_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.my_summary(p_from, p_to); $$;

revoke execute on function public.money_summary(timestamptz, timestamptz, boolean, uuid) from public, anon;
revoke execute on function public.lab_summary(timestamptz, timestamptz) from public, anon;
revoke execute on function public.pharmacy_summary(timestamptz, timestamptz) from public, anon;
revoke execute on function public.my_summary(timestamptz, timestamptz) from public, anon;
grant  execute on function public.money_summary(timestamptz, timestamptz, boolean, uuid) to authenticated;
grant  execute on function public.lab_summary(timestamptz, timestamptz) to authenticated;
grant  execute on function public.pharmacy_summary(timestamptz, timestamptz) to authenticated;
grant  execute on function public.my_summary(timestamptz, timestamptz) to authenticated;
