-- Ejecutar después de las migraciones existentes de planes y Focus.
-- No cambia planes ni contenido ya publicado.
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
  kind text not null check(kind in ('url','email','whatsapp')),
  target text not null check(char_length(btrim(target)) between 3 and 500),
  description text not null default '' check(char_length(description)<=300),
  active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_purchase_target check(
    (kind='url' and target ~* '^https://[^[:space:]]+$') or
    (kind='email' and target ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') or
    (kind='whatsapp' and target ~ '^[0-9]{8,15}$')
  )
);
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

commit;
