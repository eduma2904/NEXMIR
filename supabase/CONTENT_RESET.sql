-- NEXMIR 5.0.29: borrado selectivo seguro y escalable.
-- Ejecutar UNA VEZ en SQL Editor. Instala/actualiza la RPC; ejecutar este archivo NO borra datos.
-- Conserva auth.users, profiles, study_plans y los resúmenes históricos de simulacros/batallas.

-- Índices usados por el borrado selectivo (se crean solo si tabla+columna existen).
do $$
declare r record;
begin
  for r in select * from (values
    ('user_flashcard_reviews','content_id','nexmir_ufr_content_idx'),
    ('user_question_attempts','question_id','nexmir_uqa_question_idx'),
    ('user_question_attempts','source_content_id','nexmir_uqa_source_content_idx'),
    ('content_versions','content_id','nexmir_versions_content_idx'),
    ('battle_answers','question_id','nexmir_battle_answer_question_idx'),
    ('user_error_log','source_id','nexmir_error_source_idx'),
    ('question_reports','source_id','nexmir_report_source_idx')
  ) v(tbl,col,idx)
  loop
    if to_regclass('public.'||r.tbl) is not null and exists(
      select 1 from information_schema.columns where table_schema='public' and table_name=r.tbl and column_name=r.col
    ) then execute format('create index if not exists %I on public.%I (%I)',r.idx,r.tbl,r.col); end if;
  end loop;
end $$;

create or replace function public.nexmir_reset_content(
  p_scope text,
  p_specialties text[] default '{}',
  p_execute boolean default false,
  p_confirmation text default '',
  p_fingerprint text default ''
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
set statement_timeout = '120s'
as $$
declare
  cids text[]; qids text[]; uids text[];
  tbl text; predicate text; n bigint; result jsonb := '{}'::jsonb;
  filters jsonb := '{}'::jsonb; counts jsonb := '{}'::jsonb;
  revision text; fingerprint text; expected text;
  all_scope boolean := p_scope = 'all';
  flash_scope boolean := p_scope = 'flashcards';
  table_order constant text[] := array[
    'battle_answers','user_question_attempts','user_flashcard_reviews','user_bookmarks','user_notes',
'user_error_log','question_reports','content_versions','remnote_import_changes',
    'content_items','questions','remnote_imports','question_imports'
  ];
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then raise exception 'Solo un administrador puede revisar o borrar la base de contenido.' using errcode = '42501'; end if;
  if p_scope is null or p_scope not in ('all','specialties','flashcards') then
    raise exception 'Selecciona todo el contenido o una o varias especialidades.';
  end if;
  if p_scope = 'specialties' and coalesce(cardinality(p_specialties),0)=0 then
    raise exception 'No se ha seleccionado ninguna especialidad.';
  end if;
  expected := case p_scope when 'all' then 'BORRAR TODO' when 'flashcards' then 'BORRAR FLASHCARDS' else 'BORRAR ESPECIALIDADES' end;
  if p_execute then
    if p_confirmation is distinct from expected or coalesce(p_fingerprint,'')='' then
      raise exception 'Falta la confirmación escrita o la vista previa del borrado.';
    end if;
    lock table public.content_items, public.questions in share row exclusive mode;
    foreach tbl in array table_order loop
      if to_regclass(format('public.%I',tbl)) is not null then execute format('lock table public.%I in share row exclusive mode',tbl); end if;
    end loop;
  end if;

  select coalesce(array_agg(id::text order by id::text),'{}'), coalesce(array_agg(source_uid::text),'{}')
    into cids,uids from public.content_items
    where all_scope or (flash_scope and kind='card') or (p_scope='specialties' and coalesce(nullif(specialty,''),'Sin clasificar')=any(p_specialties));
  select coalesce(array_agg(id::text order by id::text),'{}') into qids
    from public.questions
    where all_scope or (p_scope='specialties' and coalesce(nullif(specialty,''),'Sin clasificar')=any(p_specialties));

  select coalesce(string_agg(id::text||':'||coalesce(updated_at::text,''),',' order by id::text),'')
    into revision from public.content_items where id::text=any(cids);
  select revision||'|'||coalesce(string_agg(id::text||':'||coalesce(updated_at::text,''),',' order by id::text),'')
    into revision from public.questions where id::text=any(qids);

  foreach tbl in array table_order loop
    if to_regclass(format('public.%I',tbl)) is null then continue; end if;
    if all_scope then
      predicate:=case tbl
        when 'content_items' then 'true' when 'questions' then 'true'
        when 'remnote_imports' then 'true' when 'question_imports' then 'true'
        else case tbl
          when 'user_flashcard_reviews' then 'd.content_id::text=any($1)'
          when 'user_question_attempts' then 'd.source_content_id::text=any($1) or d.question_id::text=any($2)'
          when 'content_versions' then 'd.content_id::text=any($1)'
          when 'battle_answers' then 'd.question_id::text=any($2)'
          when 'user_error_log' then '(d.source_type=''remnote'' and d.source_id=any($1)) or (d.source_type=''questions'' and d.source_id=any($2))'
          when 'question_reports' then '(d.source_type=''remnote'' and d.source_id=any($1)) or (d.source_type=''questions'' and d.source_id=any($2))'
          when 'user_bookmarks' then '(to_jsonb(d)->>''item_id'')=any($1||$2)'
          when 'user_notes' then '(to_jsonb(d)->>''item_id'')=any($1||$2) or (to_jsonb(d)->>''content_id'')=any($1) or (to_jsonb(d)->>''question_id'')=any($2)'
          when 'remnote_import_changes' then '(to_jsonb(d)->>''source_uid'')=any($3)'
          else 'false' end end;
    else
      predicate:=case tbl
        when 'content_items' then 'd.id::text=any($1)'
        when 'questions' then 'd.id::text=any($2)'
        when 'content_versions' then 'd.content_id::text=any($1)'
        when 'user_flashcard_reviews' then 'd.content_id::text=any($1)'
        when 'user_question_attempts' then 'd.source_content_id::text=any($1) or d.question_id::text=any($2)'
        when 'battle_answers' then 'd.question_id::text=any($2)'
        when 'user_error_log' then '(d.source_type=''remnote'' and d.source_id=any($1)) or (d.source_type=''questions'' and d.source_id=any($2))'
        when 'question_reports' then '(d.source_type=''remnote'' and d.source_id=any($1)) or (d.source_type=''questions'' and d.source_id=any($2))'
        when 'user_bookmarks' then '(to_jsonb(d)->>''item_id'')=any($1||$2)'
        when 'user_notes' then '(to_jsonb(d)->>''item_id'')=any($1||$2) or (to_jsonb(d)->>''content_id'')=any($1) or (to_jsonb(d)->>''question_id'')=any($2)'
        when 'remnote_import_changes' then '(to_jsonb(d)->>''source_uid'')=any($3)'
        else 'false' end;
    end if;
    filters:=filters||jsonb_build_object(tbl,predicate);
    execute format('select count(*) from public.%I d where %s',tbl,predicate) into n using cids,qids,uids;
    counts:=counts||jsonb_build_object(tbl,n);
  end loop;

  fingerprint:=md5(p_scope||'|'||coalesce(array_to_string(p_specialties,','),'')||'|'||revision||'|'||counts::text);
  result:=jsonb_build_object('scope',p_scope,'specialties',p_specialties,'counts',counts,'fingerprint',fingerprint,'confirmation',expected,'executed',false,
    'preserved',jsonb_build_array('profiles','study_plans','simulations','battle_rooms','battle_participants'));
  if not p_execute then return result; end if;
  if p_fingerprint is distinct from fingerprint then raise exception 'La base cambió desde la vista previa. Vuelve a revisar las cantidades antes de borrar.'; end if;
  foreach tbl in array table_order loop
    if not (filters ? tbl) then continue; end if;
    execute format('delete from public.%I d where %s',tbl,filters->>tbl) using cids,qids,uids;
  end loop;
  return result||jsonb_build_object('executed',true);
end;
$$;
revoke all on function public.nexmir_reset_content(text,text[],boolean,text,text) from public,anon;
grant execute on function public.nexmir_reset_content(text,text[],boolean,text,text) to authenticated;
notify pgrst, 'reload schema';
