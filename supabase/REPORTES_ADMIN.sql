-- Ejecutar después de ERRORES_Y_REPORTES.sql.
-- Garantiza que el panel admin pueda listar los reportes enviados.
create or replace function public.nexmir_list_question_reports()
returns setof public.question_reports
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','moderator')) then
    raise exception 'Solo administración puede ver los reportes';
  end if;
  return query select * from public.question_reports order by created_at desc limit 500;
end $$;
grant execute on function public.nexmir_list_question_reports() to authenticated;
