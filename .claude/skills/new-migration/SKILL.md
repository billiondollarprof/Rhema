---
name: new-migration
description: Make a database change the Rhema way - the migration, its undo file and its tests from a template with revoke all and RLS already in, run them on the local database, and prove the tests catch deliberate breaks. Use whenever a table, function, policy or grant changes.
---

# new-migration

Every database change comes as three files: the change, the SQL that takes
it back (the undo file), and the tests. CLAUDE.md section 10.

## Steps

1. **Make the three files:**
   ```
   scripts/new-migration.sh <short_name>
   ```
   The migration starts with `revoke all`, RLS on, and only the grants it
   needs. Keep those lines.
2. **Fill them in.** Header first (what, why with Anthony's words and the
   date, rules, never). Then the SQL, numbered sections. The undo file
   removes everything the migration adds. The tests prove who can and who
   cannot, as made up people.
3. **Run everything on the local database:**
   ```
   scripts/local-db.sh
   ```
   It starts the database if it stopped, runs every migration and every
   test, then the undo files and the migrations again. All must pass.
4. **Prove the tests catch faults.** Break the migration on purpose, in at
   least five ways that matter (drop a permission check, allow another
   person's name, remove the double action guard, open a policy to all):
   ```
   scripts/mutate.sh supabase/migrations/<file>.sql 's/<right>/<wrong>/' ...
   ```
   Every line must say CAUGHT. NOT CAUGHT means write a test for it, then
   run this again. The script always puts the migration back.
5. **Show Anthony the SQL batch before it reaches any real database**
   (CLAUDE.md section 2): each statement, one plain line on what it does,
   and whether it writes. One yes covers the batch.
6. After his yes, use the `ship` skill.

## The local database behaves like Supabase

`supabase/tests/local_shim.sql` copies the Supabase habits that matter for
tests: `auth.uid()`, the `anon` and `authenticated` roles, and full rights
on every new table. So a missing `revoke all` fails here too, not only in
CI. If CI ever finds something the local run did not, add that habit to
the shim.

## If the skill itself goes wrong

- `local-db.sh` cannot start Postgres: check `PGBIN` (default
  `/usr/lib/postgresql/16/bin`). In a fresh container it creates the
  database itself the first time.
- `mutate.sh` says NO CHANGE: the sed expression matched nothing. Fix the
  expression.
- If a script is wrong, fix it in the same change and say so.
