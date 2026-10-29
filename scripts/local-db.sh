#!/usr/bin/env bash
# =============================================================================
# local-db.sh: start the local test database, then run every migration and
# every database test on a fresh copy.
#
# Why: the local Postgres stopped twice on 2026-10-29 and had to be started
# by hand. This starts it (or creates it the first time), so an agent never
# has to remember the commands.
#
# Usage:
#   scripts/local-db.sh            start it, then run all the database tests
#   scripts/local-db.sh --start    only start it
#
# It uses a throwaway database called rhema_local on port 54329. Never point
# it anywhere else.
# =============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
ROOT="${RHEMA_PG:-/var/tmp/rhema-pg}"
PORT=54329
URL="postgresql://postgres@127.0.0.1:$PORT/rhema_local"

as_postgres() { if [ "$(id -u)" = 0 ]; then su postgres -c "$1"; else bash -c "$1"; fi; }

# ===== 1. Create the database folder the first time =====
if [ ! -f "$ROOT/data/PG_VERSION" ]; then
  echo "== Creating the local database in $ROOT"
  mkdir -p "$ROOT"
  [ "$(id -u)" = 0 ] && chown postgres "$ROOT"
  as_postgres "$PGBIN/initdb -D $ROOT/data -U postgres --auth=trust > /dev/null"
fi

# ===== 2. Start it if it is not running =====
if ! "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PORT" -q; then
  echo "== Starting the local database on port $PORT"
  as_postgres "$PGBIN/pg_ctl -D $ROOT/data -l $ROOT/log -o '-p $PORT' -w start > /dev/null"
fi
[ "${1:-}" = "--start" ] && { echo "Local database is running on port $PORT."; exit 0; }

# ===== 3. A fresh copy, then every migration and test =====
psql "postgresql://postgres@127.0.0.1:$PORT/postgres" -q \
  -c "drop database if exists rhema_local" -c "create database rhema_local" > /dev/null
"$HERE/scripts/db-test.sh" "$URL" --plain
