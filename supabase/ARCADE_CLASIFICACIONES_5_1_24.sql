-- Ejecutar después de ARCADE.sql, ARCADE_5_1_18.sql y SUGERENCIAS.sql.
-- Los 13 juegos incluidos viven en los archivos del cliente. Esta tabla añade
-- clasificaciones nuevas o casos extra a un juego incluido, sin borrar contenido.
begin;

create table if not exists public.arcade_classifications (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{2,39}$'),
  data jsonb not null check (jsonb_typeof(data)='object'),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists arcade_classifications_published_idx
  on public.arcade_classifications(published,id);
alter table public.arcade_classifications enable row level security;
grant select,insert,update on public.arcade_classifications to authenticated;

drop policy if exists arcade_classifications_read on public.arcade_classifications;
create policy arcade_classifications_read on public.arcade_classifications
for select to authenticated using (
  published or exists(select 1 from public.profiles p
                      where p.id=auth.uid() and p.role='admin')
);
drop policy if exists arcade_classifications_insert on public.arcade_classifications;
create policy arcade_classifications_insert on public.arcade_classifications
for insert to authenticated with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);
drop policy if exists arcade_classifications_update on public.arcade_classifications;
create policy arcade_classifications_update on public.arcade_classifications
for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

-- Los reportes de las partidas incluidas y de las publicadas llegan a la
-- bandeja editorial de reportes ya existente. Nunca se aceptan otros IDs.
drop policy if exists reports_insert_self on public.question_reports;
create policy reports_insert_self on public.question_reports
for insert to authenticated with check (
  user_id=auth.uid() and status='open' and admin_note is null
  and reviewed_by is null and reviewed_at is null
  and (
    (source_type='questions' and exists(
      select 1 from public.questions q where q.id::text=source_id and q.status='published'))
    or (source_type='remnote' and exists(
      select 1 from public.content_items c where c.id::text=source_id and c.status='published' and c.kind='card'))
    or (source_type='arcade' and exists(
      select 1 from public.arcade_questions a where a.id::text=source_id and a.published))
    or (source_type='arcade'
        and source_id ~ '^classification:[a-z][a-z0-9_-]{2,39}:[0-9]{1,3}$'
        and (
          split_part(source_id,':',2) = any(array[
            'apgar','hinchey','asma','curb','forrest','glasgow','garden',
            'nyha','child','ann','birads','breslow','killip'])
          or exists(select 1 from public.arcade_classifications c
                    where c.id=split_part(source_id,':',2) and c.published)
        ))
  )
);
commit;
notify pgrst,'reload schema';
