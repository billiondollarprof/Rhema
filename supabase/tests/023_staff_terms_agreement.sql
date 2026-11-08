-- =============================================================================
-- 023_staff_terms_agreement.sql: tests for staff_terms_agreement.
--
-- What this is: proves a person can record only their own agreement, that
-- nobody can write the columns straight, that a switched off account or
-- somebody signed out cannot agree, and that a bad version is refused.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'nurse1@terms.rhema'),
  ('00000000-0000-0000-0000-0000000000f2', 'nurse2@terms.rhema'),
  ('00000000-0000-0000-0000-0000000000f3', 'gone@terms.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'Terms Nurse One', 'nurse1@terms.rhema', 'nurse'),
  ('00000000-0000-0000-0000-0000000000f2', 'Terms Nurse Two', 'nurse2@terms.rhema', 'nurse'),
  ('00000000-0000-0000-0000-0000000000f3', 'Terms Gone', 'gone@terms.rhema', 'nurse');
update public.staff set is_active = false where id = '00000000-0000-0000-0000-0000000000f3';


-- ===== 1. A new person has not agreed yet ====================================
do $$
begin
  if (select terms_agreed_at from public.staff where email = 'nurse1@terms.rhema') is not null then
    raise exception 'FAIL 1: a new person already shows an agreement';
  end if;
end $$;
\echo 'PASS 1: a new person has not agreed yet'


-- ===== 2. Nurse One records her own agreement, and only hers =================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1"}', true);
set local role authenticated;
do $$
begin
  if not public.agree_to_terms('2026-11-08') then
    raise exception 'FAIL 2: the agreement was not saved';
  end if;
end $$;
reset role;
do $$
begin
  if (select terms_version from public.staff where email = 'nurse1@terms.rhema') is distinct from '2026-11-08'
     or (select terms_agreed_at from public.staff where email = 'nurse1@terms.rhema') is null then
    raise exception 'FAIL 2: Nurse One''s agreement is not on her row';
  end if;
  if (select terms_agreed_at from public.staff where email = 'nurse2@terms.rhema') is not null then
    raise exception 'FAIL 2: Nurse One''s tick reached Nurse Two';
  end if;
end $$;
\echo 'PASS 2: a person records only their own agreement'


-- ===== 3. Nobody can write the columns straight ==============================
do $$
begin
  if has_column_privilege('authenticated', 'public.staff', 'terms_agreed_at', 'update')
     or has_column_privilege('authenticated', 'public.staff', 'terms_version', 'update')
     or has_column_privilege('authenticated', 'public.staff', 'terms_agreed_at', 'insert') then
    raise exception 'FAIL 3: the app can write the agreement columns straight';
  end if;
  if not has_column_privilege('authenticated', 'public.staff', 'terms_version', 'select') then
    raise exception 'FAIL 3: staff cannot read the agreement';
  end if;
end $$;
\echo 'PASS 3: the agreement can only be written through agree_to_terms'


-- ===== 4. A bad version is refused ==========================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2"}', true);
set local role authenticated;
do $$
begin
  if public.agree_to_terms('anything') or public.agree_to_terms(null) then
    raise exception 'FAIL 4: a bad version was saved';
  end if;
end $$;
reset role;
\echo 'PASS 4: a bad version is refused'


-- ===== 5. A switched off account cannot agree ================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3"}', true);
set local role authenticated;
do $$
begin
  if public.agree_to_terms('2026-11-08') then
    raise exception 'FAIL 5: a switched off account agreed';
  end if;
end $$;
reset role;
\echo 'PASS 5: a switched off account cannot agree'


-- ===== 6. Somebody signed out can do nothing =================================
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  perform public.agree_to_terms('2026-11-08');
  raise exception 'FAIL 6: somebody signed out could agree';
exception when insufficient_privilege then
  null;
end $$;
reset role;
do $$
begin
  if has_function_privilege('anon', 'public.agree_to_terms(text)', 'execute')
     or has_function_privilege('anon', 'private.agree_to_terms(text)', 'execute') then
    raise exception 'FAIL 6: somebody signed out may call agree_to_terms';
  end if;
end $$;
\echo 'PASS 6: somebody signed out can do nothing'

rollback;
