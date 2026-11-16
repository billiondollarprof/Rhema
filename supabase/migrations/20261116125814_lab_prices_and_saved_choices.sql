-- =============================================================================
-- 20261116125814_lab_prices_and_saved_choices.sql
--
-- What this is, three parts:
--   1. Price changes for lab tests: the Laboratory proposes a price, the admin
--      approves or refuses it, and a price nobody answered becomes standard
--      on its own after 72 hours.
--   2. Saving a typed Other line for everybody at once (a tick on the screen),
--      next to the old way (standard when a second person types it).
--   3. Words typed with Other inside a lab test's box (for example a titre
--      that was not on the list) are kept for that box, for everybody.
--
-- Why: Anthony, 2026-11-16 (requests 208 and 209), and his yes to the SQL:
--   "the lab scientist can add/edit price of any test and the admin approves
--   it and it becomes the standard price. But if admin hasn't approved it
--   after 72hrs, make the price standard regardless."
--   "every place there's Other, make it so that they can save that type of
--   test or medication as part of the lists... when they add a new test they
--   should be able to save it as standard."
--   "even under a test, if there is a type they can add."
--
-- Rules:
--   - Only the Laboratory (can_lab) or an admin proposes a lab test price.
--     Only an admin approves or refuses. Nobody writes these tables by hand.
--   - A newer proposal for the same test replaces an older one still waiting.
--   - The same person proposing the same price for the same test twice within
--     3 minutes is refused (money: CLAUDE.md section 10), with a lock so two
--     taps at the same moment cannot both pass.
--   - Every change is in the activity log.
--
-- Never: let a refused price become standard. Never hold anything about a
-- patient in these tables.
-- =============================================================================


-- ===== 1. Price changes the Laboratory proposes =====
create table public.price_changes (
  id          bigint generated always as identity primary key,
  kind        text not null default 'lab_test' check (kind = 'lab_test'),
  item        text not null check (length(trim(item)) between 2 and 120),
  amount      numeric(12, 2) not null check (amount > 0 and amount < 100000000),
  -- waiting: for the admin. approved: by the admin. automatic: 72 hours
  -- passed with no answer. refused: by the admin. replaced: a newer proposal
  -- for the same test came in.
  status      text not null default 'waiting'
              check (status in ('waiting', 'approved', 'automatic', 'refused', 'replaced')),
  proposed_by uuid not null default auth.uid() references public.staff (id),
  proposed_at timestamptz not null default now(),
  decided_by  uuid references public.staff (id),
  decided_at  timestamptz
);

create index price_changes_waiting_idx on public.price_changes (status, proposed_at);
create index price_changes_item_idx on public.price_changes (kind, lower(trim(item)));

revoke all on public.price_changes from anon, authenticated;
alter table public.price_changes enable row level security;
grant select on public.price_changes to authenticated;

create policy price_changes_read on public.price_changes
  for select to authenticated
  using ((select private.is_active_staff()));

create trigger price_changes_activity after insert or update on public.price_changes
  for each row execute function private.write_activity();


-- ===== 2. Make a price standard (used by approve and by the 72 hours) =====
create function private.make_price_standard(p_change bigint, p_status text, p_by uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  change public.price_changes;
begin
  select * into change from public.price_changes where id = p_change for update;
  if change.id is null or change.status <> 'waiting' then
    return;
  end if;
  update public.price_changes
  set status = p_status, decided_by = p_by, decided_at = now()
  where id = p_change;
  insert into public.price_list (kind, item, amount, updated_by)
  values (change.kind, trim(change.item), change.amount, change.proposed_by)
  on conflict (kind, lower(trim(item))) do update
    set amount = excluded.amount, updated_by = excluded.updated_by, updated_at = now()
    where public.price_list.amount is distinct from excluded.amount;
end;
$$;

revoke execute on function private.make_price_standard(bigint, text, uuid) from public, anon, authenticated;


-- ===== 3. The Laboratory proposes a price =====
create function private.propose_price(p_item text, p_amount numeric)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  clean_item text := regexp_replace(trim(coalesce(p_item, '')), '\s+', ' ', 'g');
  new_id bigint;
begin
  if not (private.has_permission('lab') or (select private.is_admin())) then
    raise exception 'Only the Laboratory or an admin proposes a lab test price.' using errcode = '42501';
  end if;
  if length(clean_item) < 2 then
    raise exception 'Name the test.' using errcode = '22023';
  end if;
  -- One proposal at a time per test, even with two taps at the same moment.
  perform pg_advisory_xact_lock(hashtext('price_change:' || lower(clean_item)));
  if exists (
    select 1 from public.price_changes
    where proposed_by = me and lower(trim(item)) = lower(clean_item)
      and amount = round(p_amount, 2) and proposed_at > now() - interval '3 minutes'
  ) then
    raise exception 'already proposed' using errcode = '23505';
  end if;
  -- A newer proposal replaces one still waiting for the same test.
  update public.price_changes
  set status = 'replaced', decided_at = now()
  where kind = 'lab_test' and lower(trim(item)) = lower(clean_item) and status = 'waiting';
  insert into public.price_changes (kind, item, amount, proposed_by)
  values ('lab_test', clean_item, round(p_amount, 2), me)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function private.propose_price(text, numeric) from public, anon;
grant  execute on function private.propose_price(text, numeric) to authenticated;

create function public.propose_price(p_item text, p_amount numeric)
returns bigint language sql security invoker set search_path = ''
as $$ select private.propose_price(p_item, p_amount); $$;

revoke execute on function public.propose_price(text, numeric) from public, anon;
grant  execute on function public.propose_price(text, numeric) to authenticated;


-- ===== 4. The admin approves or refuses =====
create function private.decide_price(p_change bigint, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not (select private.is_admin()) then
    raise exception 'Only an admin approves prices.' using errcode = '42501';
  end if;
  if p_approve then
    perform private.make_price_standard(p_change, 'approved', me);
  else
    update public.price_changes
    set status = 'refused', decided_by = me, decided_at = now()
    where id = p_change and status = 'waiting';
  end if;
end;
$$;

revoke execute on function private.decide_price(bigint, boolean) from public, anon;
grant  execute on function private.decide_price(bigint, boolean) to authenticated;

create function public.decide_price(p_change bigint, p_approve boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.decide_price(p_change, p_approve); $$;

revoke execute on function public.decide_price(bigint, boolean) from public, anon;
grant  execute on function public.decide_price(bigint, boolean) to authenticated;


-- ===== 5. After 72 hours with no answer, the price becomes standard =====
-- Run by the backup job every 2 hours (.github/workflows/backup.yml), so a
-- price is standard at most 2 hours after its 72 hours are up.
create function private.apply_due_prices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due record;
  applied integer := 0;
begin
  for due in
    select id from public.price_changes
    where status = 'waiting' and proposed_at <= now() - interval '72 hours'
    order by proposed_at
  loop
    perform private.make_price_standard(due.id, 'automatic', null);
    applied := applied + 1;
  end loop;
  return applied;
end;
$$;

revoke execute on function private.apply_due_prices() from public, anon, authenticated;


-- ===== 6. Save a typed Other line for everybody at once =====
-- Same as use_pick_option, then the line is standard straight away.
create function private.save_pick_option_for_everybody(p_list text, p_label text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved text;
begin
  saved := private.use_pick_option(p_list, p_label);
  update public.pick_options
  set standard = true
  where list = p_list and key = private.vital_key(saved) and not standard;
  return saved;
end;
$$;

revoke execute on function private.save_pick_option_for_everybody(text, text) from public, anon;
grant  execute on function private.save_pick_option_for_everybody(text, text) to authenticated;

create function public.save_pick_option_for_everybody(p_list text, p_label text)
returns text language sql security invoker set search_path = ''
as $$ select private.save_pick_option_for_everybody(p_list, p_label); $$;

revoke execute on function public.save_pick_option_for_everybody(text, text) from public, anon;
grant  execute on function public.save_pick_option_for_everybody(text, text) to authenticated;


-- ===== 7. Words typed with Other inside a lab test's box =====
create table public.lab_field_choices (
  id         bigint generated always as identity primary key,
  test       text not null check (length(trim(test)) between 2 and 120),
  field      text not null check (length(trim(field)) between 1 and 120),
  label      text not null check (length(trim(label)) between 1 and 200),
  added_by   uuid not null default auth.uid() references public.staff (id),
  created_at timestamptz not null default now()
);

create unique index lab_field_choices_key
  on public.lab_field_choices (lower(trim(test)), lower(trim(field)), lower(trim(label)));

revoke all on public.lab_field_choices from anon, authenticated;
alter table public.lab_field_choices enable row level security;
grant select on public.lab_field_choices to authenticated;

create policy lab_field_choices_read on public.lab_field_choices
  for select to authenticated
  using (private.has_permission('lab') or private.has_permission('medical'));

create trigger lab_field_choices_activity after insert or update on public.lab_field_choices
  for each row execute function private.write_activity();

create function private.add_lab_choice(p_test text, p_field text, p_label text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_label text := regexp_replace(trim(coalesce(p_label, '')), '\s+', ' ', 'g');
  found text;
begin
  if not (private.has_permission('lab') or (select private.is_admin())) then
    raise exception 'Only the Laboratory adds words to a test.' using errcode = '42501';
  end if;
  if length(clean_label) not between 1 and 200 or length(trim(coalesce(p_test, ''))) < 2
     or length(trim(coalesce(p_field, ''))) < 1 then
    raise exception 'Check the test, the box and the words.' using errcode = '22023';
  end if;
  insert into public.lab_field_choices (test, field, label)
  values (trim(p_test), trim(p_field), clean_label)
  on conflict do nothing;
  select label into found from public.lab_field_choices
  where lower(trim(test)) = lower(trim(p_test)) and lower(trim(field)) = lower(trim(p_field))
    and lower(trim(label)) = lower(clean_label);
  return found;
end;
$$;

revoke execute on function private.add_lab_choice(text, text, text) from public, anon;
grant  execute on function private.add_lab_choice(text, text, text) to authenticated;

create function public.add_lab_choice(p_test text, p_field text, p_label text)
returns text language sql security invoker set search_path = ''
as $$ select private.add_lab_choice(p_test, p_field, p_label); $$;

revoke execute on function public.add_lab_choice(text, text, text) from public, anon;
grant  execute on function public.add_lab_choice(text, text, text) to authenticated;
