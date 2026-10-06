-- NEXMIR V5.0.29 · Sugerencias de usuarios para desarrolladores.
-- Crea la bandeja de sugerencias visible desde Perfil y el panel Admin.
begin;

create table if not exists public.feature_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'feature' check (category in ('feature','improvement','problem','other')),
  title text,
  detail text not null,
  status text not null default 'open' check (status in ('open','reviewing','planned','done','dismissed')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint feature_suggestions_detail_length check (char_length(detail) between 10 and 3000),
  constraint feature_suggestions_title_length check (title is null or char_length(title) <= 120)
);

create index if not exists feature_suggestions_user_created_idx on public.feature_suggestions(user_id,created_at desc);
create index if not exists feature_suggestions_status_created_idx on public.feature_suggestions(status,created_at desc);
alter table public.feature_suggestions enable row level security;
grant select, insert, update, delete on public.feature_suggestions to authenticated;

drop policy if exists suggestion_insert_own on public.feature_suggestions;
create policy suggestion_insert_own on public.feature_suggestions
for insert to authenticated
with check (user_id=auth.uid() and status='open' and admin_note is null and reviewed_by is null and reviewed_at is null);

drop policy if exists suggestion_select_own_or_staff on public.feature_suggestions;
create policy suggestion_select_own_or_staff on public.feature_suggestions
for select to authenticated
using (
  user_id=auth.uid()
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator'))
);

drop policy if exists suggestion_update_staff on public.feature_suggestions;
create policy suggestion_update_staff on public.feature_suggestions
for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','moderator')));

drop policy if exists suggestion_delete_admin on public.feature_suggestions;
create policy suggestion_delete_admin on public.feature_suggestions
for delete to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

commit;
notify pgrst, 'reload schema';
