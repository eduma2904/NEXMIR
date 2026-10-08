-- Cambia el límite diario del Plan Free de 2 a 5 batallas.
create or replace function public.nexmir_battle_join_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.battle_rooms%rowtype; used integer;
begin
  if auth.uid() is null or new.user_id<>auth.uid() then raise exception 'Solo puedes unirte con tu propia cuenta.' using errcode='42501'; end if;
  if exists(select 1 from public.battle_participants where room_id=new.room_id and user_id=new.user_id) then return new; end if;
  select * into r from public.battle_rooms where id=new.room_id for update;
  if not found or r.status<>'waiting' then raise exception 'La batalla ya inició o no está disponible.' using errcode='P0001'; end if;
  if (select count(*) from public.battle_participants where room_id=new.room_id)>=2 then raise exception 'La sala ya tiene dos jugadores.' using errcode='P0001'; end if;
  if not public.nexmir_plan_is_unlimited(new.user_id) then
    select count(*) into used from public.battle_participants where user_id=new.user_id and (joined_at at time zone 'America/Lima')::date=(now() at time zone 'America/Lima')::date;
    if used>=5 then raise exception 'Plan Free: alcanzaste el límite de 5 batallas de hoy.' using errcode='P0001'; end if;
  end if;
  new.display_name:=left(coalesce(nullif(btrim(new.display_name),''),'Jugador'),80);
  new.score:=0;new.correct:=0;new.answered:=0;new.finished_at:=null;new.joined_at:=now();
  return new;
end;
$$;
