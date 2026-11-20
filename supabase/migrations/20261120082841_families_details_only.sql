-- =============================================================================
-- 20261120082841_families_details_only.sql
--
-- What this is: a follow-up to 20261120072145_family_file_first, found in
-- the review of 2026-11-20. The Front Desk changes only a family's name,
-- phone and address, never the date it was registered or who registered
-- it; and a family is only ever made with a member (register_family) or
-- from a member (start_family), never on its own.
--
-- Why: Anthony, 2026-11-20 (request 230): "all the security is intact.
-- There are no loopholes." Since 2026-10-28 a signed in person could change
-- any column of a family, or add an empty family, by calling the database
-- directly (the screens never did). The family number was already guarded.
--
-- Rules:
--   - Update: name, phone, address, town, lga, state and country only.
--   - Insert: nobody directly. register_family and start_family run with
--     the owner's rights and check the Front Desk themselves.
--   - Reading does not change.
--
-- Never: let a family's registration date, its author or its number be
-- changed, or let a family be made with nobody in it.
-- =============================================================================


-- ===== 1. Change the family's details only =====
revoke update on public.families from authenticated;
grant update (name, phone, address, town, lga, state, country) on public.families to authenticated;


-- ===== 2. No family made directly =====
revoke insert on public.families from authenticated;
drop policy families_write on public.families;
