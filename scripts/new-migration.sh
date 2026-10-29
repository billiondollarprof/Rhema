#!/usr/bin/env bash
# =============================================================================
# new-migration.sh: make the three files every database change needs.
#
#   supabase/migrations/<time>_<name>.sql        the change itself
#   supabase/rollbacks/<time>_<name>.down.sql    the SQL that takes it back
#   supabase/tests/<next number>_<name>.sql      the tests that prove it
#
# Why: every migration ships with its undo file and its tests (CLAUDE.md
# section 10), and every new table must start with "revoke all" and RLS on.
# On 2026-10-29 one table went to testing without "revoke all". The
# template below has it already, so it cannot be forgotten again.
#
# Usage:  scripts/new-migration.sh <short_name_with_underscores>
# Then fill in the three files, run scripts/local-db.sh, and prove the tests
# with scripts/mutate.sh.
# =============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:?Give a short name, e.g. lab_requests}"
[[ "$NAME" =~ ^[a-z0-9_]+$ ]] || { echo "Use lower case letters, numbers and _ only"; exit 2; }

STAMP="$(date -u +%Y%m%d%H%M%S)"
# Migrations run in name order, so a new one must sort after the newest one
# already there (some were named with a later time of day than the clock).
NEWEST="$(ls "$HERE/supabase/migrations" | sort | tail -1 | cut -c1-14)"
if [[ -n "$NEWEST" && "$STAMP" < "$NEWEST" || "$STAMP" == "$NEWEST" ]]; then
  STAMP="$((NEWEST + 100))"
fi
LAST_TEST="$(ls "$HERE/supabase/tests" | grep -E '^[0-9]{3}_' | sort | tail -1 | cut -c1-3)"
NEXT_TEST="$(printf '%03d' $((10#${LAST_TEST:-0} + 1)))"
UP="$HERE/supabase/migrations/${STAMP}_${NAME}.sql"
DOWN="$HERE/supabase/rollbacks/${STAMP}_${NAME}.down.sql"
TEST="$HERE/supabase/tests/${NEXT_TEST}_${NAME}.sql"

cat > "$UP" <<SQL
-- =============================================================================
-- ${STAMP}_${NAME}.sql
--
-- What this is: (one or two lines)
--
-- Why: (Anthony's words and the date)
--
-- Rules:
--   - (who can read, who can write, what can never happen)
--
-- Never: (the one thing this must never allow)
-- =============================================================================


-- ===== 1. The table =====

create table public.${NAME} (
  id          bigint generated always as identity primary key,
  created_by  uuid not null default auth.uid() references public.staff (id),
  created_at  timestamptz not null default now()
);

-- Supabase gives every new table full rights. Take them all away first,
-- then give back only what this table needs.
revoke all on public.${NAME} from anon, authenticated;
alter table public.${NAME} enable row level security;

grant select, insert on public.${NAME} to authenticated;


-- ===== 2. Who can read and write =====

create policy ${NAME}_read on public.${NAME}
  for select to authenticated
  using ((select private.is_active_staff()));

create policy ${NAME}_insert on public.${NAME}
  for insert to authenticated
  with check ((select private.is_active_staff()) and created_by = (select auth.uid()));


-- ===== 3. The activity log =====

create trigger ${NAME}_activity
  after insert or update on public.${NAME}
  for each row execute function private.write_activity();
SQL

cat > "$DOWN" <<SQL
-- =============================================================================
-- Undo for ${STAMP}_${NAME}.sql
--
-- (What this removes. If it would lose real data on live, say that it needs
-- Anthony's explicit yes in writing.)
-- =============================================================================

drop table if exists public.${NAME};
SQL

cat > "$TEST" <<SQL
-- =============================================================================
-- ${NEXT_TEST}_${NAME}.sql: tests for ${NAME}.
--
-- What this is: proves (who can do what, and who cannot).
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\\set ON_ERROR_STOP on
begin;

-- ===== Setup: made up staff =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000${NEXT_TEST}1', 't${NEXT_TEST}-one@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-00000000${NEXT_TEST}1', 'Test One', 't${NEXT_TEST}-one@test.rhema', 'nurse');


-- ===== 1. Nobody holds rights they should not have =====
do \$\$
begin
  if has_table_privilege('anon', 'public.${NAME}', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL 1: the public has rights on ${NAME}';
  end if;
  if has_table_privilege('authenticated', 'public.${NAME}', 'UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL 1: signed in users can change or delete ${NAME}';
  end if;
end \$\$;
\\echo 'PASS 1: nobody holds rights they should not have'


-- ===== 2. (the next thing to prove) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000${NEXT_TEST}1"}', true);
set local role authenticated;
-- (do the thing as this person)
reset role;
\\echo 'PASS 2: (what it proved)'

rollback;
SQL

echo "Made:"
echo "  ${UP#$HERE/}"
echo "  ${DOWN#$HERE/}"
echo "  ${TEST#$HERE/}"
