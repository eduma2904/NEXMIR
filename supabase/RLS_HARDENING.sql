-- NEXMIR 5.0.29 · RLS explícito para las tablas críticas.
-- Ejecutar después de EDICION_CONTENIDO.sql.
begin;

alter table public.content_items enable row level security;
alter table public.questions enable row level security;
alter table public.profiles enable row level security;

-- Helper SECURITY DEFINER para consultar el rol sin recursión de RLS sobre profiles.
create or replace function public.nexmir_has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.role::text = any(p_roles)
     );
$$;
revoke all on function public.nexmir_has_role(text[]) from public, anon;
grant execute on function public.nexmir_has_role(text[]) to authenticated;

-- CONTENT_ITEMS: alumno lee publicado; staff puede revisar todo.
drop policy if exists nexmir_content_select_explicit on public.content_items;
create policy nexmir_content_select_explicit
on public.content_items for select to authenticated
using (status='published' or public.nexmir_has_role(array['admin','moderator']));

-- Una política permisiva concede escritura a staff; la restrictiva impide que
-- cualquier política antigua demasiado amplia abra INSERT/UPDATE a alumnos.
drop policy if exists nexmir_content_write_staff_allow on public.content_items;
create policy nexmir_content_write_staff_allow
on public.content_items for all to authenticated
using (public.nexmir_has_role(array['admin','moderator']))
with check (public.nexmir_has_role(array['admin','moderator']));

drop policy if exists nexmir_content_insert_staff_guard on public.content_items;
create policy nexmir_content_insert_staff_guard
on public.content_items as restrictive for insert to authenticated
with check (public.nexmir_has_role(array['admin','moderator']));

drop policy if exists nexmir_content_update_staff_guard on public.content_items;
create policy nexmir_content_update_staff_guard
on public.content_items as restrictive for update to authenticated
using (public.nexmir_has_role(array['admin','moderator']))
with check (public.nexmir_has_role(array['admin','moderator']));

drop policy if exists nexmir_content_delete_admin_guard on public.content_items;
create policy nexmir_content_delete_admin_guard
on public.content_items as restrictive for delete to authenticated
using (public.nexmir_has_role(array['admin']));

-- QUESTIONS: mismas garantías.
drop policy if exists nexmir_questions_select_explicit on public.questions;
create policy nexmir_questions_select_explicit
on public.questions for select to authenticated
using (status='published' or public.nexmir_has_role(array['admin','moderator']));

drop policy if exists nexmir_questions_write_staff_allow on public.questions;
create policy nexmir_questions_write_staff_allow
on public.questions for all to authenticated
using (public.nexmir_has_role(array['admin','moderator']))
with check (public.nexmir_has_role(array['admin','moderator']));

drop policy if exists nexmir_questions_insert_staff_guard on public.questions;
create policy nexmir_questions_insert_staff_guard
on public.questions as restrictive for insert to authenticated
with check (public.nexmir_has_role(array['admin','moderator']));

drop policy if exists nexmir_questions_update_staff_guard on public.questions;
create policy nexmir_questions_update_staff_guard
on public.questions as restrictive for update to authenticated
using (public.nexmir_has_role(array['admin','moderator']))
with check (public.nexmir_has_role(array['admin','moderator']));

drop policy if exists nexmir_questions_delete_admin_guard on public.questions;
create policy nexmir_questions_delete_admin_guard
on public.questions as restrictive for delete to authenticated
using (public.nexmir_has_role(array['admin']));

-- PROFILES: cada usuario puede ver/editar su perfil; staff puede leer y admin editar.
-- EDICION_CONTENIDO.sql añade un trigger SECURITY DEFINER que impide autoasignarse
-- role o plan, incluso durante la edición del propio perfil.
drop policy if exists nexmir_profiles_select_explicit on public.profiles;
create policy nexmir_profiles_select_explicit
on public.profiles for select to authenticated
using (id=auth.uid() or public.nexmir_has_role(array['admin','moderator']));

drop policy if exists nexmir_profiles_update_explicit on public.profiles;
create policy nexmir_profiles_update_explicit
on public.profiles for update to authenticated
using (id=auth.uid() or public.nexmir_has_role(array['admin']))
with check (id=auth.uid() or public.nexmir_has_role(array['admin']));

drop policy if exists nexmir_profiles_insert_self_guard on public.profiles;
create policy nexmir_profiles_insert_self_guard
on public.profiles as restrictive for insert to authenticated
with check (id=auth.uid() and coalesce(role::text,'user')='user' and coalesce(plan::text,'free')='free');

commit;

-- Auditoría recomendada tras ejecutar:
-- select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
-- from pg_policies
-- where schemaname='public' and tablename in ('content_items','questions','profiles')
-- order by tablename,policyname;
