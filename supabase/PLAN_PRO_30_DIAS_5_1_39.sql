-- ============================================================
-- NEXMIR 5.1.39 · PLAN PRO CON VIGENCIA DE 30 DÍAS CALENDARIO
-- Ejecutar UNA vez en Supabase > SQL Editor (es seguro repetirlo).
--
-- Flujo:
--   1) El estudiante transfiere S/ 60 o US$ 18 y envía el comprobante.
--   2) El admin verifica el pago y pulsa "Activar Pro" en Admin > Usuarios y planes.
--      -> admin_grant_pro() activa Pro por 30 días calendario y guarda el pago.
--   3) Si el estudiante paga de nuevo antes de vencer, "Renovar" suma 30 días
--      a la fecha de vencimiento actual (no pierde días).
--   4) Si no renueva, el acceso Pro se corta solo al terminar el día 30 (hora de Lima):
--        - inmediatamente en el servidor: nexmir_plan_is_unlimited() ya valida la fecha;
--        - la columna plan vuelve a 'free' con nexmir_expire_pro_plans()
--          (programada a diario con pg_cron si está disponible, y también al abrir el panel admin).
--   Los Pro antiguos sin fecha (activados a mano) siguen como Pro hasta que los renueves con fecha o los quites.
-- ============================================================

-- 1) Columnas de vigencia
alter table public.profiles add column if not exists plan_started_at timestamptz;
alter table public.profiles add column if not exists plan_expires_at timestamptz;

-- 2) Registro de pagos y cambios de plan (auditoría)
create table if not exists public.plan_payments(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  action text not null default 'grant' check(action in ('grant','renew','revoke','expire')),
  amount numeric(10,2),
  currency text check(currency is null or currency in ('PEN','USD')),
  method text,
  reference text,
  note text,
  days integer check(days is null or days between 1 and 366),
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint plan_payments_amount_check check(
    (action in ('grant','renew') and amount is not null and amount>0 and currency is not null)
    or action in ('revoke','expire')
  )
);
create index if not exists plan_payments_user_idx on public.plan_payments(user_id,created_at desc);
-- Evita registrar dos veces el mismo comprobante (mismo medio + mismo número de operación).
create unique index if not exists plan_payments_reference_uidx
  on public.plan_payments(lower(btrim(coalesce(method,''))),lower(btrim(reference)))
  where reference is not null and btrim(reference)<>'' and action in ('grant','renew');

alter table public.plan_payments enable row level security;
drop policy if exists plan_payments_read on public.plan_payments;
create policy plan_payments_read on public.plan_payments for select to authenticated
using(user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
revoke all on public.plan_payments from anon,authenticated;
grant select on public.plan_payments to authenticated;
-- Sin políticas de insert/update/delete: solo se escribe desde las funciones de abajo.

-- 3) El plan Pro solo cuenta si no ha vencido (sin fecha = Pro manual antiguo, sigue vigente)
create or replace function public.nexmir_plan_is_unlimited(p_user uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.profiles
    where id=p_user and (
      role in ('admin','moderator')
      or (lower(coalesce(plan,'free'))='pro' and (plan_expires_at is null or plan_expires_at>now()))
    )
  );
$$;
revoke all on function public.nexmir_plan_is_unlimited(uuid) from public,anon,authenticated;

-- 4) Un usuario normal no puede cambiarse el plan ni sus fechas
create or replace function public.nexmir_guard_profile_role() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(current_setting('nexmir.plan_system',true),'')='1' then return new; end if;
  if coalesce(auth.role(),'') in ('anon','authenticated') then
    if (TG_OP='INSERT' and (coalesce(new.role::text,'user')<>'user' or coalesce(new.plan::text,'free')<>'free'
                            or new.plan_expires_at is not null or new.plan_started_at is not null))
      or (TG_OP='UPDATE' and (new.role is distinct from old.role or new.plan is distinct from old.plan
                              or new.plan_expires_at is distinct from old.plan_expires_at
                              or new.plan_started_at is distinct from old.plan_started_at)) then
      if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
        raise exception 'Solo un administrador puede asignar roles o planes.' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists nexmir_guard_profile_role on public.profiles;
create trigger nexmir_guard_profile_role
before insert or update of role,plan,plan_expires_at,plan_started_at on public.profiles
for each row execute function public.nexmir_guard_profile_role();

-- 5) ADMIN: activar o renovar Pro (verificado el pago)
create or replace function public.admin_grant_pro(
  p_user uuid,
  p_amount numeric,
  p_currency text,
  p_method text default null,
  p_reference text default null,
  p_note text default null,
  p_days integer default 30
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid:=auth.uid();
  cur public.profiles%rowtype;
  today_lima date:=(now() at time zone 'America/Lima')::date;
  start_date date;
  new_exp timestamptz;
  act text;
  cur_code text:=upper(btrim(coalesce(p_currency,'')));
  days_n integer:=coalesce(p_days,30);
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin') then
    raise exception 'Solo un administrador puede activar el Plan Pro.' using errcode='42501';
  end if;
  if cur_code not in ('PEN','USD') then raise exception 'Moneda no válida: usa PEN (soles) o USD (dólares).' using errcode='22023'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Indica el monto verificado del pago.' using errcode='22023'; end if;
  if days_n<1 or days_n>366 then raise exception 'Los días deben estar entre 1 y 366.' using errcode='22023'; end if;

  select * into cur from public.profiles where id=p_user for update;
  if not found then raise exception 'Usuario no encontrado.' using errcode='P0002'; end if;

  if lower(coalesce(cur.plan,'free'))='pro' and cur.plan_expires_at is not null and cur.plan_expires_at>now() then
    -- Renovación anticipada: se suma a la fecha de vencimiento vigente.
    start_date:=(cur.plan_expires_at at time zone 'America/Lima')::date;
    act:='renew';
  else
    start_date:=today_lima;
    act:='grant';
  end if;
  -- Vence al terminar el último día (23:59:59 hora de Lima).
  new_exp:=(((start_date+days_n)::timestamp+interval '23 hours 59 minutes 59 seconds') at time zone 'America/Lima');

  update public.profiles
     set plan='pro',
         plan_started_at=case when act='grant' then now() else coalesce(plan_started_at,now()) end,
         plan_expires_at=new_exp,
         updated_at=now()
   where id=p_user;

  insert into public.plan_payments(user_id,granted_by,action,amount,currency,method,reference,note,days,starts_at,expires_at)
  values(p_user,actor,act,p_amount,cur_code,nullif(btrim(p_method),''),nullif(btrim(p_reference),''),nullif(btrim(p_note),''),days_n,now(),new_exp);

  return jsonb_build_object('user_id',p_user,'plan','pro','action',act,'plan_expires_at',new_exp);
exception when unique_violation then
  raise exception 'Ese comprobante (medio + número de operación) ya fue registrado antes.' using errcode='23505';
end; $$;
revoke all on function public.admin_grant_pro(uuid,numeric,text,text,text,text,integer) from public,anon;
grant execute on function public.admin_grant_pro(uuid,numeric,text,text,text,text,integer) to authenticated;

-- 6) ADMIN: quitar Pro de inmediato
create or replace function public.admin_revoke_pro(p_user uuid,p_reason text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin') then
    raise exception 'Solo un administrador puede quitar el Plan Pro.' using errcode='42501';
  end if;
  update public.profiles set plan='free',plan_expires_at=null,updated_at=now() where id=p_user;
  if not found then raise exception 'Usuario no encontrado.' using errcode='P0002'; end if;
  insert into public.plan_payments(user_id,granted_by,action,note) values(p_user,actor,'revoke',nullif(btrim(p_reason),''));
  return jsonb_build_object('user_id',p_user,'plan','free');
end; $$;
revoke all on function public.admin_revoke_pro(uuid,text) from public,anon;
grant execute on function public.admin_revoke_pro(uuid,text) to authenticated;

-- 7) Vencimiento: devuelve a Free a quien no renovó
create or replace function public.nexmir_expire_pro_plans() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer:=0;
begin
  perform set_config('nexmir.plan_system','1',true);
  with exp as (
    update public.profiles set plan='free',updated_at=now()
     where lower(coalesce(plan,'free'))='pro' and plan_expires_at is not null and plan_expires_at<=now()
    returning id,plan_expires_at
  )
  insert into public.plan_payments(user_id,action,expires_at,note)
  select id,'expire',plan_expires_at,'Vencimiento automático: no renovó dentro de los 30 días' from exp;
  get diagnostics n=row_count;
  return n;
end; $$;
revoke all on function public.nexmir_expire_pro_plans() from public,anon;
grant execute on function public.nexmir_expire_pro_plans() to authenticated;

-- 8) Programación diaria (00:05 hora de Lima = 05:05 UTC). Si pg_cron no está disponible, no pasa nada:
--    el servidor ya bloquea el acceso Pro vencido y el panel admin ejecuta el vencimiento al abrirse.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron no disponible (%). Se omite la programación automática.',sqlerrm;
    return;
  end;
  begin perform cron.unschedule('nexmir_expire_pro'); exception when others then null; end;
  perform cron.schedule('nexmir_expire_pro','5 5 * * *','select public.nexmir_expire_pro_plans()');
exception when others then
  raise notice 'No se pudo programar pg_cron: %',sqlerrm;
end $$;

-- Limpieza inicial por si ya hay vencidos
select public.nexmir_expire_pro_plans();
