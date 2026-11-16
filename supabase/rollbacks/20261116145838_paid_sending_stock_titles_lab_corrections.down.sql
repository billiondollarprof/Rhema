-- =============================================================================
-- Undo for 20261116145838_paid_sending_stock_titles_lab_corrections.sql
--
-- Removes the new functions, the stock moves, the stock columns, the note
-- titles and the lab read rule, and puts dispense_prescription and
-- record_lab_results back as they were. Stock counts and note titles typed
-- on live are lost, so on live this needs Anthony's explicit yes in writing.
-- =============================================================================

drop function if exists public.cancel_lab_result(bigint, text);
drop function if exists private.cancel_lab_result(bigint, text);
drop function if exists public.add_lab_result(bigint, jsonb);
drop function if exists private.add_lab_result(bigint, jsonb);
drop policy if exists lab_results_read_by_lab on public.lab_results;
alter table public.consultation_notes drop column if exists title;
alter table public.nursing_notes drop column if exists title;
drop function if exists public.move_stock(bigint, numeric, text, text);
drop function if exists private.move_stock(bigint, numeric, text, text);
drop function if exists public.set_stock_settings(bigint, text, numeric);
drop function if exists private.set_stock_settings(bigint, text, numeric);
drop table if exists public.stock_moves;
alter table public.medicine_list drop column if exists low_level;
alter table public.medicine_list drop column if exists in_stock;
alter table public.medicine_list drop column if exists unit;
drop function if exists public.send_paid_to_pharmacy(bigint, jsonb, uuid, text);
drop function if exists private.send_paid_to_pharmacy(bigint, jsonb, uuid, text);
drop function if exists public.send_paid_to_lab(bigint, text[], uuid, text);
drop function if exists private.send_paid_to_lab(bigint, text[], uuid, text);

-- dispense_prescription and record_lab_results as they were: re-run their
-- sections from 20261031151251_pharmacy.sql (section 8) and
-- 20261030164236_laboratory.sql (section 7) by hand if this undo is ever used.
