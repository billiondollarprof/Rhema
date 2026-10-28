-- =============================================================================
-- Undo for 20261028120000_foundation.sql
--
-- Removes everything the foundation migration created, in reverse order.
-- Only for use before real patients exist. Once the hospital is live, this
-- file would destroy records, so it must never be run against the live
-- database without Anthony's explicit yes in writing.
-- =============================================================================

drop table if exists public.activity_log;
drop table if exists public.patients;
drop table if exists public.families;
drop table if exists public.staff;
drop table if exists public.rooms;

drop function if exists private.write_activity();
drop function if exists private.touch_updated_at();
drop function if exists private.protect_patient_number();
drop function if exists private.next_patient_number();
drop function if exists private.is_admin();
drop function if exists private.has_permission(text);
drop function if exists private.is_active_staff();
drop function if exists private.set_default_permissions();
drop sequence if exists private.patient_number_seq;

drop type if exists public.patient_category;
drop type if exists public.patient_sex;
drop type if exists public.room_kind;
drop type if exists public.staff_role;

drop schema if exists private;
