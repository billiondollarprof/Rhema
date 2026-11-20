-- =============================================================================
-- 20261119211756_unpaid_expire_after_72_hours.sql
--
-- What this is: a drug or lab test that nobody paid for, and that was never
-- given or tested, expires 72 hours after the doctor sent it. It leaves the
-- Front Desk's, the Pharmacy's and the Lab's lists, and the record shows it
-- in grey as "Expired, not paid". Nothing is deleted.
--
-- Why: Anthony, 2026-11-19 (request 228a): "a payment that has not been
-- taken maybe after 24 hours. I want it to expire and clean off by itself,
-- since front desk did not take that payment, because the person who was in
-- session have left." And: "If the drug is already given, show it as a
-- payment that is owed. If it is not given, expire it and grey it out. That
-- they did not pay, that's why they were not given."
-- 72 hours, his choice on 2026-11-20 (it was 24): patients who go to look
-- for money can come back a day or two later.
--
-- Rules:
--   - Expires: not paid, not cancelled, and older than 72 hours (3 days), and
--       a prescription: never dispensed (status not dispensed);
--       a lab request: no sample taken and no result (status not completed).
--     It becomes cancelled (status voided), with the time it expired.
--   - Never expires: anything paid, or anything already given or tested.
--     That stays on the Front Desk's list as money owed (request 227k).
--   - expire_unpaid() does the expiring. Any active staff may run it, and it
--     does only this one rule, so the lists run it when they load. There is
--     no other timer to fail.
--   - Even before it has run, the database refuses to pay, dispense, take a
--     sample or record a result for one that is due to expire.
--   - Every change is written in the activity log, as before.
--
-- Never: delete a prescription or a lab request, or expire one that was
-- paid, given or tested.
-- =============================================================================


-- ===== 1. When it expired =====
alter table public.prescriptions add column expired_at timestamptz;
alter table public.lab_requests  add column expired_at timestamptz;


-- ===== 2. Is this one due to expire? (one rule, used everywhere below) =====
create function private.prescription_due_to_expire(p public.prescriptions)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p.payment_id is null
     and p.status in ('awaiting_payment', 'awaiting_dispense')
     and p.prescribed_at < now() - interval '72 hours';
$$;

create function private.lab_request_due_to_expire(r public.lab_requests)
returns boolean
language sql
stable
set search_path = ''
as $$
  select r.payment_id is null
     and r.status in ('awaiting_payment', 'awaiting_test')
     and r.sample_taken_at is null
     and r.requested_at < now() - interval '72 hours';
$$;

revoke execute on function private.prescription_due_to_expire(public.prescriptions) from public, anon;
revoke execute on function private.lab_request_due_to_expire(public.lab_requests) from public, anon;
grant  execute on function private.prescription_due_to_expire(public.prescriptions) to authenticated;
grant  execute on function private.lab_request_due_to_expire(public.lab_requests) to authenticated;


-- ===== 3. Expire every one that is due =====
-- Answers how many expired. Security definer: nobody may change these tables
-- directly; this function changes only the ones the rule above picks.
create function private.expire_unpaid()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  drugs integer;
  tests integer;
begin
  if not exists (select 1 from public.staff where id = (select auth.uid()) and is_active) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.prescriptions p
     set status = 'voided', expired_at = now()
   where private.prescription_due_to_expire(p);
  get diagnostics drugs = row_count;
  update public.lab_requests r
     set status = 'voided', expired_at = now()
   where private.lab_request_due_to_expire(r);
  get diagnostics tests = row_count;
  return drugs + tests;
end;
$$;

revoke execute on function private.expire_unpaid() from public, anon;
grant  execute on function private.expire_unpaid() to authenticated;

create function public.expire_unpaid()
returns integer
language sql
set search_path = ''
as $$ select private.expire_unpaid(); $$;

revoke execute on function public.expire_unpaid() from public, anon;
grant  execute on function public.expire_unpaid() to authenticated;


-- ===== 4. Too late: refuse to pay, give or test one that is due to expire =====
-- Runs before every change to a prescription or a lab request, however it
-- comes (every write goes through the database's own functions).
create function private.refuse_expired_prescription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.prescription_due_to_expire(old)
     and (new.payment_id is not null or new.dispensed_at is not null or new.status = 'dispensed') then
    raise exception 'expired: not paid within 72 hours' using errcode = '22023';
  end if;
  return new;
end;
$$;

create function private.refuse_expired_lab_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.lab_request_due_to_expire(old)
     and (new.payment_id is not null or new.sample_taken_at is not null
          or new.completed_at is not null or new.status = 'completed') then
    raise exception 'expired: not paid within 72 hours' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function private.refuse_expired_prescription() from public, anon, authenticated;
revoke execute on function private.refuse_expired_lab_request() from public, anon, authenticated;

create trigger prescriptions_refuse_expired before update on public.prescriptions
  for each row execute function private.refuse_expired_prescription();
create trigger lab_requests_refuse_expired before update on public.lab_requests
  for each row execute function private.refuse_expired_lab_request();
