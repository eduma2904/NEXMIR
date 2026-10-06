-- NEXMIR 5.1.12 · Endurecimiento seguro de funciones y auditoría.
-- Idempotente: no borra datos ni cambia el contenido de las tablas.
-- Ejecutar una vez en Supabase > SQL Editor y revisar los resultados finales.

-- PostgreSQL concede EXECUTE a PUBLIC por defecto al crear una función.
-- Se retira ese permiso de todas las funciones SECURITY DEFINER. No se concede
-- acceso global a authenticated: cada RPC pública conserva o recibe un permiso
-- explícito en la lista permitida de la sección 2.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
  end loop;
end $$;

-- 2) RPC que la app sí puede invocar. Las comprobaciones de usuario/rol se
-- realizan también dentro de cada función y mediante RLS.
do $$
declare
  signature text;
  fn regprocedure;
begin
  foreach signature in array array[
    'public.nexmir_has_role(text[])',
    'public.nexmir_edit_content(uuid,text,text,jsonb,integer,timestamptz)',
    'public.nexmir_publish_remnote_batch(uuid,integer,jsonb)',
    'public.nexmir_reset_content(text,text[],boolean,text,text)',
    'public.nexmir_regroup_published(jsonb)',
    'public.nexmir_list_question_reports()',
    'public.nexmir_test_content_sync_ready()',
    'public.nexmir_refresh_streak()',
    'public.nexmir_submit_answer(text,uuid,integer,text,integer,uuid,uuid,text)',
    'public.nexmir_start_focus(uuid,integer,integer,text,text,jsonb)',
    'public.nexmir_focus_heartbeat(uuid,integer,integer,jsonb)',
    'public.nexmir_complete_focus(uuid,integer,integer,jsonb)',
    'public.nexmir_abandon_focus(uuid,integer,jsonb)',
    'public.nexmir_sync_daily_missions()',
    'public.nexmir_focus_metrics()'
  ]
  loop
    fn := to_regprocedure(signature);
    if fn is not null then
      execute format('grant execute on function %s to authenticated', fn);
    end if;
  end loop;
end $$;

-- 3) Funciones internas. Se revocan PUBLIC, anon y authenticated para
-- neutralizar también funciones SECURITY INVOKER de tipo trigger que heredan
-- EXECUTE desde PUBLIC, además de una eventual ejecución previa del parche
-- 5.1.11.
do $$
declare
  signature text;
  fn regprocedure;
begin
  foreach signature in array array[
    'public.nexmir_guard_profile_role()',
    'public.nexmir_lock_report_fields()',
    'public.nexmir_focus_session_insert_guard()',
    'public.nexmir_prepare_question_attempt()',
    'public.nexmir_process_question_attempt()',
    'public.nexmir_record_error_attempt()',
    'public.nexmir_sync_content_test(public.content_items)',
    'public.nexmir_content_test_trigger()',
    'public.nexmir_question_content_trigger()',
    'public.nexmir_user_timezone(uuid)',
    'public.nexmir_local_date(uuid,timestamptz)',
    'public.nexmir_add_xp(uuid,text,integer,text,text,text,uuid,jsonb)',
    'public.nexmir_refresh_streak_for_user(uuid)',
    'public.nexmir_mark_daily_goal_if_met(uuid)'
  ]
  loop
    fn := to_regprocedure(signature);
    if fn is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn);
    end if;
  end loop;
end $$;

-- 3b) Limpieza de políticas heredadas que el auditor marca como abiertas.
-- Las políticas DELETE quedan solo para authenticated y con comprobación admin.
-- question_ai_explanations pertenece a una función antigua que la app actual
-- no utiliza; se conserva la tabla, pero su lectura queda limitada al staff.
do $$
begin
  if to_regclass('public.content_items') is not null then
    execute 'drop policy if exists nexmir_content_delete_admin_only on public.content_items';
    execute $policy$
      create policy nexmir_content_delete_admin_only
      on public.content_items for delete to authenticated
      using (public.nexmir_has_role(array['admin']))
    $policy$;
  end if;
  if to_regclass('public.questions') is not null then
    execute 'drop policy if exists nexmir_question_delete_admin_only on public.questions';
    execute $policy$
      create policy nexmir_question_delete_admin_only
      on public.questions for delete to authenticated
      using (public.nexmir_has_role(array['admin']))
    $policy$;
  end if;
  if to_regclass('public.question_ai_explanations') is not null then
    execute 'alter table public.question_ai_explanations enable row level security';
    execute 'drop policy if exists "authenticated read ai explanations" on public.question_ai_explanations';
    execute $policy$
      create policy "staff read ai explanations"
      on public.question_ai_explanations for select to authenticated
      using (public.nexmir_has_role(array['admin','moderator']))
    $policy$;
    execute 'revoke all on table public.question_ai_explanations from anon, authenticated';
    execute 'grant select on table public.question_ai_explanations to authenticated';
  end if;
end $$;

-- 4) AUDITORÍAS DE SOLO LECTURA.

-- 4a) Debe devolver 0 filas. Si devuelve alguna, no publiques hasta revisar
-- por qué esa tabla no tiene Row Level Security.
select tablename as tabla_sin_rls
from pg_tables
where schemaname = 'public' and not rowsecurity;

-- 4b) Debe devolver 0 filas salvo políticas públicas creadas deliberadamente.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    'anon' = any(roles)
    or 'public' = any(roles)
    or qual in ('true','(true)')
    or with_check in ('true','(true)')
  );

-- 4c) Confirma que solo aparezcan las cuentas administrativas esperadas.
select id, email, role, plan
from public.profiles
where role in ('admin','moderator');

-- 4d) Inventario de RLS y cantidad de políticas por tabla.
select c.relname as tabla,
       c.relrowsecurity as rls_activo,
       (
         select count(*)
         from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname
       ) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 4e) Ninguna función interna de la lista debe aparecer con permiso para
-- authenticated. El resultado esperado es 0 filas.
with internal_signatures(signature) as (
  values
    ('public.nexmir_guard_profile_role()'),
    ('public.nexmir_lock_report_fields()'),
    ('public.nexmir_focus_session_insert_guard()'),
    ('public.nexmir_prepare_question_attempt()'),
    ('public.nexmir_process_question_attempt()'),
    ('public.nexmir_record_error_attempt()'),
    ('public.nexmir_sync_content_test(public.content_items)'),
    ('public.nexmir_content_test_trigger()'),
    ('public.nexmir_question_content_trigger()'),
    ('public.nexmir_user_timezone(uuid)'),
    ('public.nexmir_local_date(uuid,timestamptz)'),
    ('public.nexmir_add_xp(uuid,text,integer,text,text,text,uuid,jsonb)'),
    ('public.nexmir_refresh_streak_for_user(uuid)'),
    ('public.nexmir_mark_daily_goal_if_met(uuid)')
)
select signature as funcion_interna_expuesta
from internal_signatures
where to_regprocedure(signature) is not null
  and has_function_privilege('authenticated', to_regprocedure(signature), 'EXECUTE');

-- 4f) Resumen final. Esta es la última salida que mostrará el SQL Editor al
-- ejecutar el archivo completo. Los tres primeros valores deben ser 0.
with internal_signatures(signature) as (
  values
    ('public.nexmir_guard_profile_role()'),
    ('public.nexmir_lock_report_fields()'),
    ('public.nexmir_focus_session_insert_guard()'),
    ('public.nexmir_prepare_question_attempt()'),
    ('public.nexmir_process_question_attempt()'),
    ('public.nexmir_record_error_attempt()'),
    ('public.nexmir_sync_content_test(public.content_items)'),
    ('public.nexmir_content_test_trigger()'),
    ('public.nexmir_question_content_trigger()'),
    ('public.nexmir_user_timezone(uuid)'),
    ('public.nexmir_local_date(uuid,timestamptz)'),
    ('public.nexmir_add_xp(uuid,text,integer,text,text,text,uuid,jsonb)'),
    ('public.nexmir_refresh_streak_for_user(uuid)'),
    ('public.nexmir_mark_daily_goal_if_met(uuid)')
)
select
  (
    select count(*)
    from pg_tables
    where schemaname = 'public' and not rowsecurity
  ) as tablas_sin_rls,
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and (
        'anon' = any(roles)
        or 'public' = any(roles)
        or qual in ('true','(true)')
        or with_check in ('true','(true)')
      )
  ) as politicas_abiertas,
  (
    select count(*)
    from internal_signatures
    where to_regprocedure(signature) is not null
      and has_function_privilege(
        'authenticated', to_regprocedure(signature), 'EXECUTE'
      )
  ) as funciones_internas_expuestas,
  (
    select coalesce(
      jsonb_agg(jsonb_build_object('email',email,'role',role,'plan',plan)),
      '[]'::jsonb
    )
    from public.profiles
    where role in ('admin','moderator')
  ) as cuentas_elevadas;
