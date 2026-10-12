-- NEXMIR V5.1.40 · Contenido editable para Criteria Rush.
-- Ejecutar una sola vez en Supabase > SQL Editor antes de publicar esta versión.

create table if not exists public.arcade_criteria_rush (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  name text not null check (char_length(name) between 3 and 120),
  topic text not null check (char_length(topic) between 3 and 100),
  icon text not null default '✚' check (char_length(icon) between 1 and 8),
  note text not null check (char_length(note) between 10 and 300),
  items jsonb not null,
  scoring jsonb null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arcade_criteria_rush_items_array check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 6 and 30),
  constraint arcade_criteria_rush_scoring_object check (scoring is null or jsonb_typeof(scoring) = 'object')
);

alter table public.arcade_criteria_rush enable row level security;
grant select, insert, update, delete on public.arcade_criteria_rush to authenticated;

drop policy if exists arcade_criteria_rush_read_published_or_admin on public.arcade_criteria_rush;
create policy arcade_criteria_rush_read_published_or_admin on public.arcade_criteria_rush
for select to authenticated using (
  published = true or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists arcade_criteria_rush_admin_insert on public.arcade_criteria_rush;
create policy arcade_criteria_rush_admin_insert on public.arcade_criteria_rush
for insert to authenticated with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists arcade_criteria_rush_admin_update on public.arcade_criteria_rush;
create policy arcade_criteria_rush_admin_update on public.arcade_criteria_rush
for update to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists arcade_criteria_rush_admin_delete on public.arcade_criteria_rush;
create policy arcade_criteria_rush_admin_delete on public.arcade_criteria_rush
for delete to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.arcade_criteria_rush_set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists arcade_criteria_rush_updated_at on public.arcade_criteria_rush;
create trigger arcade_criteria_rush_updated_at before update on public.arcade_criteria_rush
for each row execute function public.arcade_criteria_rush_set_updated_at();
