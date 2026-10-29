#!/usr/bin/env bash
# =============================================================================
# mutate.sh: prove the tests catch faults, by breaking a migration on
# purpose and checking a test fails each time.
#
# Why: a test that passes whatever the code does protects nothing. On
# 2026-10-29 two deliberate breaks got past the Call attention tests, and
# new tests were added for them. This runs that check in one command.
#
# Usage:
#   scripts/mutate.sh <migration file> '<sed expression>' ['<sed expr>' ...]
# Example:
#   scripts/mutate.sh supabase/migrations/2026..._x.sql \
#     's/and s.is_active/and true/' 's/interval .30 seconds./interval '"'"'0 seconds'"'"'/'
#
# For each break it prints CAUGHT (a test failed, good) or NOT CAUGHT (the
# tests missed it: write a test for it). The migration is always put back,
# even if the script is stopped half way. It exits 1 if any break was missed.
# =============================================================================
set -uo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:?Give the migration file first}"
shift
[ "$#" -gt 0 ] || { echo "Give at least one sed expression"; exit 2; }

BACKUP="$(mktemp)"
cp "$FILE" "$BACKUP"
trap 'cp "$BACKUP" "$FILE"; rm -f "$BACKUP"' EXIT

"$HERE/scripts/local-db.sh" --start > /dev/null
missed=0
for expr in "$@"; do
  cp "$BACKUP" "$FILE"
  sed -i "$expr" "$FILE"
  if cmp -s "$BACKUP" "$FILE"; then
    echo "NO CHANGE    $expr   (the expression matched nothing: fix it)"
    missed=1
    continue
  fi
  first_fail="$("$HERE/scripts/local-db.sh" 2>&1 | grep -m1 -E 'FAIL|ERROR')"
  if [ -n "$first_fail" ]; then
    echo "CAUGHT       $expr"
    echo "             ${first_fail##*ERROR:  }"
  else
    echo "NOT CAUGHT   $expr"
    missed=1
  fi
done
cp "$BACKUP" "$FILE"
"$HERE/scripts/local-db.sh" > /dev/null 2>&1 && echo "Back to normal: every test passes again." || { echo "The tests fail on the restored file. Look before going on."; exit 1; }
exit "$missed"
