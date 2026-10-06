-- Preferencias y estadísticas. Instalar después de ERRORES_Y_REPORTES.sql y REPORTES_ADMIN.sql.
-- Añade preferencias visuales y registro diario de estudio; no modifica contenido ni respuestas.
alter table public.profiles add column if not exists theme_palette text;
alter table public.profiles add column if not exists theme_mode text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_theme_palette_check') then
    alter table public.profiles add constraint profiles_theme_palette_check check (theme_palette is null or theme_palette in ('blue','green','orange','pink'));
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_theme_mode_check') then
    alter table public.profiles add constraint profiles_theme_mode_check check (theme_mode is null or theme_mode in ('light','dark','system'));
  end if;
end $$;

create table if not exists public.user_study_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  study_seconds integer not null default 0 check (study_seconds >= 0),
  questions_answered integer not null default 0 check (questions_answered >= 0),
  flashcards_reviewed integer not null default 0 check (flashcards_reviewed >= 0),
  simulations_completed integer not null default 0 check (simulations_completed >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);
create index if not exists user_study_daily_user_date_idx on public.user_study_daily(user_id, activity_date desc);
alter table public.user_study_daily enable row level security;
drop policy if exists study_daily_select_self on public.user_study_daily;
create policy study_daily_select_self on public.user_study_daily for select to authenticated using (user_id=auth.uid());
drop policy if exists study_daily_insert_self on public.user_study_daily;
create policy study_daily_insert_self on public.user_study_daily for insert to authenticated with check (user_id=auth.uid());
drop policy if exists study_daily_update_self on public.user_study_daily;
create policy study_daily_update_self on public.user_study_daily for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update on public.user_study_daily to authenticated;
