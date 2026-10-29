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

# ===== 1. Throwaway Supabase: database, sign in, API and the mailbox =====
supabase start -x studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,postgres-meta,supavisor
eval "$(supabase status -o env)"
KEY="${PUBLISHABLE_KEY:-${ANON_KEY:-}}"
SECRET="${SERVICE_ROLE_KEY:-${SECRET_KEY:-}}"
MAILPIT="${MAILPIT_URL:-${INBUCKET_URL:-http://127.0.0.1:54324}}"
test -n "$KEY" && test -n "$SECRET" || { echo "Local keys not found"; exit 1; }

# ===== 2. Two made up nurses: a sign in account each, then a staff row =====
for n in 1 2; do
  curl -fsS -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SECRET" -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
    -d "{\"email\":\"nurse$n@test.rhema\",\"email_confirm\":true}" > /dev/null
done
psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
insert into public.staff (id, full_name, email, role)
select id, case email when 'nurse1@test.rhema' then 'Test Nurse One' else 'Test Nurse Two' end, email, 'nurse'
from auth.users where email in ('nurse1@test.rhema', 'nurse2@test.rhema');
SQL

# ===== 3. Build the app against the throwaway Supabase and serve it =====
NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$KEY" npm run build
python3 -m http.server 3000 --bind 127.0.0.1 --directory web/out > /dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

# ===== 4. Walk through sign in =====
APP_URL="http://127.0.0.1:3000" MAILPIT_URL="$MAILPIT" node scripts/e2e-signin.mjs
