-- Ejecutar después de las migraciones existentes de planes y Focus.
-- Añade métricas editoriales y canales de compra Pro editables.
begin;

-- Las cuentas nuevas tienen sonido activo; las preferencias guardadas se respetan.
alter table public.user_study_preferences alter column reward_sounds set default true;

create index if not exists uq_editorial_question_idx
on public.user_question_attempts(question_id,user_id) include(is_correct)
where is_valid=true and question_id is not null;
create index if not exists uq_editorial_remnote_idx
on public.user_question_attempts(source_content_id,user_id) include(is_correct)
where is_valid=true and source_content_id is not null;

-- Solo el personal editorial puede consultar estadísticas agregadas de fallos.
create or replace function public.nexmir_editorial_question_stats()
returns table(source_type text, source_id uuid, attempts bigint, incorrect bigint, users bigint, users_wrong bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator')
  ) then raise exception 'Acceso editorial requerido' using errcode='42501'; end if;
  return query
    select case when a.question_id is not null then 'questions' else 'remnote' end::text,
           coalesce(a.question_id,a.source_content_id),count(*)::bigint,
           count(*) filter(where a.is_correct=false)::bigint,
           count(distinct a.user_id)::bigint,
           count(distinct a.user_id) filter(where a.is_correct=false)::bigint
    from public.user_question_attempts a
    where a.is_valid=true and (a.question_id is not null or a.source_content_id is not null)
    group by 1,2;
end;
$$;
revoke all on function public.nexmir_editorial_question_stats() from public,anon;
grant execute on function public.nexmir_editorial_question_stats() to authenticated;

-- Canales de adquisición configurables. Los usuarios nunca pueden cambiar su plan.
create table if not exists public.plan_purchase_channels(
  id uuid primary key default gen_random_uuid(),
  label text not null check(char_length(btrim(label)) between 2 and 80),
  kind text not null,
  target text not null check(char_length(btrim(target)) between 3 and 500),
  currency text,
  account_number text,
  cci text,
  description text not null default '' check(char_length(description)<=300),
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Actualiza instalaciones que ya ejecutaron la versión 5.1.36.
alter table public.plan_purchase_channels add column if not exists currency text;
alter table public.plan_purchase_channels add column if not exists account_number text;
alter table public.plan_purchase_channels add column if not exists cci text;
alter table public.plan_purchase_channels drop constraint if exists plan_purchase_channels_kind_check;
alter table public.plan_purchase_channels drop constraint if exists valid_purchase_target;
alter table public.plan_purchase_channels drop constraint if exists purchase_channel_currency_length;
alter table public.plan_purchase_channels drop constraint if exists purchase_channel_account_length;
alter table public.plan_purchase_channels drop constraint if exists purchase_channel_cci_length;
alter table public.plan_purchase_channels add constraint plan_purchase_channels_kind_check
  check(kind in ('url','email','whatsapp','bank'));
alter table public.plan_purchase_channels add constraint valid_purchase_target check(
  (kind='url' and target ~* '^https://[^[:space:]]+$') or
  (kind='email' and target ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') or
  (kind='whatsapp' and target ~ '^[0-9]{8,15}$') or
  (kind='bank' and target ~ '^[0-9 -]{4,40}$' and account_number is not null and account_number ~ '^[0-9 -]{4,40}$' and (cci is null or cci='' or cci ~ '^[0-9 -]{4,40}$'))
);
alter table public.plan_purchase_channels add constraint purchase_channel_currency_length
  check(currency is null or char_length(currency)<=30);
alter table public.plan_purchase_channels add constraint purchase_channel_account_length
  check(account_number is null or char_length(account_number)<=40);
alter table public.plan_purchase_channels add constraint purchase_channel_cci_length
  check(cci is null or char_length(cci)<=40);

alter table public.plan_purchase_channels enable row level security;
drop policy if exists purchase_channels_read on public.plan_purchase_channels;
create policy purchase_channels_read on public.plan_purchase_channels for select to anon,authenticated
using(active or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists purchase_channels_admin_insert on public.plan_purchase_channels;
create policy purchase_channels_admin_insert on public.plan_purchase_channels for insert to authenticated
with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists purchase_channels_admin_update on public.plan_purchase_channels;
create policy purchase_channels_admin_update on public.plan_purchase_channels for update to authenticated
using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists purchase_channels_admin_delete on public.plan_purchase_channels;
create policy purchase_channels_admin_delete on public.plan_purchase_channels for delete to authenticated
using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
grant select on public.plan_purchase_channels to anon,authenticated;
grant insert,update,delete on public.plan_purchase_channels to authenticated;

-- Vías de pago iniciales proporcionadas por NEXMIR.
insert into public.plan_purchase_channels
  (id,label,kind,target,currency,account_number,cci,description,active,sort_order)
values
  ('a0000000-0000-4000-8000-000000000001','Interbank','bank','8983269785197','Soles','8983269785197','00389801326978519741','Cuenta Simple',true,10),
  ('a0000000-0000-4000-8000-000000000002','Banco de la Nación','bank','04-082-676746','Soles','04-082-676746','018-000-004082676746-05','Cuenta de ahorros',true,20),
  ('a0000000-0000-4000-8000-000000000003','Scotiabank','bank','7108569786',null,'7108569786','00940720710856978689','Cuenta de ahorros',true,30),
  ('a0000000-0000-4000-8000-000000000004','BCP','bank','57006488130020','Soles','57006488130020','00257010648813002001','Cuenta de ahorros',true,40),
  ('a0000000-0000-4000-8000-000000000005','BCP','bank','19114954045194','Dólares','19114954045194','00219111495404519459','Cuenta de ahorros',true,50),
  ('a0000000-0000-4000-8000-000000000006','BBVA','bank','0011-0094-0200319217','Soles','0011-0094-0200319217','011-094-000200319217-02','Cuenta de ahorros',true,60),
  ('a0000000-0000-4000-8000-000000000007','Enviar comprobante por WhatsApp','whatsapp','51930003626',null,null,null,'Atención: +51 930 003 626',true,70)
on conflict(id) do nothing;

commit;
