-- =============================================================================
-- Undo for 20261116051615_antenatal_visits_and_client.sql
--
-- Removes the visit table and the new booking details. Visits and those
-- details are lost, so only before the hospital has used them.
-- =============================================================================

drop table if exists public.antenatal_visits;

alter table public.antenatal_bookings
  drop column if exists client_marital_status,
  drop column if exists client_religion,
  drop column if exists client_education,
  drop column if exists client_occupation,
  drop column if exists client_tribe,
  drop column if exists history_asked,
  drop column if exists history_yes,
  drop column if exists surgery_type,
  drop column if exists surgery_reason;
