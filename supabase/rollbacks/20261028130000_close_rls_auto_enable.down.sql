-- Undo for 20261028130000_close_rls_auto_enable.sql: gives everyone (public), anon and
-- authenticated back the right to call public.rls_auto_enable(), if it exists.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    grant execute on function public.rls_auto_enable() to public, anon, authenticated;
  end if;
end $$;
