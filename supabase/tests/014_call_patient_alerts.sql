-- =============================================================================
-- 014_call_patient_alerts.sql: tests for Call patient (request 129).
--
-- What this is: proves that Call in raises one Call patient card for every
-- Front Desk, from the room that called; that the Front Desk can read it
-- and the patient's name, a nurse elsewhere cannot; that other status
-- changes raise nothing; and that nobody can write one by hand.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'cp-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000c2', 'cp-doctor@test.rhema'),
  ('00000000-0000-0000-0000-0000000000c3', 'cp-nurse@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'Cp Desk',   'cp-desk@test.rhema',   'front_desk'),
  ('00000000-0000-0000-0000-0000000000c2', 'Cp Doctor', 'cp-doctor@test.rhema', 'doctor'),
  ('00000000-0000-0000-0000-0000000000c3', 'Cp Nurse',  'cp-nurse@test.rhema',  'nurse');
update public.staff s set room_id = r.id from public.rooms r
where (s.email, r.name) in (('cp-desk@test.rhema', 'Front Desk'),
                            ('cp-doctor@test.rhema', 'Consultant Room 1'),
                            ('cp-nurse@test.rhema', 'Nursing Station 1'));
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Cp Made Up', '1990-01-01', 'female', '00000000-0000-0000-0000-0000000000c1');

-- The desk sends her to Consultant Room 1.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
insert into public.queue_entries (patient_id, room_id)
select p.id, r.id from public.patients p, public.rooms r
where p.full_name = 'Cp Made Up' and r.name = 'Consultant Room 1';
reset role;


-- ===== 1. Call in raises one Call patient card for the Front Desk =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2"}', true);
set local role authenticated;
update public.queue_entries set status = 'in_consultation', called_at = now()
where patient_id = (select id from public.patients where full_name = 'Cp Made Up');
reset role;
do $$
declare
  card public.attention_calls;
begin
  if (select count(*) from public.attention_calls where kind = 'call_patient') <> 1 then
    raise exception 'FAIL 1: Call in did not raise exactly one Call patient card';
  end if;
  select * into card from public.attention_calls where kind = 'call_patient';
  if card.to_kind <> 'front_desk' or card.to_room_id is not null then
    raise exception 'FAIL 1: the card did not go to every Front Desk';
  end if;
  if card.from_room_id is distinct from (select id from public.rooms where name = 'Consultant Room 1') then
    raise exception 'FAIL 1: the card does not say which room is calling';
  end if;
  if card.called_by is distinct from '00000000-0000-0000-0000-0000000000c2' then
    raise exception 'FAIL 1: the card does not say who called';
  end if;
  if card.patient_id is distinct from (select id from public.patients where full_name = 'Cp Made Up') then
    raise exception 'FAIL 1: the card is not for the right patient';
  end if;
end $$;
\echo 'PASS 1: Call in raises one Call patient card for every Front Desk'


-- ===== 2. The Front Desk reads it with the name; a nurse elsewhere does not =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
do $$
begin
  if (select p.full_name from public.attention_calls c join public.patients p on p.id = c.patient_id
      where c.kind = 'call_patient') is distinct from 'Cp Made Up' then
    raise exception 'FAIL 2: the Front Desk could not read the card and the name';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.attention_calls where kind = 'call_patient') then
    raise exception 'FAIL 2: a nurse in another room read the Call patient card';
  end if;
end $$;
reset role;
\echo 'PASS 2: the Front Desk reads it with the name; a nurse elsewhere does not'


-- ===== 3. Other moves raise nothing =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2"}', true);
set local role authenticated;
update public.queue_entries set status = 'lab'
where patient_id = (select id from public.patients where full_name = 'Cp Made Up');
update public.queue_entries set status = 'done', finished_at = now()
where patient_id = (select id from public.patients where full_name = 'Cp Made Up');
reset role;
do $$
begin
  if (select count(*) from public.attention_calls where kind = 'call_patient') <> 1 then
    raise exception 'FAIL 3: a move other than Call in raised a card';
  end if;
end $$;
\echo 'PASS 3: only Call in raises a card'


-- ===== 4. Nobody writes one by hand; a card always names its patient =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1"}', true);
set local role authenticated;
do $$
begin
  insert into public.attention_calls (called_by, to_kind, kind, patient_id)
  values ('00000000-0000-0000-0000-0000000000c1', 'front_desk', 'call_patient', 1);
  raise exception 'FAIL 4: a card was written by hand';
exception when insufficient_privilege then null;
end $$;
reset role;
do $$
begin
  insert into public.attention_calls (called_by, to_kind, kind)
  values ('00000000-0000-0000-0000-0000000000c1', 'front_desk', 'call_patient');
  raise exception 'FAIL 4: a Call patient card without a patient was saved';
exception when check_violation then null;
end $$;
\echo 'PASS 4: nobody writes a card by hand; every card names its patient'

rollback;
