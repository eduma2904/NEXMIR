-- Ejecutar una vez en Supabase SQL Editor. Instala la función; NO borra contenido al ejecutarlo.
-- El borrado real solo ocurre desde Admin tras vista previa, huella y confirmación escrita.
begin;
create table if not exists public.user_topic_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  specialty text not null,
  topic text not null,
  rating smallint not null check (rating between 1 and 4),
  updated_at timestamptz not null default now(),
  primary key (user_id,specialty,topic)
);
alter table public.user_topic_feedback enable row level security;
drop policy if exists user_topic_feedback_select_self on public.user_topic_feedback;
create policy user_topic_feedback_select_self on public.user_topic_feedback for select to authenticated using (user_id=auth.uid());
drop policy if exists user_topic_feedback_insert_self on public.user_topic_feedback;
create policy user_topic_feedback_insert_self on public.user_topic_feedback for insert to authenticated with check (user_id=auth.uid());
drop policy if exists user_topic_feedback_update_self on public.user_topic_feedback;
create policy user_topic_feedback_update_self on public.user_topic_feedback for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update on public.user_topic_feedback to authenticated;

create or replace function public.nexmir_cleanup_content(
  p_type text default 'all',
  p_specialties text[] default '{}',
  p_topic text default null,
  p_execute boolean default false,
  p_confirmation text default '',
  p_fingerprint text default ''
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
set statement_timeout = '120s'
as $$
declare
  cids text[]; qids text[]; uids text[];
  tbl text; predicate text; n bigint; counts jsonb := '{}'::jsonb;
  revision text; fingerprint text; expected text;
  table_order constant text[] := array[
    'battle_answers','user_question_attempts','user_flashcard_reviews',
    'user_topic_feedback',
    'user_bookmarks','user_notes','user_error_log','question_reports',
    'content_versions','remnote_import_changes','content_items','questions',
    'remnote_imports','question_imports'
  ];
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Solo un administrador puede borrar contenido.' using errcode='42501';
  end if;
  if p_type not in ('all','flashcards','theory','simulations','banks') or p_type is null then
    raise exception 'Tipo de contenido no válido.' using errcode='22023';
  end if;
  expected:='BORRAR CONTENIDO';
  if p_topic is not null and btrim(p_topic)='' then p_topic:=null; end if;
  if p_execute then
    if p_confirmation is distinct from 'BORRAR CONTENIDO' or coalesce(p_fingerprint,'')='' then
      raise exception 'Falta la confirmación escrita o la vista previa.';
    end if;
    lock table public.content_items, public.questions in share row exclusive mode;
    foreach tbl in array table_order loop
      if to_regclass(format('public.%I',tbl)) is not null then
        execute format('lock table public.%I in share row exclusive mode',tbl);
      end if;
    end loop;
  end if;

  select coalesce(array_agg(id::text order by id::text),'{}'),coalesce(array_agg(source_uid::text),'{}')
    into cids,uids from public.content_items
    where (p_type='all'
      or (p_type='theory' and kind='theory')
      or (p_type='flashcards' and kind='card' and coalesce(payload->>'content_use','study')<>'simulation')
      or (p_type='simulations' and kind='card' and payload->>'content_use'='simulation'))
      and (cardinality(p_specialties)=0 or coalesce(nullif(specialty,''),'Sin clasificar')=any(p_specialties))
      and (p_topic is null or coalesce(nullif(topic,''),'General')=p_topic);
  select coalesce(array_agg(id::text order by id::text),'{}') into qids
    from public.questions
    where (p_type='all'
      or (p_type='simulations' and (nullif(source_exam,'') is not null or remnote_metadata->>'content_use'='simulation'))
      or (p_type='banks' and nullif(source_exam,'') is null and coalesce(remnote_metadata->>'content_use','study')<>'simulation'))
      and (cardinality(p_specialties)=0 or coalesce(nullif(specialty,''),'Sin clasificar')=any(p_specialties))
      and (p_topic is null or coalesce(nullif(topic,''),'General')=p_topic);

  select coalesce(string_agg(id::text||':'||coalesce(updated_at::text,''),',' order by id::text),'')
    into revision from public.content_items where id::text=any(cids);
  select revision||'|'||coalesce(string_agg(id::text||':'||coalesce(updated_at::text,''),',' order by id::text),'')
    into revision from public.questions where id::text=any(qids);

  foreach tbl in array table_order loop
    if to_regclass(format('public.%I',tbl)) is null then continue; end if;
    predicate:=case tbl
      when 'content_items' then 'd.id::text=any($1)'
      when 'questions' then 'd.id::text=any($2)'
      when 'content_versions' then 'd.content_id::text=any($1)'
      when 'user_flashcard_reviews' then 'd.content_id::text=any($1)'
      when 'user_topic_feedback' then '$6 and (cardinality($4)=0 or d.specialty=any($4)) and ($5 is null or d.topic=$5)'
      when 'user_question_attempts' then 'd.source_content_id::text=any($1) or d.question_id::text=any($2)'
      when 'battle_answers' then 'd.question_id::text=any($2)'
      when 'user_error_log' then '(d.source_type=''remnote'' and d.source_id=any($1)) or (d.source_type=''questions'' and d.source_id=any($2))'
      when 'question_reports' then '(d.source_type=''remnote'' and d.source_id=any($1)) or (d.source_type=''questions'' and d.source_id=any($2))'
      when 'user_bookmarks' then '(to_jsonb(d)->>''item_id'')=any($1||$2)'
      when 'user_notes' then '(to_jsonb(d)->>''item_id'')=any($1||$2) or (to_jsonb(d)->>''content_id'')=any($1) or (to_jsonb(d)->>''question_id'')=any($2)'
      when 'remnote_import_changes' then '(to_jsonb(d)->>''source_uid'')=any($3)'
      when 'remnote_imports' then case when p_type='all' and cardinality(p_specialties)=0 and p_topic is null then 'true' else 'false' end
      when 'question_imports' then case when p_type='all' and cardinality(p_specialties)=0 and p_topic is null then 'true' else 'false' end
      else 'false' end;
    execute format('select count(*) from public.%I d where %s',tbl,predicate) into n using cids,qids,uids,p_specialties,p_topic,(p_type='all');
    counts:=counts||jsonb_build_object(tbl,n);
  end loop;
  fingerprint:=md5(p_type||'|'||array_to_string(p_specialties,',')||'|'||coalesce(p_topic,'')||'|'||revision||'|'||counts::text);
  if not p_execute then
    return jsonb_build_object('counts',counts,'fingerprint',fingerprint,'confirmation',expected,'executed',false);
  end if;
  if p_fingerprint is distinct from fingerprint then
    raise exception 'La base cambió desde la vista previa. Vuelve a consultar las cantidades.';
  end if;
  foreach tbl in array table_order loop
    if to_regclass(format('public.%I',tbl)) is null then continue; end if;
    predicate:=case tbl
      when 'content_items' then 'd.id::text=any($1)'
      when 'questions' then 'd.id::text=any($2)'
      when 'content_versions' then 'd.content_id::text=any($1)'
      when 'user_flashcard_reviews' then 'd.content_id::text=any($1)'
      when 'user_topic_feedback' then '$6 and (cardinality($4)=0 or d.specialty=any($4)) and ($5 is null or d.topic=$5)'
      when 'user_question_attempts' then 'd.source_content_id::text=any($1) or d.question_id::text=any($2)'
      when 'battle_answers' then 'd.question_id::text=any($2)'
      when 'user_error_log' then '(d.source_type=''remnote'' and d.source_id=any($1)) or (d.source_type=''questions'' and d.source_id=any($2))'
      when 'question_reports' then '(d.source_type=''remnote'' and d.source_id=any($1)) or (d.source_type=''questions'' and d.source_id=any($2))'
      when 'user_bookmarks' then '(to_jsonb(d)->>''item_id'')=any($1||$2)'
      when 'user_notes' then '(to_jsonb(d)->>''item_id'')=any($1||$2) or (to_jsonb(d)->>''content_id'')=any($1) or (to_jsonb(d)->>''question_id'')=any($2)'
      when 'remnote_import_changes' then '(to_jsonb(d)->>''source_uid'')=any($3)'
      when 'remnote_imports' then case when p_type='all' and cardinality(p_specialties)=0 and p_topic is null then 'true' else 'false' end
      when 'question_imports' then case when p_type='all' and cardinality(p_specialties)=0 and p_topic is null then 'true' else 'false' end
      else 'false' end;
    execute format('delete from public.%I d where %s',tbl,predicate) using cids,qids,uids,p_specialties,p_topic,(p_type='all');
  end loop;
  return jsonb_build_object('counts',counts,'executed',true);
end;
$$;
revoke all on function public.nexmir_cleanup_content(text,text[],text,boolean,text,text) from public,anon;
grant execute on function public.nexmir_cleanup_content(text,text[],text,boolean,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
