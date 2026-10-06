-- NEXMIR Focus V1
-- Ejecutar DESPUÉS de EDICION_CONTENIDO.sql, RLS_HARDENING.sql,
-- ERRORES_Y_REPORTES.sql, SUGERENCIAS.sql y PERSONALIZACION_ESTADISTICAS.sql.
-- Migración aditiva e idempotente: no elimina preguntas, intentos ni progreso previo.

create extension if not exists pgcrypto;

-- ============================================================
-- 1) SESIONES FOCUS
-- ============================================================
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_session_id uuid not null,
  duration_target_minutes integer check (duration_target_minutes is null or duration_target_minutes in (5,10,15,25)),
  question_target integer not null default 10 check (question_target > 0 and question_target <= 200),
  subject_filter text,
  topic_filter text,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  completed_at timestamptz,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  total_answered integer not null default 0 check (total_answered >= 0),
  valid_questions integer not null default 0 check (valid_questions >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  recovered_errors integer not null default 0 check (recovered_errors >= 0),
  xp_earned integer not null default 0 check (xp_earned >= 0),
  valid_for_streak boolean not null default false,
  status text not null default 'active' check (status in ('active','completed','abandoned')),
  session_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, client_session_id)
);
create index if not exists focus_sessions_user_status_idx on public.focus_sessions(user_id,status,started_at desc);
create index if not exists focus_sessions_user_completed_idx on public.focus_sessions(user_id,completed_at desc) where completed_at is not null;

-- Nunca aceptar contadores críticos inyectados al crear una sesión.
create or replace function public.nexmir_focus_session_insert_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  new.active_seconds:=0; new.total_answered:=0; new.valid_questions:=0;
  new.correct_count:=0; new.incorrect_count:=0; new.skipped_count:=0;
  new.recovered_errors:=0; new.xp_earned:=0; new.valid_for_streak:=false;
  new.status:='active'; new.completed_at:=null; new.started_at:=now(); new.last_active_at:=now();
  new.created_at:=now(); new.updated_at:=now();
  return new;
end $$;
drop trigger if exists nexmir_focus_session_insert_guard on public.focus_sessions;
create trigger nexmir_focus_session_insert_guard before insert on public.focus_sessions
for each row execute function public.nexmir_focus_session_insert_guard();

-- ============================================================
-- 2) ESTADO DE APRENDIZAJE POR PREGUNTA
-- ============================================================
create table if not exists public.user_question_learning_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('questions','remnote')),
  source_id text not null,
  mastery_score smallint not null default 0 check (mastery_score between 0 and 100),
  last_answered_at timestamptz,
  last_valid_answered_at timestamptz,
  next_review_at timestamptz,
  consecutive_correct integer not null default 0 check (consecutive_correct >= 0),
  consecutive_incorrect integer not null default 0 check (consecutive_incorrect >= 0),
  total_correct integer not null default 0 check (total_correct >= 0),
  total_incorrect integer not null default 0 check (total_incorrect >= 0),
  review_stage integer not null default -1 check (review_stage between -1 and 6),
  last_result boolean,
  high_priority_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,source_type,source_id)
);
create index if not exists uq_learning_due_idx on public.user_question_learning_state(user_id,next_review_at) where next_review_at is not null;
create index if not exists uq_learning_priority_idx on public.user_question_learning_state(user_id,high_priority_review,mastery_score,next_review_at);

-- ============================================================
-- 3) XP EVENT SOURCING
-- ============================================================
create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'QUESTION_CORRECT','QUESTION_INCORRECT','REVIEW_CORRECT','REVIEW_INCORRECT',
    'ERROR_RECOVERED','CONSOLIDATION','FOCUS_COMPLETED','MISSION_COMPLETED',
    'DAILY_MISSIONS_ALL','DAILY_GOAL'
  )),
  source_type text check (source_type is null or source_type in ('questions','remnote')),
  source_id text,
  focus_session_id uuid references public.focus_sessions(id) on delete set null,
  xp_amount integer not null check (xp_amount >= 0 and xp_amount <= 500),
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id,dedupe_key)
);
create index if not exists xp_events_user_created_idx on public.xp_events(user_id,created_at desc);

-- ============================================================
-- 4) RACHA, CONGELADORES, MISIONES, PREFERENCIAS E INTEGRIDAD
-- ============================================================
create table if not exists public.study_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  max_streak integer not null default 0 check (max_streak >= 0),
  last_qualified_date date,
  last_evaluated_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.streak_freezes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  protected_date date not null,
  month_key date not null,
  created_at timestamptz not null default now(),
  unique(user_id,protected_date)
);
create index if not exists streak_freezes_month_idx on public.streak_freezes(user_id,month_key);

create table if not exists public.daily_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_date date not null,
  mission_key text not null,
  mission_type text not null check (mission_type in ('reviews','new_questions','recover_errors','focus_15')),
  target integer not null check (target > 0),
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,mission_date,mission_key)
);
create index if not exists daily_missions_user_date_idx on public.daily_missions(user_id,mission_date desc);

create table if not exists public.user_study_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  reduce_animations boolean not null default false,
  hide_ranking_during_study boolean not null default true,
  one_task_at_a_time boolean not null default true,
  show_timer boolean not null default true,
  reward_sounds boolean not null default false,
  auto_focus boolean not null default false,
  show_progress boolean not null default true,
  split_large_goals boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_study_integrity_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  warning_active boolean not null default false,
  observation_remaining integer not null default 0 check (observation_remaining between 0 and 5),
  observation_fast_count integer not null default 0 check (observation_fast_count between 0 and 5),
  restriction_active boolean not null default false,
  normal_streak integer not null default 0 check (normal_streak between 0 and 5),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5) REUTILIZAR user_study_daily: añadir solo métricas nuevas
-- ============================================================
alter table public.user_study_daily add column if not exists valid_questions integer not null default 0;
alter table public.user_study_daily add column if not exists invalid_questions integer not null default 0;
alter table public.user_study_daily add column if not exists focus_sessions_completed integer not null default 0;
alter table public.user_study_daily add column if not exists active_focus_seconds integer not null default 0;
alter table public.user_study_daily add column if not exists fast_attempts integer not null default 0;
alter table public.user_study_daily add column if not exists pace_warnings integer not null default 0;
alter table public.user_study_daily add column if not exists xp_earned integer not null default 0;
alter table public.user_study_daily add column if not exists errors_recovered integer not null default 0;
alter table public.user_study_daily add column if not exists daily_goal_met boolean not null default false;
alter table public.user_study_daily add column if not exists goal_awarded_at timestamptz;

-- La app existente puede seguir escribiendo SOLO sus columnas no críticas.
revoke insert,update on public.user_study_daily from authenticated;
grant select on public.user_study_daily to authenticated;
grant insert (user_id,activity_date,study_seconds,questions_answered,flashcards_reviewed,simulations_completed,updated_at)
  on public.user_study_daily to authenticated;
grant update (study_seconds,questions_answered,flashcards_reviewed,simulations_completed,updated_at)
  on public.user_study_daily to authenticated;

-- ============================================================
-- 6) EXTENDER INTENTOS SIN DUPLICAR LA TABLA EXISTENTE
-- ============================================================
alter table public.user_question_attempts add column if not exists question_active_time_seconds integer;
alter table public.user_question_attempts add column if not exists fast_attempt boolean not null default false;
alter table public.user_question_attempts add column if not exists is_valid boolean not null default true;
alter table public.user_question_attempts add column if not exists invalid_reason text;
alter table public.user_question_attempts add column if not exists pace_warning_triggered boolean not null default false;
alter table public.user_question_attempts add column if not exists focus_session_id uuid references public.focus_sessions(id) on delete set null;
alter table public.user_question_attempts add column if not exists client_event_id uuid default gen_random_uuid();
alter table public.user_question_attempts add column if not exists review_context text;
alter table public.user_question_attempts add column if not exists xp_awarded integer not null default 0;
alter table public.user_question_attempts add column if not exists mastery_after smallint;
alter table public.user_question_attempts add column if not exists error_recovered boolean not null default false;
create unique index if not exists uq_attempt_client_event_idx on public.user_question_attempts(user_id,client_event_id) where client_event_id is not null;
create index if not exists uq_attempt_user_valid_time_idx on public.user_question_attempts(user_id,is_valid,answered_at desc);
create index if not exists uq_attempt_focus_idx on public.user_question_attempts(focus_session_id,answered_at) where focus_session_id is not null;

-- ============================================================
-- 7) HELPERS BACKEND
-- ============================================================
create or replace function public.nexmir_user_timezone(p_user uuid) returns text
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((select timezone from public.user_study_preferences where user_id=p_user),'UTC')
$$;
revoke all on function public.nexmir_user_timezone(uuid) from public,anon,authenticated;

create or replace function public.nexmir_local_date(p_user uuid, p_at timestamptz default now()) returns date
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare z text;
begin
  z:=public.nexmir_user_timezone(p_user);
  begin return (p_at at time zone z)::date;
  exception when invalid_parameter_value then return (p_at at time zone 'UTC')::date;
  end;
end $$;
revoke all on function public.nexmir_local_date(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.nexmir_add_xp(
  p_user uuid,p_type text,p_amount integer,p_dedupe text,
  p_source_type text default null,p_source_id text default null,
  p_focus uuid default null,p_metadata jsonb default '{}'::jsonb
) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare inserted_amount integer:=0; d date;
begin
  if p_amount<=0 then return 0; end if;
  insert into public.xp_events(user_id,event_type,source_type,source_id,focus_session_id,xp_amount,dedupe_key,metadata)
  values(p_user,p_type,p_source_type,p_source_id,p_focus,p_amount,p_dedupe,coalesce(p_metadata,'{}'::jsonb))
  on conflict(user_id,dedupe_key) do nothing
  returning xp_amount into inserted_amount;
  inserted_amount:=coalesce(inserted_amount,0);
  if inserted_amount>0 then
    d:=public.nexmir_local_date(p_user,now());
    insert into public.user_study_daily(user_id,activity_date,xp_earned,updated_at)
    values(p_user,d,inserted_amount,now())
    on conflict(user_id,activity_date) do update set xp_earned=public.user_study_daily.xp_earned+excluded.xp_earned,updated_at=now();
  end if;
  return inserted_amount;
end $$;
revoke all on function public.nexmir_add_xp(uuid,text,integer,text,text,text,uuid,jsonb) from public,anon,authenticated;

-- ============================================================
-- 8) RACHA Y CONGELADORES
-- ============================================================
create or replace function public.nexmir_refresh_streak_for_user(p_user uuid) returns public.study_streaks
language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.study_streaks%rowtype; today_local date; d date; qualified boolean; used integer; month_start date;
begin
  today_local:=public.nexmir_local_date(p_user,now());
  insert into public.study_streaks(user_id,last_evaluated_date)
  values(p_user,today_local-1)
  on conflict(user_id) do nothing;
  select * into s from public.study_streaks where user_id=p_user for update;
  if s.last_evaluated_date is null then s.last_evaluated_date:=today_local-1; end if;

  d:=s.last_evaluated_date+1;
  while d<today_local loop
    select coalesce((select daily_goal_met from public.user_study_daily where user_id=p_user and activity_date=d),false) into qualified;
    if qualified then
      if s.last_qualified_date is distinct from d then
        s.current_streak:=s.current_streak+1;
        s.max_streak:=greatest(s.max_streak,s.current_streak);
        s.last_qualified_date:=d;
      end if;
    elsif s.current_streak>0 then
      month_start:=date_trunc('month',d)::date;
      select count(*) into used from public.streak_freezes where user_id=p_user and month_key=month_start;
      if used<3 then
        insert into public.streak_freezes(user_id,protected_date,month_key) values(p_user,d,month_start)
        on conflict(user_id,protected_date) do nothing;
      else
        s.current_streak:=0;
      end if;
    end if;
    s.last_evaluated_date:=d;
    d:=d+1;
  end loop;

  select coalesce((select daily_goal_met from public.user_study_daily where user_id=p_user and activity_date=today_local),false) into qualified;
  if qualified and s.last_qualified_date is distinct from today_local then
    s.current_streak:=s.current_streak+1;
    s.max_streak:=greatest(s.max_streak,s.current_streak);
    s.last_qualified_date:=today_local;
  end if;
  s.updated_at:=now();
  update public.study_streaks set current_streak=s.current_streak,max_streak=s.max_streak,last_qualified_date=s.last_qualified_date,
    last_evaluated_date=s.last_evaluated_date,updated_at=s.updated_at where user_id=p_user;
  return s;
end $$;
revoke all on function public.nexmir_refresh_streak_for_user(uuid) from public,anon,authenticated;

create or replace function public.nexmir_refresh_streak() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); s public.study_streaks%rowtype; month_start date; used integer; yesterday date; frozen boolean;
begin
  if u is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  s:=public.nexmir_refresh_streak_for_user(u);
  month_start:=date_trunc('month',public.nexmir_local_date(u,now()))::date;
  select count(*) into used from public.streak_freezes where user_id=u and month_key=month_start;
  yesterday:=public.nexmir_local_date(u,now())-1;
  select exists(select 1 from public.streak_freezes where user_id=u and protected_date=yesterday) into frozen;
  return jsonb_build_object('current_streak',s.current_streak,'max_streak',s.max_streak,'freezes_available',greatest(0,3-used),
    'freezes_used',used,'yesterday_frozen',frozen,'last_qualified_date',s.last_qualified_date);
end $$;
revoke all on function public.nexmir_refresh_streak() from public,anon;
grant execute on function public.nexmir_refresh_streak() to authenticated;

create or replace function public.nexmir_mark_daily_goal_if_met(p_user uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare d date; rowv public.user_study_daily%rowtype; changed boolean:=false; dummy integer;
begin
  d:=public.nexmir_local_date(p_user,now());
  insert into public.user_study_daily(user_id,activity_date,updated_at) values(p_user,d,now()) on conflict(user_id,activity_date) do nothing;
  select * into rowv from public.user_study_daily where user_id=p_user and activity_date=d for update;
  if not rowv.daily_goal_met and (rowv.valid_questions>=15 or rowv.focus_sessions_completed>=1) then
    update public.user_study_daily set daily_goal_met=true,goal_awarded_at=now(),updated_at=now() where user_id=p_user and activity_date=d;
    dummy:=public.nexmir_add_xp(p_user,'DAILY_GOAL',5,'daily-goal:'||d::text,null,null,null,jsonb_build_object('date',d));
    changed:=true;
  end if;
  perform public.nexmir_refresh_streak_for_user(p_user);
  return changed;
end $$;
revoke all on function public.nexmir_mark_daily_goal_if_met(uuid) from public,anon,authenticated;

-- ============================================================
-- 9) ANTIFARMEO + CORRECCIÓN SERVER-SIDE DEL INTENTO
-- ============================================================
create or replace function public.nexmir_prepare_question_attempt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  src text; sid text; correct_idx integer; med numeric; cnt integer; threshold numeric:=4;
  last2 integer:=0; last5 integer:=0; st public.user_study_integrity_state%rowtype;
  today_local date; repeated_today boolean:=false; learning public.user_question_learning_state%rowtype;
  last_same timestamptz; distinct_after integer:=0; focus_answered integer:=0; focus_skipped integer:=0; retry_allowed boolean:=false; learning_exists boolean:=false;
begin
  src:=case when new.question_id is not null then 'questions' else 'remnote' end;
  sid:=coalesce(new.question_id::text,new.source_content_id::text);
  if sid is null then raise exception 'Intento sin pregunta'; end if;

  -- La corrección nunca se confía al frontend.
  if src='questions' then
    select q.correct_index into correct_idx from public.questions q where q.id=new.question_id and q.status='published';
  else
    select coalesce((select (o.ord-1)::integer from jsonb_array_elements(coalesce(c.payload->'options','[]'::jsonb)) with ordinality o(item,ord)
      where lower(coalesce(o.item->>'correct','false'))='true' order by o.ord limit 1),-1)
      into correct_idx from public.content_items c where c.id=new.source_content_id and c.status='published';
  end if;
  if correct_idx is null or correct_idx<0 then raise exception 'Pregunta publicada sin respuesta correcta válida'; end if;
  new.is_correct:=(new.selected_index=correct_idx);
  new.answered_at:=coalesce(new.answered_at,now());
  new.client_event_id:=coalesce(new.client_event_id,gen_random_uuid());
  new.question_active_time_seconds:=case when new.question_active_time_seconds is null then null else greatest(0,new.question_active_time_seconds) end;
  new.is_valid:=coalesce(new.is_valid,true); new.invalid_reason:=null; new.pace_warning_triggered:=false;

  select count(*), percentile_cont(.5) within group(order by x.question_active_time_seconds)
    into cnt,med
  from (select question_active_time_seconds from public.user_question_attempts
        where user_id=new.user_id and is_valid=true and question_active_time_seconds is not null and question_active_time_seconds>=0
        order by answered_at desc limit 30) x;
  if cnt>=30 then threshold:=greatest(4,coalesce(med,20)*.20); else threshold:=4; end if;
  new.fast_attempt:=(new.question_active_time_seconds is not null and new.question_active_time_seconds < threshold);

  -- Repetición manual explotable: el backend deriva el contexto; no confía en la etiqueta del frontend.
  today_local:=public.nexmir_local_date(new.user_id,new.answered_at);
  select * into learning from public.user_question_learning_state where user_id=new.user_id and source_type=src and source_id=sid;
  learning_exists:=found;
  if learning_exists then
    if learning.next_review_at is not null and learning.next_review_at<=new.answered_at then new.review_context:='due';
    elsif learning.last_result is false then new.review_context:='error_retry';
    else new.review_context:='manual'; end if;
  else new.review_context:='new'; end if;

  select max(a.answered_at) into last_same
  from public.user_question_attempts a
  where a.user_id=new.user_id and a.is_valid=true
    and (case when a.question_id is not null then 'questions' else 'remnote' end)=src
    and coalesce(a.question_id::text,a.source_content_id::text)=sid
    and public.nexmir_local_date(new.user_id,a.answered_at)=today_local;
  repeated_today:=last_same is not null;

  if repeated_today then
    retry_allowed:=(learning.next_review_at is not null and learning.next_review_at<=new.answered_at);
    if not retry_allowed and learning.last_result is false and new.focus_session_id is not null then
      select count(distinct coalesce(a.question_id::text,a.source_content_id::text)) into distinct_after
      from public.user_question_attempts a
      where a.user_id=new.user_id and a.is_valid=true and a.answered_at>last_same
        and coalesce(a.question_id::text,a.source_content_id::text)<>sid;
      select total_answered,skipped_count into focus_answered,focus_skipped from public.focus_sessions where id=new.focus_session_id and user_id=new.user_id;
      retry_allowed:=(distinct_after>=5 or (coalesce(focus_answered,0)+coalesce(focus_skipped,0))>=greatest(1,(select question_target-1 from public.focus_sessions where id=new.focus_session_id and user_id=new.user_id)));
      if retry_allowed then new.review_context:='error_retry'; end if;
    end if;
    if not retry_allowed then new.is_valid:=false; new.invalid_reason:='repeat_same_day'; new.review_context:='manual'; end if;
  elsif learning_exists and new.review_context='manual' then
    -- Una repetición manual anticipada no puede farmear XP, dominio, misión ni racha.
    new.is_valid:=false; new.invalid_reason:='early_manual_repeat';
  end if;

  -- Los intentos ya invalidados por repetición manual se registran, pero no alimentan el detector de ritmo.
  if new.is_valid then
    insert into public.user_study_integrity_state(user_id) values(new.user_id) on conflict(user_id) do nothing;
    select * into st from public.user_study_integrity_state where user_id=new.user_id for update;

    if st.restriction_active then
      if new.fast_attempt then
        new.is_valid:=false; new.invalid_reason:='pace'; st.normal_streak:=0;
      else
        st.normal_streak:=least(5,st.normal_streak+1);
        if st.normal_streak>=5 then st.restriction_active:=false; st.normal_streak:=0; end if;
      end if;
    elsif st.warning_active then
      st.observation_remaining:=greatest(0,st.observation_remaining-1);
      if new.fast_attempt then st.observation_fast_count:=least(5,st.observation_fast_count+1); end if;
      if st.observation_remaining=0 then
        if st.observation_fast_count>=3 then st.restriction_active:=true; else st.restriction_active:=false; end if;
        st.warning_active:=false; st.observation_fast_count:=0; st.normal_streak:=0;
      end if;
    else
      select count(*) filter(where fast_attempt and is_valid) into last2 from (
        select fast_attempt,is_valid from public.user_question_attempts where user_id=new.user_id order by answered_at desc limit 2
      ) z;
      select count(*) filter(where fast_attempt and is_valid) into last5 from (
        select fast_attempt,is_valid from public.user_question_attempts where user_id=new.user_id order by answered_at desc limit 5
      ) z;
      if new.fast_attempt and (last2>=2 or last5>=3) then
        new.pace_warning_triggered:=true;
        st.warning_active:=true; st.observation_remaining:=5; st.observation_fast_count:=0;
      end if;
    end if;
    st.updated_at:=now();
    update public.user_study_integrity_state set warning_active=st.warning_active,observation_remaining=st.observation_remaining,
      observation_fast_count=st.observation_fast_count,restriction_active=st.restriction_active,normal_streak=st.normal_streak,updated_at=st.updated_at
    where user_id=new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists nexmir_prepare_question_attempt on public.user_question_attempts;
create trigger nexmir_prepare_question_attempt before insert on public.user_question_attempts
for each row execute function public.nexmir_prepare_question_attempt();

-- ============================================================
-- 10) MASTERY, REPETICIÓN, XP Y MÉTRICAS DESPUÉS DEL INTENTO
-- ============================================================
create or replace function public.nexmir_process_question_attempt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  src text; sid text; ls public.user_question_learning_state%rowtype; existed boolean:=false;
  new_mastery integer; new_stage integer; next_at timestamptz; recovered boolean:=false;
  base_type text; base_xp integer; added integer:=0; xp_total integer:=0; days_since numeric; bonus integer:=0;
  d date; focus_id uuid:=new.focus_session_id;
begin
  src:=case when new.question_id is not null then 'questions' else 'remnote' end;
  sid:=coalesce(new.question_id::text,new.source_content_id::text);
  d:=public.nexmir_local_date(new.user_id,new.answered_at);

  insert into public.user_study_daily(user_id,activity_date,questions_answered,valid_questions,invalid_questions,fast_attempts,pace_warnings,updated_at)
  values(new.user_id,d,1,case when new.is_valid then 1 else 0 end,case when new.is_valid then 0 else 1 end,
    case when new.fast_attempt then 1 else 0 end,case when new.pace_warning_triggered then 1 else 0 end,now())
  on conflict(user_id,activity_date) do update set
    questions_answered=public.user_study_daily.questions_answered+1,
    valid_questions=public.user_study_daily.valid_questions+excluded.valid_questions,
    invalid_questions=public.user_study_daily.invalid_questions+excluded.invalid_questions,
    fast_attempts=public.user_study_daily.fast_attempts+excluded.fast_attempts,
    pace_warnings=public.user_study_daily.pace_warnings+excluded.pace_warnings,updated_at=now();

  if focus_id is not null then
    update public.focus_sessions set total_answered=total_answered+1,
      valid_questions=valid_questions+case when new.is_valid then 1 else 0 end,
      correct_count=correct_count+case when new.is_valid and new.is_correct then 1 else 0 end,
      incorrect_count=incorrect_count+case when new.is_valid and not new.is_correct then 1 else 0 end,
      updated_at=now()
    where id=focus_id and user_id=new.user_id and status='active';
  end if;

  if not new.is_valid then
    update public.user_question_attempts set xp_awarded=0,mastery_after=null,error_recovered=false
    where user_id=new.user_id and client_event_id=new.client_event_id;
    return new;
  end if;

  select * into ls from public.user_question_learning_state where user_id=new.user_id and source_type=src and source_id=sid for update;
  existed:=found;

  if not existed then
    new_mastery:=case when new.is_correct then 40 else 10 end;
    new_stage:=case when new.is_correct then 0 else -1 end;
    next_at:=new.answered_at + case when new.is_correct then interval '3 days' else interval '1 day' end;
    insert into public.user_question_learning_state(user_id,source_type,source_id,mastery_score,last_answered_at,last_valid_answered_at,next_review_at,
      consecutive_correct,consecutive_incorrect,total_correct,total_incorrect,review_stage,last_result,high_priority_review,updated_at)
    values(new.user_id,src,sid,new_mastery,new.answered_at,new.answered_at,next_at,
      case when new.is_correct then 1 else 0 end,case when new.is_correct then 0 else 1 end,
      case when new.is_correct then 1 else 0 end,case when new.is_correct then 0 else 1 end,
      new_stage,new.is_correct,not new.is_correct,now()) returning * into ls;
    base_type:=case when new.is_correct then 'QUESTION_CORRECT' else 'QUESTION_INCORRECT' end;
    base_xp:=case when new.is_correct then 10 else 3 end;
  else
    recovered:=(ls.last_result is false and new.is_correct is true);
    new_mastery:=greatest(0,least(100,ls.mastery_score + case when new.is_correct then 20 else -25 end));
    if not new.is_correct then
      new_stage:=-1; next_at:=new.answered_at+interval '1 day';
    elsif ls.last_result is false then
      new_stage:=-1; next_at:=new.answered_at+interval '1 day';
    else
      new_stage:=least(6,ls.review_stage+1);
      next_at:=new.answered_at + (((array[3,7,14,30,60,120,180])[new_stage+1])||' days')::interval;
    end if;
    days_since:=case when ls.last_valid_answered_at is null then 0 else extract(epoch from (new.answered_at-ls.last_valid_answered_at))/86400.0 end;
    update public.user_question_learning_state set mastery_score=new_mastery,last_answered_at=new.answered_at,last_valid_answered_at=new.answered_at,
      next_review_at=next_at,consecutive_correct=case when new.is_correct then consecutive_correct+1 else 0 end,
      consecutive_incorrect=case when new.is_correct then 0 else consecutive_incorrect+1 end,
      total_correct=total_correct+case when new.is_correct then 1 else 0 end,
      total_incorrect=total_incorrect+case when new.is_correct then 0 else 1 end,
      review_stage=new_stage,last_result=new.is_correct,high_priority_review=not new.is_correct,updated_at=now()
    where id=ls.id returning * into ls;
    base_type:=case when new.is_correct then 'REVIEW_CORRECT' else 'REVIEW_INCORRECT' end;
    base_xp:=case when new.is_correct then 12 else 3 end;
  end if;

  added:=public.nexmir_add_xp(new.user_id,base_type,base_xp,'attempt:'||new.client_event_id::text||':base',src,sid,focus_id,
    jsonb_build_object('client_event_id',new.client_event_id,'mode',new.mode,'review_context',new.review_context));
  xp_total:=xp_total+added;

  if recovered then
    added:=public.nexmir_add_xp(new.user_id,'ERROR_RECOVERED',8,'attempt:'||new.client_event_id::text||':recovered',src,sid,focus_id,
      jsonb_build_object('client_event_id',new.client_event_id));
    xp_total:=xp_total+added;
    if added>0 then
      insert into public.user_study_daily(user_id,activity_date,errors_recovered,updated_at) values(new.user_id,d,1,now())
      on conflict(user_id,activity_date) do update set errors_recovered=public.user_study_daily.errors_recovered+1,updated_at=now();
      if focus_id is not null then update public.focus_sessions set recovered_errors=recovered_errors+1,updated_at=now() where id=focus_id and user_id=new.user_id; end if;
    end if;
  end if;

  if new.is_correct and existed then
    if days_since>=30 then bonus:=5; elsif days_since>=7 then bonus:=3; else bonus:=0; end if;
    if bonus>0 then
      added:=public.nexmir_add_xp(new.user_id,'CONSOLIDATION',bonus,'attempt:'||new.client_event_id::text||':consolidation',src,sid,focus_id,
        jsonb_build_object('client_event_id',new.client_event_id,'days_since',round(days_since::numeric,2)));
      xp_total:=xp_total+added;
    end if;
  end if;

  if focus_id is not null and xp_total>0 then update public.focus_sessions set xp_earned=xp_earned+xp_total,updated_at=now() where id=focus_id and user_id=new.user_id; end if;

  update public.user_question_attempts set xp_awarded=xp_total,mastery_after=new_mastery,error_recovered=recovered
  where user_id=new.user_id and client_event_id=new.client_event_id;

  perform public.nexmir_mark_daily_goal_if_met(new.user_id);
  return new;
end $$;
drop trigger if exists nexmir_process_question_attempt on public.user_question_attempts;
create trigger nexmir_process_question_attempt after insert on public.user_question_attempts
for each row execute function public.nexmir_process_question_attempt();

-- El registro de errores existente debe ignorar intentos invalidados por antifarmeo.
create or replace function public.nexmir_record_error_attempt() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_source text; v_id text; v_next timestamptz;
begin
  if coalesce(new.is_valid,true) is false then return new; end if;
  v_source := case when new.question_id is not null then 'questions' else 'remnote' end;
  v_id := coalesce(new.question_id::text,new.source_content_id::text);
  if v_id is null then return new; end if;
  select next_review_at into v_next from public.user_question_learning_state where user_id=new.user_id and source_type=v_source and source_id=v_id;
  if new.is_correct is true then
    update public.user_error_log set uncertain=false,reviewed_at=coalesce(new.answered_at,now()),
      next_review_at=coalesce(v_next,coalesce(new.answered_at,now())+interval '1 day'),updated_at=now()
    where user_id=new.user_id and source_type=v_source and source_id=v_id;
    return new;
  end if;
  if new.is_correct is distinct from false then return new; end if;
  insert into public.user_error_log(user_id,source_type,source_id,failures,last_error_at,next_review_at)
  values(new.user_id,v_source,v_id,1,coalesce(new.answered_at,now()),coalesce(new.answered_at,now())+interval '1 day')
  on conflict(user_id,source_type,source_id) do update set
    failures=public.user_error_log.failures+1,last_error_at=excluded.last_error_at,
    next_review_at=coalesce(v_next,excluded.next_review_at),reviewed_at=null,updated_at=now();
  return new;
end $$;
drop trigger if exists nexmir_record_error_attempt on public.user_question_attempts;
create trigger nexmir_record_error_attempt after insert on public.user_question_attempts
for each row execute function public.nexmir_record_error_attempt();

-- ============================================================
-- 11) RPC SEGURA PARA RESPONDER (IDEMPOTENTE)
-- ============================================================
create or replace function public.nexmir_submit_answer(
  p_source_type text,p_source_id uuid,p_selected_index integer,p_mode text default 'bank',
  p_active_seconds integer default null,p_focus_session_id uuid default null,p_client_event_id uuid default null,
  p_review_context text default 'manual'
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); ev uuid:=coalesce(p_client_event_id,gen_random_uuid()); a public.user_question_attempts%rowtype; ls public.user_question_learning_state%rowtype; s public.study_streaks%rowtype;
begin
  if u is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if p_source_type not in ('questions','remnote') then raise exception 'source_type inválido'; end if;
  if p_selected_index is null or p_selected_index<0 then raise exception 'selected_index inválido'; end if;
  if p_focus_session_id is not null and not exists(select 1 from public.focus_sessions where id=p_focus_session_id and user_id=u and status='active') then
    raise exception 'Sesión Focus no válida';
  end if;
  begin
    insert into public.user_question_attempts(user_id,question_id,source_content_id,selected_index,is_correct,answered_at,mode,
      question_active_time_seconds,focus_session_id,client_event_id,review_context)
    values(u,case when p_source_type='questions' then p_source_id else null end,
      case when p_source_type='remnote' then p_source_id else null end,p_selected_index,false,now(),left(coalesce(p_mode,'bank'),40),
      case when p_active_seconds is null then null else greatest(0,least(p_active_seconds,3600)) end,p_focus_session_id,ev,left(coalesce(p_review_context,'manual'),40));
  exception when unique_violation then null;
  end;
  select * into a from public.user_question_attempts where user_id=u and client_event_id=ev order by answered_at desc limit 1;
  if a.client_event_id is null then raise exception 'No se pudo registrar el intento'; end if;
  select * into ls from public.user_question_learning_state where user_id=u and source_type=p_source_type and source_id=p_source_id::text;
  s:=public.nexmir_refresh_streak_for_user(u);
  return jsonb_build_object('attempt',to_jsonb(a),'learning',to_jsonb(ls),'streak',to_jsonb(s));
end $$;
revoke all on function public.nexmir_submit_answer(text,uuid,integer,text,integer,uuid,uuid,text) from public,anon;
grant execute on function public.nexmir_submit_answer(text,uuid,integer,text,integer,uuid,uuid,text) to authenticated;

-- ============================================================
-- 12) SESIONES FOCUS: START, HEARTBEAT Y COMPLETE
-- ============================================================
create or replace function public.nexmir_start_focus(
  p_client_session_id uuid,p_duration_minutes integer,p_question_target integer,
  p_subject text default null,p_topic text default null,p_initial_state jsonb default '{}'::jsonb
) returns public.focus_sessions
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.focus_sessions%rowtype;
begin
  if u is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  if p_client_session_id is null then raise exception 'client_session_id requerido'; end if;
  if p_duration_minutes is not null and p_duration_minutes not in (5,10,15,25) then raise exception 'Duración inválida'; end if;
  if p_question_target<1 or p_question_target>200 then raise exception 'Objetivo inválido'; end if;
  insert into public.focus_sessions(user_id,client_session_id,duration_target_minutes,question_target,subject_filter,topic_filter,session_state)
  values(u,p_client_session_id,p_duration_minutes,p_question_target,nullif(left(coalesce(p_subject,''),120),''),nullif(left(coalesce(p_topic,''),160),''),coalesce(p_initial_state,'{}'::jsonb))
  on conflict(user_id,client_session_id) do nothing;
  select * into r from public.focus_sessions where user_id=u and client_session_id=p_client_session_id;
  return r;
end $$;
revoke all on function public.nexmir_start_focus(uuid,integer,integer,text,text,jsonb) from public,anon;
grant execute on function public.nexmir_start_focus(uuid,integer,integer,text,text,jsonb) to authenticated;

create or replace function public.nexmir_focus_heartbeat(
  p_session_id uuid,p_active_seconds integer,p_skipped_count integer default null,p_session_state jsonb default null
) returns public.focus_sessions
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.focus_sessions%rowtype; requested_delta integer; wall_allowance integer;
begin
  if u is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  select * into r from public.focus_sessions where id=p_session_id and user_id=u for update;
  if not found then raise exception 'Sesión Focus no encontrada'; end if;
  if r.status<>'active' then return r; end if;
  requested_delta:=greatest(0,coalesce(p_active_seconds,0)-r.active_seconds);
  wall_allowance:=greatest(0,least(120,floor(extract(epoch from (now()-r.last_active_at)))::integer+5));
  r.active_seconds:=r.active_seconds+least(requested_delta,wall_allowance);
  if p_skipped_count is not null then r.skipped_count:=greatest(r.skipped_count,greatest(0,p_skipped_count)); end if;
  if p_session_state is not null and octet_length(p_session_state::text)<=50000 then r.session_state:=p_session_state; end if;
  r.last_active_at:=now(); r.updated_at:=now();
  update public.focus_sessions set active_seconds=r.active_seconds,skipped_count=r.skipped_count,session_state=r.session_state,last_active_at=r.last_active_at,updated_at=r.updated_at
  where id=r.id returning * into r;
  return r;
end $$;
revoke all on function public.nexmir_focus_heartbeat(uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.nexmir_focus_heartbeat(uuid,integer,integer,jsonb) to authenticated;

create or replace function public.nexmir_complete_focus(
  p_session_id uuid,p_active_seconds integer,p_skipped_count integer default 0,p_session_state jsonb default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.focus_sessions%rowtype; requested_delta integer; wall_allowance integer;
  req integer; valid_streak boolean:=false; valid_xp boolean:=false; focus_xp integer:=0; awarded integer:=0; d date; s public.study_streaks%rowtype;
begin
  if u is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  select * into r from public.focus_sessions where id=p_session_id and user_id=u for update;
  if not found then raise exception 'Sesión Focus no encontrada'; end if;
  if r.status='completed' then
    s:=public.nexmir_refresh_streak_for_user(u);
    return jsonb_build_object('session',to_jsonb(r),'streak',to_jsonb(s));
  end if;
  requested_delta:=greatest(0,coalesce(p_active_seconds,0)-r.active_seconds);
  wall_allowance:=greatest(0,least(120,floor(extract(epoch from (now()-r.last_active_at)))::integer+5));
  r.active_seconds:=r.active_seconds+least(requested_delta,wall_allowance);
  r.skipped_count:=greatest(r.skipped_count,greatest(0,coalesce(p_skipped_count,0)));
  if p_session_state is not null and octet_length(p_session_state::text)<=50000 then r.session_state:=p_session_state; end if;

  -- Para Focus >=10 min: mínimo absoluto 5 y al menos 70% del objetivo.
  req:=greatest(case when r.active_seconds>=600 then 5 else 3 end,ceil(r.question_target*.70)::integer);
  valid_streak:=(r.active_seconds>=600 and r.valid_questions>=greatest(5,ceil(r.question_target*.70)::integer));
  valid_xp:=(r.active_seconds>=300 and r.valid_questions>=req);
  if valid_xp then
    focus_xp:=case when r.active_seconds>=1500 then 35 when r.active_seconds>=900 then 25 when r.active_seconds>=600 then 15 else 10 end;
    awarded:=public.nexmir_add_xp(u,'FOCUS_COMPLETED',focus_xp,'focus:'||r.id::text,r.subject_filter,null,r.id,
      jsonb_build_object('active_seconds',r.active_seconds,'valid_questions',r.valid_questions,'question_target',r.question_target));
  end if;
  r.xp_earned:=r.xp_earned+awarded; r.valid_for_streak:=valid_streak; r.status:='completed'; r.completed_at:=now(); r.last_active_at:=now(); r.updated_at:=now();
  update public.focus_sessions set active_seconds=r.active_seconds,skipped_count=r.skipped_count,session_state=r.session_state,
    xp_earned=r.xp_earned,valid_for_streak=r.valid_for_streak,status=r.status,completed_at=r.completed_at,last_active_at=r.last_active_at,updated_at=r.updated_at
  where id=r.id returning * into r;
  d:=public.nexmir_local_date(u,r.completed_at);
  insert into public.user_study_daily(user_id,activity_date,focus_sessions_completed,active_focus_seconds,updated_at)
  values(u,d,case when valid_streak then 1 else 0 end,r.active_seconds,now())
  on conflict(user_id,activity_date) do update set
    focus_sessions_completed=public.user_study_daily.focus_sessions_completed+excluded.focus_sessions_completed,
    active_focus_seconds=public.user_study_daily.active_focus_seconds+excluded.active_focus_seconds,updated_at=now();
  perform public.nexmir_mark_daily_goal_if_met(u);
  s:=public.nexmir_refresh_streak_for_user(u);
  return jsonb_build_object('session',to_jsonb(r),'required_valid_questions',req,'valid_for_xp',valid_xp,'streak',to_jsonb(s));
end $$;
revoke all on function public.nexmir_complete_focus(uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.nexmir_complete_focus(uuid,integer,integer,jsonb) to authenticated;

create or replace function public.nexmir_abandon_focus(p_session_id uuid,p_active_seconds integer default 0,p_session_state jsonb default null) returns public.focus_sessions
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r public.focus_sessions%rowtype; requested_delta integer; wall_allowance integer;
begin
  if u is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  select * into r from public.focus_sessions where id=p_session_id and user_id=u for update;
  if not found then raise exception 'Sesión no encontrada'; end if;
  if r.status<>'active' then return r; end if;
  requested_delta:=greatest(0,coalesce(p_active_seconds,0)-r.active_seconds);
  wall_allowance:=greatest(0,least(120,floor(extract(epoch from (now()-r.last_active_at)))::integer+5));
  r.active_seconds:=r.active_seconds+least(requested_delta,wall_allowance);
  if p_session_state is not null and octet_length(p_session_state::text)<=50000 then r.session_state:=p_session_state; end if;
  update public.focus_sessions set active_seconds=r.active_seconds,session_state=r.session_state,status='abandoned',last_active_at=now(),updated_at=now()
  where id=r.id returning * into r;
  return r;
end $$;
revoke all on function public.nexmir_abandon_focus(uuid,integer,jsonb) from public,anon;
grant execute on function public.nexmir_abandon_focus(uuid,integer,jsonb) to authenticated;

-- ============================================================
-- 13) MISIONES DIARIAS
-- ============================================================
create or replace function public.nexmir_sync_daily_missions() returns setof public.daily_missions
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); d date; due_count integer; p integer; mission public.daily_missions%rowtype; award integer; completed_count integer;
begin
  if u is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  d:=public.nexmir_local_date(u,now());
  select count(*) into due_count from public.user_question_learning_state where user_id=u and next_review_at<=now();
  insert into public.daily_missions(user_id,mission_date,mission_key,mission_type,target)
  values
    (u,d,'mission-1',case when due_count>=10 then 'reviews' else 'new_questions' end,10),
    (u,d,'mission-2','recover_errors',3),
    (u,d,'mission-3','focus_15',1)
  on conflict(user_id,mission_date,mission_key) do nothing;

  for mission in select * from public.daily_missions where user_id=u and mission_date=d order by mission_key loop
    if mission.mission_type='reviews' then
      select count(*) into p from public.user_question_attempts a where a.user_id=u and a.is_valid=true and public.nexmir_local_date(u,a.answered_at)=d and a.review_context in ('due','scheduled_retry');
    elsif mission.mission_type='new_questions' then
      select count(*) into p from public.user_question_attempts a where a.user_id=u and a.is_valid=true and public.nexmir_local_date(u,a.answered_at)=d and coalesce(a.review_context,'new')='new';
    elsif mission.mission_type='recover_errors' then
      select count(*) into p from public.xp_events x where x.user_id=u and x.event_type='ERROR_RECOVERED' and public.nexmir_local_date(u,x.created_at)=d;
    else
      select count(*) into p from public.focus_sessions f where f.user_id=u and f.status='completed' and f.active_seconds>=900 and f.valid_questions>=greatest(5,ceil(f.question_target*.70)::integer) and public.nexmir_local_date(u,f.completed_at)=d;
    end if;
    update public.daily_missions set progress=least(mission.target,p),updated_at=now(),
      completed_at=case when p>=mission.target then coalesce(completed_at,now()) else completed_at end
      where id=mission.id returning * into mission;
    if mission.completed_at is not null and mission.xp_awarded=0 then
      award:=public.nexmir_add_xp(u,'MISSION_COMPLETED',20,'mission:'||mission.id::text,null,null,null,jsonb_build_object('mission_type',mission.mission_type));
      if award>0 then update public.daily_missions set xp_awarded=20 where id=mission.id returning * into mission; end if;
    end if;
  end loop;
  select count(*) into completed_count from public.daily_missions where user_id=u and mission_date=d and completed_at is not null;
  if completed_count=3 then
    perform public.nexmir_add_xp(u,'DAILY_MISSIONS_ALL',25,'missions-all:'||d::text,null,null,null,jsonb_build_object('date',d));
  end if;
  return query select * from public.daily_missions where user_id=u and mission_date=d order by mission_key;
end $$;
revoke all on function public.nexmir_sync_daily_missions() from public,anon;
grant execute on function public.nexmir_sync_daily_missions() to authenticated;

-- Métricas agregadas de Focus. No duplica datos: deriva de intentos, sesiones, XP y racha.
create or replace function public.nexmir_focus_metrics() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); s public.study_streaks%rowtype; month_start date; used integer; result jsonb;
begin
  if u is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
  s:=public.nexmir_refresh_streak_for_user(u);
  month_start:=date_trunc('month',public.nexmir_local_date(u,now()))::date;
  select count(*) into used from public.streak_freezes where user_id=u and month_key=month_start;
  select jsonb_build_object(
    'focus_sessions_started',(select count(*) from public.focus_sessions where user_id=u),
    'focus_sessions_completed',(select count(*) from public.focus_sessions where user_id=u and status='completed'),
    'focus_sessions_abandoned',(select count(*) from public.focus_sessions where user_id=u and status='abandoned'),
    'active_focus_time',(select coalesce(sum(active_seconds),0) from public.focus_sessions where user_id=u),
    'questions_answered',(select count(*) from public.user_question_attempts where user_id=u),
    'valid_questions',(select count(*) from public.user_question_attempts where user_id=u and is_valid=true),
    'invalid_questions',(select count(*) from public.user_question_attempts where user_id=u and is_valid=false),
    'questions_skipped',(select coalesce(sum(skipped_count),0) from public.focus_sessions where user_id=u),
    'fast_attempts',(select count(*) from public.user_question_attempts where user_id=u and fast_attempt=true),
    'pace_warnings',(select count(*) from public.user_question_attempts where user_id=u and pace_warning_triggered=true),
    'accuracy',(select coalesce(round(100.0*(count(*) filter(where is_correct=true))/nullif(count(*),0),1),0) from public.user_question_attempts where user_id=u and is_valid=true),
    'xp_earned',(select coalesce(sum(xp_amount),0) from public.xp_events where user_id=u),
    'errors_recovered',(select count(*) from public.xp_events where user_id=u and event_type='ERROR_RECOVERED'),
    'average_response_time',(select coalesce(round(avg(question_active_time_seconds)::numeric,2),0) from public.user_question_attempts where user_id=u and is_valid=true and question_active_time_seconds is not null),
    'median_response_time',(select coalesce(round(percentile_cont(.5) within group(order by question_active_time_seconds)::numeric,2),0) from public.user_question_attempts where user_id=u and is_valid=true and question_active_time_seconds is not null),
    'streak_current',s.current_streak,'streak_max',s.max_streak,'freezes_used',used
  ) into result;
  return result;
end $$;
revoke all on function public.nexmir_focus_metrics() from public,anon;
grant execute on function public.nexmir_focus_metrics() to authenticated;

-- ============================================================
-- 14) RLS
-- ============================================================
alter table public.focus_sessions enable row level security;
alter table public.user_question_learning_state enable row level security;
alter table public.xp_events enable row level security;
alter table public.study_streaks enable row level security;
alter table public.streak_freezes enable row level security;
alter table public.daily_missions enable row level security;
alter table public.user_study_preferences enable row level security;
alter table public.user_study_integrity_state enable row level security;

-- Helper inline: usuario propio o staff.
drop policy if exists focus_sessions_select_self_staff on public.focus_sessions;
create policy focus_sessions_select_self_staff on public.focus_sessions for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator'))
);
drop policy if exists learning_select_self_staff on public.user_question_learning_state;
create policy learning_select_self_staff on public.user_question_learning_state for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator'))
);
drop policy if exists xp_select_self_staff on public.xp_events;
create policy xp_select_self_staff on public.xp_events for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator'))
);
drop policy if exists streak_select_self_staff on public.study_streaks;
create policy streak_select_self_staff on public.study_streaks for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator'))
);
drop policy if exists freeze_select_self_staff on public.streak_freezes;
create policy freeze_select_self_staff on public.streak_freezes for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator'))
);
drop policy if exists missions_select_self_staff on public.daily_missions;
create policy missions_select_self_staff on public.daily_missions for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator'))
);
drop policy if exists integrity_select_self_staff on public.user_study_integrity_state;
create policy integrity_select_self_staff on public.user_study_integrity_state for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator'))
);

-- Preferencias sí son editables por el propio usuario.
drop policy if exists study_preferences_select_self on public.user_study_preferences;
create policy study_preferences_select_self on public.user_study_preferences for select to authenticated using (user_id=auth.uid());
drop policy if exists study_preferences_insert_self on public.user_study_preferences;
create policy study_preferences_insert_self on public.user_study_preferences for insert to authenticated with check (user_id=auth.uid());
drop policy if exists study_preferences_update_self on public.user_study_preferences;
create policy study_preferences_update_self on public.user_study_preferences for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

revoke insert,update,delete on public.focus_sessions from authenticated;
revoke insert,update,delete on public.user_question_learning_state from authenticated;
revoke insert,update,delete on public.xp_events from authenticated;
revoke insert,update,delete on public.study_streaks from authenticated;
revoke insert,update,delete on public.streak_freezes from authenticated;
revoke insert,update,delete on public.daily_missions from authenticated;
revoke insert,update,delete on public.user_study_integrity_state from authenticated;
grant select on public.focus_sessions,public.user_question_learning_state,public.xp_events,public.study_streaks,public.streak_freezes,public.daily_missions,public.user_study_integrity_state to authenticated;
grant select,insert,update on public.user_study_preferences to authenticated;

-- ============================================================
-- 15) BACKFILL LEARNING STATE DESDE INTENTOS EXISTENTES
-- ============================================================
-- Conservador: solo crea un estado inicial aproximado si aún no existe. No genera XP retroactivo.
insert into public.user_question_learning_state(user_id,source_type,source_id,mastery_score,last_answered_at,last_valid_answered_at,next_review_at,
  consecutive_correct,consecutive_incorrect,total_correct,total_incorrect,review_stage,last_result,high_priority_review,created_at,updated_at)
select z.user_id,z.source_type,z.source_id,
  case when z.last_result then least(100,40+greatest(0,z.correct_count-1)*20) else greatest(0,10-greatest(0,z.incorrect_count-1)*5) end,
  z.last_at,z.last_at,z.last_at + case when z.last_result then interval '3 days' else interval '1 day' end,
  case when z.last_result then 1 else 0 end,case when z.last_result then 0 else 1 end,
  z.correct_count,z.incorrect_count,case when z.last_result then 0 else -1 end,z.last_result,not z.last_result,z.first_at,now()
from (
  select a.user_id,case when a.question_id is not null then 'questions' else 'remnote' end source_type,
    coalesce(a.question_id::text,a.source_content_id::text) source_id,
    count(*) filter(where a.is_correct=true)::integer correct_count,
    count(*) filter(where a.is_correct=false)::integer incorrect_count,
    min(a.answered_at) first_at,max(a.answered_at) last_at,
    (array_agg(a.is_correct order by a.answered_at desc))[1] last_result
  from public.user_question_attempts a
  where coalesce(a.question_id::text,a.source_content_id::text) is not null
  group by a.user_id,case when a.question_id is not null then 'questions' else 'remnote' end,coalesce(a.question_id::text,a.source_content_id::text)
) z
on conflict(user_id,source_type,source_id) do nothing;

-- No XP retroactivo: XP empieza a partir de esta migración.
