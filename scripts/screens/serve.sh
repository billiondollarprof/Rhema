#!/usr/bin/env bash
# =============================================================================
# screens/serve.sh: build the app against a fake Supabase address and serve
# it on http://127.0.0.1:3100, for screenshots and the overflow check.
#
# Why: screenshots use made up data from scripts/screens/mock.cjs, never a
# real database, so no patient data can ever end up in a picture.
#
# Usage: scripts/screens/serve.sh   (builds, then serves in the background)
#        NEXT_PUBLIC_BRAND=mascap scripts/screens/serve.sh   (a pitch brand)
# =============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$HERE/web"
NEXT_PUBLIC_SUPABASE_URL=http://fake-supabase.local \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fake \
  npx next build > /dev/null
# A pitch brand (request 150): its icons go into the build.
if [ -n "${NEXT_PUBLIC_BRAND:-}" ]; then (cd "$HERE" && node scripts/pitch-brand.mjs "$NEXT_PUBLIC_BRAND" > /dev/null); fi
# Stop an old server on 3100, by its process id. Only a process whose own
# command is exactly "python3 -m http.server 3100 ..." is matched, so this
# script can never stop itself (pkill and grep on the text both did).
old="$(ps -eo pid=,args= | awk '$2 ~ /python3$/ && $3 == "-m" && $4 == "http.server" && $5 == "3100" {print $1}')"
if [ -n "$old" ]; then kill $old; fi
nohup python3 -m http.server 3100 --bind 127.0.0.1 --directory "$HERE/web/out" > /dev/null 2>&1 &
sleep 1
echo "Serving the screens build on http://127.0.0.1:3100"
