-- NEXMIR HOTFIX 5.1.39
-- Error corregido: 'record "new" has no field "mode"' al guardar un repaso de flashcards con plan Free.
-- Causa: en nexmir_enforce_free_plan(), la condicion
--   tg_table_name='user_question_attempts' and coalesce(new.mode,'')='bank'
-- se planifica contra el tipo de fila de la tabla que dispara el trigger. PL/pgSQL no garantiza
-- cortocircuito, asi que en user_flashcard_reviews (que no tiene columna "mode") fallaba.
-- Solucion: separar por tabla con IF anidados, para que new.mode / new.total solo se evaluen
-- dentro de la rama de su propia tabla.
-- Ejecutar una vez en Supabase > SQL Editor. Es seguro repetirlo.

create or replace function public.nexmir_enforce_free_plan()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  u uuid:=coalesce(new.user_id,auth.uid());
  used integer:=0;
  today_lima date:=(now() at time zone 'America/Lima')::date;
begin
  if u is null or public.nexmir_plan_is_unlimited(u) then return new; end if;

  if tg_table_name='user_question_attempts' then
    if coalesce(new.mode,'')='bank' then
      select count(*) into used from public.user_question_attempts
        where user_id=u and mode='bank' and (answered_at at time zone 'America/Lima')::date=today_lima;
      if used>=15 then raise exception 'Plan Free: alcanzaste el límite de 15 preguntas de banqueo de hoy.' using errcode='P0001'; end if;
    end if;

  elsif tg_table_name='user_flashcard_reviews' then
    if tg_op='UPDATE' and old.last_reviewed_at is not null and (old.last_reviewed_at at time zone 'America/Lima')::date=today_lima then return new; end if;
    select count(*) into used from public.user_flashcard_reviews
      where user_id=u and (last_reviewed_at at time zone 'America/Lima')::date=today_lima;
    if used>=20 then raise exception 'Plan Free: alcanzaste el límite de 20 flashcards de hoy.' using errcode='P0001'; end if;

  elsif tg_table_name='simulations' then
    if coalesce(new.mode,'')<>'mini' or coalesce(new.total,0)>15 then
      raise exception 'Plan Free: los simulacros personalizados y completos requieren Pro.' using errcode='P0001';
    end if;
    select count(*) into used from public.simulations
      where user_id=u and mode='mini' and total<=15 and (finished_at at time zone 'America/Lima')::date=today_lima;
    if used>=1 then raise exception 'Plan Free: ya completaste el Mini-MIR de hoy.' using errcode='P0001'; end if;
  end if;

  return new;
end;
$$;
revoke all on function public.nexmir_enforce_free_plan() from public,anon,authenticated;

-- Los triggers ya apuntan a esta funcion; se recrean por si acaso.
drop trigger if exists nexmir_free_attempt_limit on public.user_question_attempts;
create trigger nexmir_free_attempt_limit before insert on public.user_question_attempts
for each row execute function public.nexmir_enforce_free_plan();
drop trigger if exists nexmir_free_review_limit on public.user_flashcard_reviews;
create trigger nexmir_free_review_limit before insert or update of last_reviewed_at on public.user_flashcard_reviews
for each row execute function public.nexmir_enforce_free_plan();
drop trigger if exists nexmir_free_simulation_limit on public.simulations;
create trigger nexmir_free_simulation_limit before insert on public.simulations
for each row execute function public.nexmir_enforce_free_plan();
