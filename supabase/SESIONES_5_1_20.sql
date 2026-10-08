-- NEXMIR 5.1.20 · Una sesión por cuenta (Free/Pro), admin con varios dispositivos.
-- Ejecutar completo en SQL Editor ANTES de subir los archivos web.
-- Caducidad: 60 minutos desde la última interacción; no desde el último refresh.
-- Idempotente. No elimina usuarios, progreso ni contenido. Solo añade control de sesión.
begin;

alter table public.profiles add column if not exists active_device_id text;
alter table public.profiles add column if not exists active_device_label text;
alter table public.profiles add column if not exists device_updated_at timestamptz;

create table if not exists public.nexmir_login_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_label text not null,
  login_started_at timestamptz not null,
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists nexmir_login_sessions_user_idx on public.nexmir_login_sessions(user_id);
create table if not exists public.nexmir_account_session (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  login_started_at timestamptz not null
);
alter table public.nexmir_login_sessions enable row level security;
alter table public.nexmir_account_session enable row level security;
-- El navegador no puede escribir directamente estas tablas, ni elegir otro user_id.
revoke all on public.nexmir_login_sessions,public.nexmir_account_session from public,anon,authenticated;

create or replace function public.nexmir_session_status()
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  uid uuid:=auth.uid(); sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
  s public.nexmir_login_sessions%rowtype; is_admin boolean;
begin
  if uid is null or sid is null then return 'required'; end if;
  select p.role::text='admin' into is_admin from public.profiles p where p.id=uid;
  select * into s from public.nexmir_login_sessions where session_id=sid and user_id=uid;
  if not found then return 'required'; end if;
  if not coalesce(is_admin,false) and not exists(select 1 from public.nexmir_account_session a where a.user_id=uid and a.session_id=sid) then return 'replaced'; end if;
  if s.revoked_at is not null then return 'required'; end if;
  if s.last_active_at<=now()-interval '1 hour' then return 'expired'; end if;
  return 'active';
end $$;

create or replace function public.nexmir_session_open(p_device_id text,p_device_label text,p_takeover boolean default false,p_activity_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid:=auth.uid(); sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
  role_name text; started timestamptz; activity timestamptz;
  s public.nexmir_login_sessions%rowtype; a public.nexmir_account_session%rowtype;
begin
  if uid is null or sid is null then raise exception 'NEXMIR_SESSION_REQUIRED' using errcode='42501'; end if;
  if nullif(trim(p_device_id),'') is null then raise exception 'Falta el identificador del dispositivo'; end if;
  -- Serializa aperturas, reemplazos, heartbeats y cierres de la misma cuenta.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,520));
  select coalesce(role::text,'user') into role_name from public.profiles where id=uid;
  if not found then raise exception 'No se encontró el perfil de esta cuenta'; end if;
  -- JWT firmado por Supabase: una renovación mantiene el session_id y created_at.
  select created_at into started from auth.sessions where id=sid and user_id=uid;
  if not found then return jsonb_build_object('status','required'); end if;
  select * into s from public.nexmir_login_sessions where session_id=sid and user_id=uid;
  if found then
    if s.revoked_at is not null then return jsonb_build_object('status','required'); end if;
    if s.last_active_at<=now()-interval '1 hour' then return jsonb_build_object('status','expired'); end if;
    if role_name<>'admin' and not exists(select 1 from public.nexmir_account_session where user_id=uid and session_id=sid) then return jsonb_build_object('status','replaced'); end if;
    -- Solo aceptar la interacción guardada, nunca la hora del refresh.
    if p_activity_at is not null then
      update public.nexmir_login_sessions set last_active_at=greatest(last_active_at,least(now(),p_activity_at))
        where session_id=sid returning last_active_at into s.last_active_at;
    end if;
    return jsonb_build_object('status','active','last_active_at',s.last_active_at);
  end if;
  activity:=least(now(),coalesce(p_activity_at,now()));
  if activity<=now()-interval '1 hour' then return jsonb_build_object('status','expired'); end if;
  if role_name<>'admin' then
    select * into a from public.nexmir_account_session where user_id=uid;
    if found and a.session_id<>sid then
      -- Solo un login nuevo puede reemplazar. Un navegador antiguo no recupera acceso.
      if not p_takeover or started<=a.login_started_at then return jsonb_build_object('status','replaced'); end if;
    end if;
    insert into public.nexmir_account_session(user_id,session_id,login_started_at) values(uid,sid,started)
      on conflict(user_id) do update set session_id=excluded.session_id,login_started_at=excluded.login_started_at;
  end if;
  insert into public.nexmir_login_sessions(session_id,user_id,device_id,device_label,login_started_at,last_active_at)
    values(sid,uid,left(p_device_id,200),left(coalesce(p_device_label,'Navegador'),200),started,activity);
  update public.profiles set active_device_id=left(p_device_id,200),active_device_label=left(coalesce(p_device_label,'Navegador'),200),device_updated_at=now() where id=uid;
  return jsonb_build_object('status','active','last_active_at',activity);
end $$;

create or replace function public.nexmir_session_touch(p_activity_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid:=auth.uid(); sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid; status text; activity timestamptz;
begin
  if uid is null then return jsonb_build_object('status','required'); end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,520));
  status:=public.nexmir_session_status();
  -- Comprobar ANTES de actualizar: no se puede resucitar una sesión caducada.
  if status<>'active' then return jsonb_build_object('status',status); end if;
  update public.nexmir_login_sessions set last_active_at=greatest(last_active_at,least(now(),coalesce(p_activity_at,last_active_at)))
    where session_id=sid and user_id=uid returning last_active_at into activity;
  return jsonb_build_object('status','active','last_active_at',activity);
end $$;

create or replace function public.nexmir_session_close()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid:=auth.uid(); sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
  if uid is null or sid is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,520));
  update public.nexmir_login_sessions set revoked_at=coalesce(revoked_at,now()) where session_id=sid and user_id=uid;
  -- No tocar el registro de un login más reciente ni sesiones admin de otros equipos.
end $$;

-- Conserva la utilidad del botón Reset dispositivo del panel de usuarios.
create or replace function public.nexmir_session_reset_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role::text='admin') then
    raise exception 'Solo un administrador puede reiniciar las sesiones.' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,520));
  update public.nexmir_login_sessions set revoked_at=coalesce(revoked_at,now()) where user_id=p_user_id;
  update public.profiles set active_device_id=null,active_device_label=null,device_updated_at=now() where id=p_user_id;
end $$;

-- Control de todas las peticiones Data API, incluso RPC SECURITY DEFINER.
-- Mantiene intactas las políticas RLS existentes (batallas, planes, edición, etc.).
create or replace function public.nexmir_session_request_guard()
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare status text; path text:=current_setting('request.path',true);
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'role','')<>'authenticated' then return; end if;
  if path in ('/rpc/nexmir_session_open','/rpc/nexmir_session_touch','/rpc/nexmir_session_close') then return; end if;
  status:=public.nexmir_session_status();
  if status='replaced' then raise exception 'NEXMIR_SESSION_REPLACED' using errcode='42501'; end if;
  if status='expired' then raise exception 'NEXMIR_SESSION_EXPIRED' using errcode='42501'; end if;
  if status<>'active' then raise exception 'NEXMIR_SESSION_REQUIRED' using errcode='42501'; end if;
end $$;

revoke all on function public.nexmir_session_status() from public,anon,authenticated;
revoke all on function public.nexmir_session_open(text,text,boolean,timestamptz) from public,anon;
revoke all on function public.nexmir_session_touch(timestamptz) from public,anon;
revoke all on function public.nexmir_session_close() from public,anon;
revoke all on function public.nexmir_session_request_guard() from public;
revoke all on function public.nexmir_session_reset_user(uuid) from public,anon;
grant execute on function public.nexmir_session_reset_user(uuid) to authenticated;
grant execute on function public.nexmir_session_open(text,text,boolean,timestamptz),public.nexmir_session_touch(timestamptz),public.nexmir_session_close() to authenticated;
-- El pre-request se invoca también para anon; internamente conserva el RLS original.
grant execute on function public.nexmir_session_request_guard() to authenticated,anon;

-- No reemplazar silenciosamente un pre-request personalizado previo.
do $$
declare previous text;
begin
  select split_part(setting,'=',2) into previous
    from pg_db_role_setting s cross join lateral unnest(s.setconfig) setting
    where s.setrole=(select oid from pg_roles where rolname='authenticator')
      and s.setdatabase in (0,(select oid from pg_database where datname=current_database()))
      and setting like 'pgrst.db_pre_request=%' and split_part(setting,'=',2) not in ('','public.nexmir_session_request_guard') limit 1;
  if previous is not null then raise exception 'Existe un pre-request personalizado (%). Integrar ambos controles antes de instalar esta migración.',previous; end if;
end $$;
alter role authenticator set pgrst.db_pre_request = 'public.nexmir_session_request_guard';
-- La configuración por base de datos tiene precedencia sobre la configuración global.
do $$ begin execute format('alter role authenticator in database %I set pgrst.db_pre_request = %L',current_database(),'public.nexmir_session_request_guard'); end $$;
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;

select 'SESIONES_5_1_20 OK' as resultado,'60 minutos sin interacción' as caducidad,
       'Free/Pro: un login activo. Admin: varios dispositivos.' as dispositivos;
