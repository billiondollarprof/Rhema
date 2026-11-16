-- =============================================================================
-- Undo for 20261116060435_more_starter_medicines_and_doses.sql
--
-- Removes only the starter lines this migration added that nobody has used
-- or confirmed yet: medicine lines still marked "starter", and dose lines
-- still marked "starter" with nobody attached. A line the Pharmacy confirmed
-- (source now "pharmacy") stays. Puts the old dose order back.
-- Deleting rows on live needs Anthony's explicit yes in writing.
-- =============================================================================

delete from public.pick_options o
where o.list = 'dose' and o.source = 'starter'
  and o.position between 25 and 75
  and not exists (select 1 from public.pick_option_users u where u.option_id = o.id);

update public.pick_options set position = 20 where list = 'dose' and source = 'starter' and key = private.vital_key('100 mg');
update public.pick_options set position = 21 where list = 'dose' and source = 'starter' and key = private.vital_key('250 mg');
update public.pick_options set position = 22 where list = 'dose' and source = 'starter' and key = private.vital_key('500 mg');
update public.pick_options set position = 23 where list = 'dose' and source = 'starter' and key = private.vital_key('1 g');
update public.pick_options set position = 24 where list = 'dose' and source = 'starter' and key = private.vital_key('As directed');

-- The medicine lines from this migration are those created after the first
-- starter list, still marked starter and never confirmed.
delete from public.medicine_list m
where m.source = 'starter' and m.confirmed_at is null
  and m.created_at > (select min(created_at) + interval '1 minute' from public.medicine_list where source = 'starter');
