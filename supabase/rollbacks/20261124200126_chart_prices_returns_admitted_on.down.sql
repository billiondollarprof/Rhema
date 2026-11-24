-- =============================================================================
-- Undo 20261124200126_chart_prices_returns_admitted_on.sql. Loses the
-- prescription mark on chart lines and every return recorded (they are
-- deleted first, so the store's count goes back to dispensed only): on live
-- this needs Anthony's yes in writing.
-- =============================================================================

create or replace function private.patient_medicines_for_pharmacy(p_patient bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found jsonb;
begin
  if not (select private.is_pharmacist()) then
    raise exception 'Only the Pharmacy can look at a patient''s medicines here' using errcode = '42501';
  end if;
  if not exists (select 1 from public.patients where id = p_patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;
  -- Written down first: a look at the record is always logged.
  insert into public.activity_log (actor_id, action, table_name, record_id, patient_id)
  values ((select auth.uid()), 'read', 'patient_medications', p_patient::text, p_patient);
  select coalesce(jsonb_agg(row_to_json(line) order by line.rank, line.started desc), '[]'::jsonb)
  into found
  from (
    select
      m.id,
      m.medicine,
      m.dose,
      m.how_often,
      m.status,
      m.created_at as started,
      adder.full_name as added_by,
      last.new_status as last_change,
      last.reason as last_reason,
      last.changed_at as last_changed_at,
      m.doses,
      -- Doses the nurses gave (a dose marked not given does not count).
      (select count(*) from public.medications_given g
        where g.medication_id = m.id and g.voided_at is null and g.not_given_reason is null) as given,
      (select coalesce(sum(d.doses), 0) from public.chart_dispenses d
        where d.medication_id = m.id) as dispensed,
      case m.status when 'active' then 0 when 'suspended' then 1 else 2 end as rank
    from public.patient_medications m
    left join public.staff adder on adder.id = m.added_by
    left join lateral (
      select l.new_status, l.reason, l.changed_at
      from public.medication_status_log l
      where l.medication_id = m.id and l.old_status is not null
      order by l.changed_at desc
      limit 1
    ) last on true
    where m.patient_id = p_patient and m.voided_at is null
  ) line;

  return found;
end;
$$;

create or replace function private.bill_statement(patient bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  stay public.admissions;
  since timestamptz;
  medicines jsonb;
  prescriptions jsonb;
  labs jsonb;
  bills jsonb;
  billed numeric(12, 2);
  deposits numeric(12, 2);
  bills_paid numeric(12, 2);
  paid_apart numeric(12, 2);
begin
  if not ((select private.sets_prices()) or (select private.can_take_payment())) then
    raise exception 'Only the doctor, the matron, the Front Desk or the admin sees the bill' using errcode = '42501';
  end if;
  -- A look at what the patient took is written down, as every look is.
  insert into public.activity_log (actor_id, action, table_name, record_id, patient_id)
  values ((select auth.uid()), 'read', 'bill_statement', patient::text, patient);

  select * into stay from public.admissions where patient_id = patient and discharged_at is null;
  if not found then
    return jsonb_build_object('admitted', false);
  end if;

  -- Medicines: doses given after the last bill of this stay (or admission).
  select coalesce(max(medicines_until), stay.admitted_at) into since
  from public.bills where admission_id = stay.id and status <> 'voided';

  select coalesce(jsonb_agg(jsonb_build_object(
           'medicine', m.medicine, 'doses', counted.n, 'dose_price', m.dose_price,
           'amount', counted.n * m.dose_price) order by m.medicine), '[]'::jsonb)
  into medicines
  from public.patient_medications m
  join lateral (
    select count(*) as n from public.medications_given g
    where g.medication_id = m.id and g.voided_at is null and g.not_given_reason is null
      and g.given_at > since
  ) counted on counted.n > 0
  where m.patient_id = patient and m.voided_at is null and m.dose_price is not null;

  -- Prescriptions of the stay not on a bill: the payment if paid, else the
  -- doctor's prices.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'at', p.prescribed_at, 'paid', p.payment_id is not null,
           'drugs', (select string_agg(concat_ws(' ', i.drug, i.strength), ', ')
                     from public.prescription_items i where i.prescription_id = p.id),
           'amount', coalesce((select pay.amount from public.payments pay
                               where pay.id = p.payment_id and pay.voided_at is null),
                              (select sum(i.price) from public.prescription_items i
                               where i.prescription_id = p.id)))
         order by p.prescribed_at), '[]'::jsonb)
  into prescriptions
  from public.prescriptions p
  where p.patient_id = patient and p.status <> 'voided' and p.prescribed_at >= stay.admitted_at
    and not exists (select 1 from public.bills b
                    where b.patient_id = patient and b.status <> 'voided'
                      and p.id = any (b.covers_prescriptions));

  -- Lab tests of the stay not on a bill, the same way.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'at', r.requested_at, 'paid', r.payment_id is not null,
           'tests', array_to_string(r.tests, ', '),
           'amount', coalesce((select pay.amount from public.payments pay
                               where pay.id = r.payment_id and pay.voided_at is null),
                              (select sum(price.value::numeric)
                               from jsonb_each_text(coalesce(r.prices, '{}'::jsonb)) price)))
         order by r.requested_at), '[]'::jsonb)
  into labs
  from public.lab_requests r
  where r.patient_id = patient and r.status <> 'voided' and r.requested_at >= stay.admitted_at
    and not exists (select 1 from public.bills b
                    where b.patient_id = patient and b.status <> 'voided'
                      and r.id = any (b.covers_labs));

  -- The bills of this stay.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'at', b.created_at, 'status', b.status,
           'total', (select sum(l.amount) from public.bill_lines l where l.bill_id = b.id))
         order by b.created_at), '[]'::jsonb),
         coalesce(sum((select sum(l.amount) from public.bill_lines l where l.bill_id = b.id)), 0)
  into bills, billed
  from public.bills b
  where b.admission_id = stay.id and b.status <> 'voided';

  -- Paid since admission: deposits, bills, and covered prescriptions and lab
  -- tests paid on their own (a bill's own payment is counted once, as a bill).
  select coalesce(sum(amount), 0) into deposits
  from public.payments
  where patient_id = patient and purpose = 'deposit' and voided_at is null
    and received_at >= stay.admitted_at;

  select coalesce(sum(pay.amount), 0) into bills_paid
  from public.bills b join public.payments pay on pay.id = b.payment_id
  where b.admission_id = stay.id and b.status = 'paid' and pay.voided_at is null;

  select coalesce(sum(pay.amount), 0) into paid_apart
  from public.payments pay
  where pay.voided_at is null and pay.purpose <> 'bill'
    and (pay.id in (select p.payment_id from public.prescriptions p, public.bills b
                    where b.admission_id = stay.id and b.status <> 'voided'
                      and p.id = any (b.covers_prescriptions))
      or pay.id in (select r.payment_id from public.lab_requests r, public.bills b
                    where b.admission_id = stay.id and b.status <> 'voided'
                      and r.id = any (b.covers_labs)));

  return jsonb_build_object(
    'admitted', true,
    'admission_id', stay.id,
    'admitted_at', stay.admitted_at,
    'medicines', medicines,
    'prescriptions', prescriptions,
    'labs', labs,
    'bills', bills,
    'billed', billed,
    'deposits', deposits,
    'paid', deposits + bills_paid + paid_apart,
    'balance', billed - (deposits + bills_paid + paid_apart)
  );
end;
$$;


create or replace function private.dispense_prescription(prescription bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.prescriptions;
  item record;
  line_id bigint;
  how_many numeric;
begin
  if not (select private.has_permission('pharmacy')) then
    raise exception 'Only the Pharmacy can dispense' using errcode = '42501';
  end if;
  select * into wanted from public.prescriptions where id = prescription for update;
  if not found then
    raise exception 'No such prescription' using errcode = '22023';
  end if;
  if wanted.status = 'dispensed' then
    return 'already_dispensed';
  end if;
  -- Not paid yet is no longer a reason to wait (request 232): the drug is
  -- given, and the Front Desk still sees it as owed until the money is taken.
  if wanted.status = 'voided' then
    raise exception 'This prescription was cancelled' using errcode = '22023';
  end if;

  update public.prescriptions
  set status = 'dispensed', dispensed_at = now(), dispensed_by = (select auth.uid())
  where id = prescription;

  -- Into the current medications, written in the prescribing doctor's name.
  insert into public.patient_medications (patient_id, medicine, dose, how_often, added_by)
  select wanted.patient_id,
         left(i.drug || coalesce(' ' || i.strength, ''), 160),
         left(i.dose, 120),
         left(i.how_often || coalesce(', ' || i.days || ' days', ''), 120),
         wanted.prescribed_by
  from public.prescription_items i
  where i.prescription_id = prescription;

  -- Out of stock: counted lines only (2026-11-16).
  for item in
    select drug, strength, quantity from public.prescription_items where prescription_id = prescription
  loop
    how_many := nullif(substring(coalesce(item.quantity, '') from '^\s*([0-9]+(?:\.[0-9]+)?)'), '')::numeric;
    if how_many is null or how_many <= 0 then
      continue;
    end if;
    select id into line_id from public.medicine_list
    where lower(trim(name)) = lower(trim(item.drug))
      and lower(coalesce(trim(strength), '')) = lower(coalesce(trim(item.strength), ''))
      and status = 'standard' and in_stock is not null
    limit 1;
    if line_id is null then
      continue;
    end if;
    perform pg_advisory_xact_lock(hashtext('stock:' || line_id::text));
    update public.medicine_list set in_stock = in_stock - how_many where id = line_id;
    insert into public.stock_moves (medicine_id, change, reason, prescription_id)
    values (line_id, -how_many, 'dispensed', prescription);
  end loop;
  return 'dispensed';
end;
$$;


drop function public.return_to_store(bigint, integer);
drop function private.return_to_store(bigint, integer);
delete from public.chart_dispenses where returned;
alter table public.chart_dispenses drop column returned;

alter table public.patient_medications drop column prescription_id;

drop function public.set_admitted_on(bigint, date);
drop function private.set_admitted_on(bigint, date);
