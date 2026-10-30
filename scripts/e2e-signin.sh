#!/usr/bin/env bash
# =============================================================================
# e2e-signin.sh: start a throwaway Supabase, add two made up nurses, build
# the app against it, serve it, and run scripts/e2e-signin.mjs.
#
# Runs in CI (GitHub's computer). Needs Docker and the Supabase CLI.
#
# Never: run against the hospital's projects. Everything here is local and
# thrown away when the job ends.
# =============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

# ===== 1. Throwaway Supabase: database, sign in, API, live updates and the mailbox =====
supabase start -x studio,storage-api,imgproxy,edge-runtime,logflare,vector,postgres-meta,supavisor
eval "$(supabase status -o env)"
KEY="${PUBLISHABLE_KEY:-${ANON_KEY:-}}"
SECRET="${SERVICE_ROLE_KEY:-${SECRET_KEY:-}}"
MAILPIT="${MAILPIT_URL:-${INBUCKET_URL:-http://127.0.0.1:54324}}"
test -n "$KEY" && test -n "$SECRET" || { echo "Local keys not found"; exit 1; }

# ===== 2. Two made up nurses and a front desk: a sign in account each, then a staff row =====
# Only an invited email can get a sign in account (Admin, 2026-10-30), so
# each one is invited first. invited1 is left waiting: the walk through
# signs in with it from the invitation link.
psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
insert into public.staff_invites (email, full_name, role) values
  ('nurse1@test.rhema',   'Test Nurse One',    'nurse'),
  ('nurse2@test.rhema',   'Test Nurse Two',    'nurse'),
  ('desk1@test.rhema',    'Test Desk One',     'front_desk'),
  ('invited1@test.rhema', 'Test Invited One',  'laboratory');
SQL
for who in nurse1 nurse2 desk1; do
  curl -fsS -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SECRET" -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
    -d "{\"email\":\"$who@test.rhema\",\"email_confirm\":true}" > /dev/null
done
psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
-- These three are set up by hand below, so their invitations are used.
update public.staff_invites set status = 'accepted', accepted_at = now()
where email in ('nurse1@test.rhema', 'nurse2@test.rhema', 'desk1@test.rhema');

insert into public.staff (id, full_name, email, role)
select id, case email when 'nurse1@test.rhema' then 'Test Nurse One' else 'Test Nurse Two' end, email, 'nurse'
from auth.users where email in ('nurse1@test.rhema', 'nurse2@test.rhema');

-- For Call attention: a front desk person, at the Front Desk.
insert into public.staff (id, full_name, email, role, room_id)
select id, 'Test Desk One', email, 'front_desk', (select id from public.rooms where name = 'Front Desk')
from auth.users where email = 'desk1@test.rhema';

-- For the home screen: Nurse One works in Consultant Room 1, one made up
-- patient waits there, and another waits at the pharmacy.
update public.staff set room_id = (select id from public.rooms where name = 'Consultant Room 1')
where email = 'nurse1@test.rhema';
insert into public.patients (full_name, date_of_birth, sex, created_by)
select name, '1980-02-02', 'male', (select id from public.staff where email = 'nurse1@test.rhema')
from (values ('Made Up Patient A'), ('Made Up Patient B')) as made_up(name);
insert into public.queue_entries (patient_id, room_id, note, sent_by)
select p.id, r.id, case when p.full_name like '%A' then 'Please see him first' end,
       (select id from public.staff where email = 'nurse1@test.rhema')
from public.patients p
join public.rooms r on r.name = case when p.full_name like '%A' then 'Consultant Room 1' else 'Pharmacy' end
where p.full_name like 'Made Up Patient %';
SQL

# ===== 3. Build the app against the throwaway Supabase and serve it =====
NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$KEY" npm run build
python3 -m http.server 3000 --bind 127.0.0.1 --directory web/out > /dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

# ===== 4. Walk through sign in =====
APP_URL="http://127.0.0.1:3000" MAILPIT_URL="$MAILPIT" node scripts/e2e-signin.mjs
