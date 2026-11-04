-- =============================================================================
-- ops/testing-visits.sql: a made up visit history for the TESTING site, so
-- the "Patients seen" chart on Home has something to show.
--
-- Why: request 146 (Anthony, 2026-11-04): "check it that it's working,
-- because even now that we have demo data, the demo data does not even make
-- it work." The chart counts finished visits, and the demo data has none.
--
-- What it adds: finished visits for the 12 demo patients, spread over the
-- last 12 months, more in the last 30 days, and 3 finished today. No open
-- visit is touched, so the queue on Home stays as it is.
--
-- Run by .github/workflows/testing-topup.yml (part: visits), testing only.
-- Once only: if the history is already there, it stops and changes nothing.
--
-- Never: run this on the live database.
-- =============================================================================

\set ON_ERROR_STOP on

-- ===== 0. Once only, and only after the first demo data =====
select exists (select 1 from public.queue_entries where note = 'Routine visit') as done_before \gset
\if :done_before
  \echo 'The visit history is already there. Nothing changed.'
  \q
\endif
select exists (select 1 from public.patients where phone = '08035550801') as seeded \gset
\if :seeded
\else
  \echo 'Refusing: the first demo data (testing-seed.yml) is not there.'
  \q
\endif

begin;

-- As the made up Front Desk, so the activity log names somebody.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000de02"}', true) as acting_as \gset

-- ===== 1. When each visit finished =====
with times as (
  -- Today and the last 30 days: 2 to 6 visits a day (3 today).
  select now() - (day || ' days')::interval - (visit || ' hours')::interval as finished
  from generate_series(0, 30) as day,
       generate_series(1, case when day = 0 then 3 else 2 + (day * 7) % 5 end) as visit
  union all
  -- Months 2 to 12 back: 20 to 40 visits a month.
  select now() - (month || ' months')::interval - ((visit % 28) || ' days')::interval
  from generate_series(2, 12) as month,
       generate_series(1, 20 + (month * 13) % 21) as visit
),
numbered as (
  select finished, row_number() over (order by finished) as n from times
)

-- ===== 2. One finished visit for each, across the patients and rooms =====
insert into public.queue_entries (patient_id, room_id, status, note, sent_by,
                                  created_at, called_at, finished_at)
select p.id, r.id, 'done', 'Routine visit', '00000000-0000-0000-0000-00000000de02',
       numbered.finished - interval '40 minutes',
       numbered.finished - interval '25 minutes',
       numbered.finished
from numbered
join public.patients p
  on p.phone = '080355508' || lpad(((numbered.n % 12) + 1)::text, 2, '0')
join public.rooms r
  on r.name = (array['Consultant Room 1', 'Consultant Room 2', 'Nursing Station 1',
                     'Laboratory', 'Pharmacy'])[(numbered.n % 5) + 1];

commit;

-- ===== 3. Say what was added =====
select count(*) as added from public.queue_entries where note = 'Routine visit' \gset
\echo 'Visit history added:' :added 'finished visits.'
