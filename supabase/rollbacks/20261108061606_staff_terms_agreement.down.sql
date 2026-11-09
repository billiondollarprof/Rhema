-- Undo for 20261108061606_staff_terms_agreement.sql: removes the function
-- and the two columns. The agreements recorded are lost, so this is only
-- for taking the change back before anybody has agreed.
drop function if exists public.agree_to_terms(text);
drop function if exists private.agree_to_terms(text);
alter table public.staff
  drop column if exists terms_agreed_at,
  drop column if exists terms_version;
