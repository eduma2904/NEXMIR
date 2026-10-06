-- NEXMIR V5.0.23 · execute once in Supabase > SQL Editor.
-- Existing unclassified rows remain accessible for correction. New RemNote
-- publication cannot write an empty/unclassified specialty.
begin;
alter table public.questions add column if not exists remnote_metadata jsonb;
alter table public.questions add column if not exists source text;
alter table public.questions add column if not exists source_uid text;
alter table public.questions add column if not exists section text;
alter table public.questions add column if not exists subtopic text;
create table if not exists public.classification_change_log (
  id uuid primary key default gen_random_uuid(),
  item_kind text not null check(item_kind in ('content','question')),
  item_id uuid not null,
  old_classification jsonb not null,
  new_classification jsonb not null,
  changed_by uuid not null,
  changed_at timestamptz not null default now()
);
alter table public.classification_change_log enable row level security;
revoke all on public.classification_change_log from anon,authenticated;

do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.content_items'::regclass and conname='nexmir_content_specialty_required') then
    alter table public.content_items add constraint nexmir_content_specialty_required check (
      status <> 'published' or (
        nullif(btrim(specialty),'') is not null and lower(btrim(specialty)) not in
        ('sin clasificar','desagrupadas','desagrupados','desagrupada','desagrupado','unclassified','sin especialidad','pendiente') and lower(btrim(specialty)) not like 'sin clasificar %'
      )
    ) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.questions'::regclass and conname='nexmir_remnote_question_specialty_required') then
    alter table public.questions add constraint nexmir_remnote_question_specialty_required check (
      status <> 'published' or not (
        coalesce(source,'')='RemNote' or remnote_metadata is not null or coalesce(source_uid,'') like '%:rn\_%' escape '\'
      ) or (
        nullif(btrim(specialty),'') is not null and lower(btrim(specialty)) not in
        ('sin clasificar','desagrupadas','desagrupados','desagrupada','desagrupado','unclassified','sin especialidad','pendiente') and lower(btrim(specialty)) not like 'sin clasificar %'
      )
    ) not valid;
  end if;
end $$;

create or replace function public.nexmir_regroup_published(p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor uuid := auth.uid();
  d jsonb;
  content_row public.content_items%rowtype;
  question_row public.questions%rowtype;
  item_id uuid;
  item_kind text;
  specialty_value public.content_items.specialty%type;
  topic_value public.content_items.topic%type;
  subtopic_value public.content_items.subtopic%type;
  section_value public.content_items.section%type;
  origin_value text;
  old_classification jsonb;
  new_classification jsonb;
  next_payload jsonb;
  changed integer := 0;
  unchanged integer := 0;
  stamp timestamptz := now();
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role in ('admin','moderator')) then
    raise exception 'Solo administración puede editar la clasificación.' using errcode='42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes) not between 1 and 100 then
    raise exception 'El lote debe contener entre 1 y 100 registros.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_changes) c group by c->>'kind',c->>'id' having count(*)>1) then
    raise exception 'El lote contiene registros repetidos.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(50220022);
  for d in select value from jsonb_array_elements(p_changes) order by value->>'kind',value->>'id'
  loop
    item_id := (d->>'id')::uuid;item_kind := d->>'kind';
    if item_id is null or item_kind is null or item_kind not in ('content','question') then
      raise exception 'Registro no válido.' using errcode='22023';
    end if;
    specialty_value := nullif(btrim(d->>'specialty'),'');topic_value := coalesce(nullif(btrim(d->>'topic'),''),'General');
    subtopic_value := nullif(btrim(d->>'subtopic'),'');section_value := nullif(btrim(d->>'section'),'');
    origin_value := coalesce(d->>'classification_origin','admin_manual');
    if specialty_value is null or lower(specialty_value) in ('sin clasificar','desagrupadas','desagrupados','desagrupada','desagrupado','unclassified','sin especialidad','pendiente') or lower(specialty_value) like 'sin clasificar %' then
      raise exception 'La especialidad no puede estar desagrupada.' using errcode='22023';
    end if;
    if origin_value not in ('admin_manual','remnote_hierarchy','remnote_custom_hierarchy') then
      raise exception 'Origen de clasificación no válido.' using errcode='22023';
    end if;
    new_classification := jsonb_build_object('specialty',specialty_value,'topic',topic_value,'subtopic',subtopic_value,'section',section_value,'classification_origin',origin_value,
      'path',to_jsonb(array_remove(array[specialty_value,topic_value,subtopic_value,section_value],null)));
    if item_kind='content' then
      select * into content_row from public.content_items where id=item_id for update;
      if not found or content_row.status<>'published' then raise exception 'Contenido publicado no encontrado.' using errcode='22023'; end if;
      old_classification := jsonb_build_object('specialty',content_row.specialty,'topic',content_row.topic,'subtopic',content_row.subtopic,'section',content_row.section,'classification_origin',content_row.payload->>'classification_origin');
      if (old_classification||jsonb_build_object('path',content_row.payload->'path'))=new_classification then unchanged:=unchanged+1;continue;end if;
      if not(d ? 'expected_version') or coalesce(content_row.current_version,1) is distinct from (d->>'expected_version')::integer then
        raise exception 'El contenido cambió desde que lo abriste. Actualiza la lista y vuelve a revisar.' using errcode='40001';
      end if;
      next_payload := coalesce(content_row.payload,'{}'::jsonb)||new_classification;
      update public.content_items set specialty=specialty_value,topic=topic_value,subtopic=subtopic_value,section=section_value,
        payload=next_payload,current_version=coalesce(content_row.current_version,1)+1,updated_at=stamp where id=item_id;
      insert into public.content_versions(content_id,version,action,payload,source_hash,published_by,published_at)
      values(item_id,coalesce(content_row.current_version,1)+1,'updated',next_payload,content_row.source_hash,actor,stamp);
    else
      select * into question_row from public.questions where id=item_id for update;
      if not found or question_row.status<>'published' then raise exception 'Pregunta publicada no encontrada.' using errcode='22023'; end if;
      old_classification := jsonb_build_object('specialty',question_row.specialty,'topic',question_row.topic,'subtopic',question_row.subtopic,'section',question_row.section,'classification_origin',question_row.remnote_metadata->>'classification_origin');
      if old_classification=(new_classification-'path') then unchanged:=unchanged+1;continue;end if;
      if not(d ? 'expected_updated_at') or question_row.updated_at is distinct from (d->>'expected_updated_at')::timestamptz then
        raise exception 'La pregunta cambió desde que la abriste. Actualiza la lista y vuelve a revisar.' using errcode='40001';
      end if;
      update public.questions set specialty=specialty_value,topic=topic_value,subtopic=subtopic_value,section=section_value,
        remnote_metadata=coalesce(question_row.remnote_metadata,'{}'::jsonb)||new_classification,updated_at=stamp where id=item_id;
    end if;
    insert into public.classification_change_log(item_kind,item_id,old_classification,new_classification,changed_by,changed_at)
    values(item_kind,item_id,old_classification,new_classification,actor,stamp);
    changed:=changed+1;
  end loop;
  return jsonb_build_object('changed',changed,'unchanged',unchanged);
end;
$$;
revoke all on function public.nexmir_regroup_published(jsonb) from public;
grant execute on function public.nexmir_regroup_published(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
