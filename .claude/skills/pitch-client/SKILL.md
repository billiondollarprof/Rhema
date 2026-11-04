---
name: pitch-client
description: Show the TESTING site as another hospital for a pitch - its name, its letters as the mark and its app icons - or put Rhema back. Automations (coming soon) is in the menu on every build. Use when Anthony says "we are pitching <hospital>", "change testing to <name>", or "put Rhema back on testing".
---

# pitch-client

Anthony, 2026-11-04 (request 150): "anytime we want to pitch a new client,
you hide the Rema stuff and put the name of the client."

## What it touches

Only the testing site. The live site is always Rhema: deploy.yml sets the
brand for the testing branch only. The testing database is not touched, so
the made up patients stay (their numbers still start RMC).

## Steps

1. **Add the client** to `BRANDS` in `web/lib/brand/brand.ts`: key (lower
   case, no spaces), name ("MASCAP Medical Centre"), short ("MASCAP"),
   initials ("MA"), address (empty if unknown).
2. **Make its icons:**
   ```
   node scripts/brand-icons.cjs <key> <LETTERS>
   ```
   Then copy `web/brands/mascap/manifest.webmanifest` to
   `web/brands/<key>/` and change its name and short_name.
3. **Choose it for testing:** set `"brand": "<key>"` in `ops/pitch.json`.
   `"rhema"` puts Rhema back.
4. **Look at it** before pushing:
   ```
   NEXT_PUBLIC_BRAND=<key> scripts/screens/serve.sh
   ```
   Sign in card, top bar, menu (Automations), Automations, Install, the
   receipt and the idle screen: the client's name and letters, no RHEMA.
5. `npm run verify`, then push to testing with the `ship` skill. Do not
   merge a brand change to main: main ignores it anyway, but say so in the
   report.

## If it goes wrong

- "No files for <key>": step 2 was skipped.
- The tab still says Rhema: `NEXT_PUBLIC_BRAND` was not set for the build;
  check the "Choose the hospital shown on testing" step in deploy.yml.
