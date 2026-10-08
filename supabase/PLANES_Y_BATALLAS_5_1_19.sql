-- NEXMIR V5.1.19 · Planes Free/Pro y Batallas 1 vs 1.
-- Ejecutar una vez en Supabase > SQL Editor después de EDICION_CONTENIDO.sql.
-- Es aditivo e idempotente: no elimina usuarios, preguntas ni progreso.
begin;

create extension if not exists pgcrypto;

-- ============================================================
-- 1) HISTORIAL DE SIMULACROS
-- Algunos proyectos antiguos aún no tienen esta tabla. La aplicación la usa
-- para guardar Mini-MIR, simulacros completos y calcular los límites del plan.
-- ============================================================
create table if not exists public.simulations(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Simulacro',
  mode text not null default 'mini',
  question_ids uuid[] not null default '{}'::uuid[],
  total integer not null default 0 check(total>=0),
  correct integer not null default 0 check(correct>=0),
  incorrect integer not null default 0 check(incorrect>=0),
  blank integer not null default 0 check(blank>=0),
  net_score numeric(8,2),
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now()
);
create index if not exists simulations_user_finished_idx on public.simulations(user_id,finished_at desc);
alter table public.simulations enable row level security;
drop policy if exists simulations_select_self on public.simulations;
create policy simulations_select_self on public.simulations for select to authenticated using(user_id=auth.uid());
drop policy if exists simulations_insert_self on public.simulations;
create policy simulations_insert_self on public.simulations for insert to authenticated with check(user_id=auth.uid());
grant select,insert on public.simulations to authenticated;

-- ============================================================
-- 2) PLAN FREE/PRO
-- ============================================================
alter table public.profiles add column if not exists plan text not null default 'free';
update public.profiles set plan='free' where plan is null or lower(plan) not in ('free','pro');

do $$ begin
  if not exists(select 1 from pg_constraint where conname='profiles_plan_check' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_plan_check check(plan in ('free','pro'));
  end if;
end $$;

create or replace function public.nexmir_plan_is_unlimited(p_user uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.profiles
    where id=p_user and (lower(coalesce(plan,'free'))='pro' or role in ('admin','moderator'))
  );
$$;
revoke all on function public.nexmir_plan_is_unlimited(uuid) from public,anon,authenticated;

create or replace function public.nexmir_enforce_free_plan()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  u uuid:=coalesce(new.user_id,auth.uid());
  used integer:=0;
  today_lima date:=(now() at time zone 'America/Lima')::date;
begin
  if u is null or public.nexmir_plan_is_unlimited(u) then return new; end if;

  if tg_table_name='user_question_attempts' and coalesce(new.mode,'')='bank' then
    select count(*) into used from public.user_question_attempts
      where user_id=u and mode='bank' and (answered_at at time zone 'America/Lima')::date=today_lima;
    if used>=15 then raise exception 'Plan Free: alcanzaste el límite de 15 preguntas de banqueo de hoy.' using errcode='P0001'; end if;
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

drop trigger if exists nexmir_free_attempt_limit on public.user_question_attempts;
create trigger nexmir_free_attempt_limit before insert on public.user_question_attempts
for each row execute function public.nexmir_enforce_free_plan();
drop trigger if exists nexmir_free_review_limit on public.user_flashcard_reviews;
create trigger nexmir_free_review_limit before insert or update of last_reviewed_at on public.user_flashcard_reviews
for each row execute function public.nexmir_enforce_free_plan();
drop trigger if exists nexmir_free_simulation_limit on public.simulations;
create trigger nexmir_free_simulation_limit before insert on public.simulations
for each row execute function public.nexmir_enforce_free_plan();

-- ============================================================
-- 3) BATALLAS 1 VS 1
-- ============================================================
create table if not exists public.battle_rooms(
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(code ~ '^[A-Z0-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check(status in ('waiting','active','completed','cancelled')),
  question_ids uuid[] not null check(cardinality(question_ids) between 5 and 50),
  question_sources text[] not null default '{}'::text[],
  duration_seconds integer not null default 600 check(duration_seconds between 180 and 3600),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
-- Si una versión anterior ya instaló Batallas, se pausa el guardián mientras
-- se completa el origen de sus preguntas existentes.
drop trigger if exists nexmir_battle_room_guard on public.battle_rooms;
alter table public.battle_rooms add column if not exists question_sources text[] not null default '{}'::text[];
update public.battle_rooms set question_sources=array_fill('questions'::text,array[cardinality(question_ids)])
where cardinality(question_sources)=0 and cardinality(question_ids)>0;
create index if not exists battle_rooms_code_status_idx on public.battle_rooms(code,status);
create index if not exists battle_rooms_host_created_idx on public.battle_rooms(host_user_id,created_at desc);

create table if not exists public.battle_participants(
  room_id uuid not null references public.battle_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Jugador' check(char_length(display_name) between 1 and 80),
  score integer not null default 0 check(score>=0),
  correct integer not null default 0 check(correct>=0),
  answered integer not null default 0 check(answered>=0),
  joined_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key(room_id,user_id)
);
create index if not exists battle_participants_user_joined_idx on public.battle_participants(user_id,joined_at desc);

create table if not exists public.battle_answers(
  room_id uuid not null references public.battle_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null,
  source_type text not null default 'questions' check(source_type in ('questions','remnote')),
  selected_index integer not null check(selected_index>=0),
  is_correct boolean not null default false,
  answered_at timestamptz not null default now(),
  primary key(room_id,user_id,question_id),
  foreign key(room_id,user_id) references public.battle_participants(room_id,user_id) on delete cascade
);
alter table public.battle_answers add column if not exists source_type text not null default 'questions';
alter table public.battle_answers drop constraint if exists battle_answers_question_id_fkey;
create index if not exists battle_answers_room_user_idx on public.battle_answers(room_id,user_id,answered_at);

create or replace function public.nexmir_battle_member(p_room uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.battle_participants where room_id=p_room and user_id=auth.uid());
$$;
revoke all on function public.nexmir_battle_member(uuid) from public,anon;
grant execute on function public.nexmir_battle_member(uuid) to authenticated;

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
    if used>=2 then raise exception 'Plan Free: alcanzaste el límite de 2 batallas de hoy.' using errcode='P0001'; end if;
  end if;
  new.display_name:=left(coalesce(nullif(btrim(new.display_name),''),'Jugador'),80);
  new.score:=0;new.correct:=0;new.answered:=0;new.finished_at:=null;new.joined_at:=now();
  return new;
end;
$$;

create or replace function public.nexmir_battle_room_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare i integer; option_count integer; correct_count integer;
begin
  if tg_op='INSERT' then
    if auth.uid() is null or new.host_user_id<>auth.uid() then raise exception 'El anfitrión debe ser tu propia cuenta.' using errcode='42501'; end if;
    if cardinality(new.question_sources)=0 then new.question_sources:=array_fill('questions'::text,array[cardinality(new.question_ids)]); end if;
    if cardinality(new.question_sources)<>cardinality(new.question_ids) or cardinality(new.question_ids) not between 5 and 50 then
      raise exception 'La selección de preguntas de batalla no es válida.' using errcode='P0001';
    end if;
    for i in 1..cardinality(new.question_ids) loop
      option_count:=null;correct_count:=null;
      if new.question_sources[i]='questions' then
        select jsonb_array_length(options),case when correct_index>=0 and correct_index<jsonb_array_length(options) then 1 else 0 end
          into option_count,correct_count from public.questions
          where id=new.question_ids[i] and status='published';
      elsif new.question_sources[i]='remnote' then
        select jsonb_array_length(payload->'options'),
          (select count(*) from jsonb_array_elements(payload->'options') o where coalesce(o->>'correct','false')='true')
          into option_count,correct_count from public.content_items
          where id=new.question_ids[i] and status='published' and kind='card'
            and coalesce(card_type::text,payload->>'type')='multiple_choice';
      else
        raise exception 'Origen de pregunta no permitido.' using errcode='P0001';
      end if;
      if coalesce(option_count,0)<2 or coalesce(correct_count,0)<>1 then
        raise exception 'La batalla contiene una pregunta no publicada o incompleta.' using errcode='P0001';
      end if;
    end loop;
    new.code:=upper(new.code);new.status:='waiting';new.started_at:=null;new.finished_at:=null;return new;
  end if;
  if old.status='active' and new.status='completed'
     and new.host_user_id is not distinct from old.host_user_id
     and new.code is not distinct from old.code
     and new.question_ids is not distinct from old.question_ids
     and new.question_sources is not distinct from old.question_sources
     and new.duration_seconds is not distinct from old.duration_seconds
     and not exists(select 1 from public.battle_participants where room_id=old.id and finished_at is null) then
    new.finished_at:=coalesce(new.finished_at,now());return new;
  end if;
  if auth.uid() is null or old.host_user_id<>auth.uid() then raise exception 'Solo el anfitrión puede iniciar la batalla.' using errcode='42501'; end if;
  if new.host_user_id is distinct from old.host_user_id or new.code is distinct from old.code or new.question_ids is distinct from old.question_ids or new.question_sources is distinct from old.question_sources or new.duration_seconds is distinct from old.duration_seconds then
    raise exception 'No se puede modificar la configuración de una sala creada.' using errcode='P0001';
  end if;
  if old.status='waiting' and new.status='active' then
    if (select count(*) from public.battle_participants where room_id=old.id)<>2 then raise exception 'La batalla requiere exactamente dos jugadores.' using errcode='P0001'; end if;
    new.started_at:=now();new.finished_at:=null;return new;
  end if;
  if old.status='waiting' and new.status='cancelled' then new.finished_at:=now();return new;end if;
  raise exception 'Cambio de estado de batalla no permitido.' using errcode='P0001';
end;
$$;

create or replace function public.nexmir_battle_answer_guard()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.battle_rooms%rowtype; correct_option integer; option_count integer;
begin
  if auth.uid() is null or new.user_id<>auth.uid() then raise exception 'Solo puedes responder con tu propia cuenta.' using errcode='42501'; end if;
  select * into r from public.battle_rooms where id=new.room_id for update;
  if not found or r.status<>'active' or r.started_at is null then raise exception 'La batalla no está activa.' using errcode='P0001'; end if;
  if now()>=r.started_at+make_interval(secs=>r.duration_seconds) then raise exception 'El tiempo de la batalla terminó.' using errcode='P0001'; end if;
  new.source_type:=coalesce(nullif(new.source_type,''),'questions');
  if not exists(
    select 1 from generate_subscripts(r.question_ids,1) i
    where r.question_ids[i]=new.question_id and r.question_sources[i]=new.source_type
  ) then raise exception 'La pregunta no pertenece a esta batalla.' using errcode='P0001'; end if;
  if new.source_type='questions' then
    select correct_index,jsonb_array_length(options) into correct_option,option_count
      from public.questions where id=new.question_id and status='published';
  elsif new.source_type='remnote' then
    select (select (o.ordinality-1)::integer from jsonb_array_elements(c.payload->'options') with ordinality o(value,ordinality)
              where coalesce(o.value->>'correct','false')='true' order by o.ordinality limit 1),
           jsonb_array_length(c.payload->'options')
      into correct_option,option_count from public.content_items c
      where c.id=new.question_id and c.status='published' and c.kind='card'
        and coalesce(c.card_type::text,c.payload->>'type')='multiple_choice';
  else
    raise exception 'Origen de pregunta no permitido.' using errcode='P0001';
  end if;
  if not found or new.selected_index<0 or new.selected_index>=option_count then raise exception 'Respuesta no válida.' using errcode='P0001'; end if;
  new.is_correct:=(new.selected_index=correct_option);new.answered_at:=now();return new;
end;
$$;

create or replace function public.nexmir_battle_score_sync()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare total integer; answered_count integer;
begin
  select cardinality(question_ids) into total from public.battle_rooms where id=new.room_id;
  select count(*) into answered_count from public.battle_answers where room_id=new.room_id and user_id=new.user_id;
  update public.battle_participants set
    answered=answered_count,
    correct=(select count(*) from public.battle_answers where room_id=new.room_id and user_id=new.user_id and is_correct),
    score=10*(select count(*) from public.battle_answers where room_id=new.room_id and user_id=new.user_id and is_correct),
    finished_at=case when answered_count>=total then coalesce(finished_at,now()) else finished_at end
  where room_id=new.room_id and user_id=new.user_id;
  if (select count(*) from public.battle_participants where room_id=new.room_id)=2
     and not exists(select 1 from public.battle_participants where room_id=new.room_id and finished_at is null) then
    update public.battle_rooms set status='completed',finished_at=now() where id=new.room_id and status='active';
  end if;
  return new;
end;
$$;

drop trigger if exists nexmir_battle_room_guard on public.battle_rooms;
create trigger nexmir_battle_room_guard before insert or update on public.battle_rooms for each row execute function public.nexmir_battle_room_guard();
drop trigger if exists nexmir_battle_join_guard on public.battle_participants;
create trigger nexmir_battle_join_guard before insert on public.battle_participants for each row execute function public.nexmir_battle_join_guard();
drop trigger if exists nexmir_battle_answer_guard on public.battle_answers;
create trigger nexmir_battle_answer_guard before insert on public.battle_answers for each row execute function public.nexmir_battle_answer_guard();
drop trigger if exists nexmir_battle_score_sync on public.battle_answers;
create trigger nexmir_battle_score_sync after insert on public.battle_answers for each row execute function public.nexmir_battle_score_sync();

alter table public.battle_rooms enable row level security;
alter table public.battle_participants enable row level security;
alter table public.battle_answers enable row level security;

-- Las versiones antiguas de Batallas pudieron crear políticas con nombres
-- diferentes. Una política RESTRICTIVE residual seguiría bloqueando INSERT
-- aunque la política actual fuese correcta. Limpiamos únicamente las políticas
-- de las tres tablas de batalla antes de instalar el conjunto vigente.
do $$
declare p record;
begin
  for p in
    select schemaname,tablename,policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('battle_rooms','battle_participants','battle_answers')
  loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $$;

drop policy if exists battle_rooms_read_authenticated on public.battle_rooms;
create policy battle_rooms_read_authenticated on public.battle_rooms for select to authenticated using(status in ('waiting','active','completed') or host_user_id=auth.uid());
drop policy if exists battle_rooms_create_self on public.battle_rooms;
create policy battle_rooms_create_self on public.battle_rooms for insert to authenticated with check(host_user_id=auth.uid());
drop policy if exists battle_rooms_update_host on public.battle_rooms;
create policy battle_rooms_update_host on public.battle_rooms for update to authenticated using(host_user_id=auth.uid()) with check(host_user_id=auth.uid());
drop policy if exists battle_rooms_delete_waiting_host on public.battle_rooms;
create policy battle_rooms_delete_waiting_host on public.battle_rooms for delete to authenticated using(host_user_id=auth.uid() and status='waiting');

drop policy if exists battle_participants_read_members on public.battle_participants;
create policy battle_participants_read_members on public.battle_participants for select to authenticated using(
  user_id=auth.uid() or public.nexmir_battle_member(room_id)
);
drop policy if exists battle_participants_join_self on public.battle_participants;
create policy battle_participants_join_self on public.battle_participants for insert to authenticated with check(user_id=auth.uid());

drop policy if exists battle_answers_read_members on public.battle_answers;
create policy battle_answers_read_members on public.battle_answers for select to authenticated using(
  public.nexmir_battle_member(room_id)
);
drop policy if exists battle_answers_insert_self on public.battle_answers;
create policy battle_answers_insert_self on public.battle_answers for insert to authenticated with check(user_id=auth.uid());

grant select,insert,update,delete on public.battle_rooms to authenticated;
grant select,insert on public.battle_participants to authenticated;
grant select,insert on public.battle_answers to authenticated;

revoke all on function public.nexmir_battle_join_guard() from public,anon,authenticated;
revoke all on function public.nexmir_battle_room_guard() from public,anon,authenticated;
revoke all on function public.nexmir_battle_answer_guard() from public,anon,authenticated;
revoke all on function public.nexmir_battle_score_sync() from public,anon,authenticated;

commit;
notify pgrst,'reload schema';
