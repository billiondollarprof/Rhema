#!/usr/bin/env bash
# =============================================================================
# db-test.sh: prove the database changes work, and can be undone.
#
# What it does, in order:
#   1. (plain Postgres only) loads the Supabase stand-in;
#   2. applies every migration, oldest first (skipped with --tests-only);
#   3. runs every test in supabase/tests;
#   4. applies every undo file, newest first, then every migration again,
#      to prove each change can be taken back and redone cleanly.
# It stops at the first failure.
#
# Usage:
#   scripts/db-test.sh <database-url> --plain        plain Postgres (local)
#   scripts/db-test.sh <database-url> --tests-only   a local Supabase that has
#                                                    already applied the
#                                                    migrations (CI)
#
# Never point this at the hospital's live database. Step 4 removes and
# recreates every table.
# =============================================================================
set -euo pipefail

DB_URL="${1:?Give the database URL as the first argument}"
MODE="${2:?Give --plain or --tests-only as the second argument}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

# ===== Safety: refuse anything that looks like a hosted Supabase database =====
if [[ "$DB_URL" == *"supabase.co"* || "$DB_URL" == *"supabase.com"* ]]; then
  echo "Refusing: this looks like a hosted Supabase database. Throwaway databases only."
  exit 1
fi

# -o /dev/null hides query results; \echo lines (PASS and FAIL) still show.
run() { psql "$DB_URL" -v ON_ERROR_STOP=1 -q -o /dev/null -f "$1"; }

apply_migrations() {
  for file in "$HERE"/supabase/migrations/*.sql; do
    echo "   up:   $(basename "$file")"
    run "$file"
  done
}

# ===== 1. Supabase stand-in ===================================================
if [[ "$MODE" == "--plain" ]]; then
  echo "== Loading the Supabase stand-in (plain Postgres)"
  run "$HERE/supabase/tests/local_shim.sql"
fi

# ===== 2. Migrations ==========================================================
if [[ "$MODE" == "--plain" ]]; then
  echo "== Applying migrations"
  apply_migrations
fi

# ===== 3. Tests ===============================================================
echo "== Running tests"
for file in "$HERE"/supabase/tests/[0-9]*.sql; do
  echo "-- $(basename "$file")"
  run "$file"
done

# ===== 4. Undo everything, then redo it =======================================
echo "== Proving every change can be undone"
for file in $(ls -r "$HERE"/supabase/rollbacks/*.down.sql); do
  echo "   down: $(basename "$file")"
  run "$file"
done
apply_migrations
echo "== Undo and redo worked"
