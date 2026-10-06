-- NEXMIR 5.1.4: run once in Supabase SQL Editor before publishing RemNote MCQ.
-- Keep one editable content record and a synchronized question row for battles.
begin;
alter table public.questions add column if not exists source_uid text;
alter table public.questions add column if not exists remnote_metadata jsonb;

create or replace function public.nexmir_sync_content_test(c public.content_items)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  key text := 'remnote:'||c.source_uid;
  p jsonb := coalesce(c.payload,'{}'::jsonb);
  opts jsonb;
  correct integer;
  valid boolean;
  qstatus public.questions.status%type;
  meta jsonb;
  exam public.questions.source_exam%type;
  detail text;
begin
  perform pg_advisory_xact_lock(hashtextextended(key,514));
  if c.kind<>'card' or coalesce(c.card_type::text,p->>'type','')<>'multiple_choice' or c.status<>'published' then
    update public.questions set status='archived',updated_at=now() where source_uid=key;
    return;
  end if;
  opts := case when jsonb_typeof(p->'options')='array' then p->'options' else '[]'::jsonb end;
  select (ordinality-1)::integer into correct from jsonb_array_elements(opts) with ordinality o(value,ordinality)
    where value->>'correct'='true' order by ordinality limit 1;
  valid := jsonb_array_length(opts)>=2 and correct is not null and btrim(coalesce(p->>'front',''))<>''
    and (select count(*) from jsonb_array_elements(opts) o where o->>'correct'='true')=1
    and not exists(select 1 from jsonb_array_elements(opts) o where btrim(coalesce(o->>'text',''))='');
  qstatus := case when valid then 'published' else 'draft' end;
  select coalesce(jsonb_agg(value->>'text' order by ordinality),'[]'::jsonb) into opts
    from jsonb_array_elements(opts) with ordinality o(value,ordinality);
  detail := case when jsonb_typeof(p->'explanation')='array'
    then (select string_agg(value,E'\n') from jsonb_array_elements_text(p->'explanation'))
    else p->>'explanation' end;
  exam := case when p->>'content_use'='simulation' then coalesce(nullif(p->>'archive_name',''),'Simulacro RemNote') else null end;
  meta := jsonb_build_object('content_id',c.id,'native_uid',c.source_uid,'source_path',c.source_path,
    'context',coalesce(p->'context','[]'::jsonb),'classification_origin',p->>'classification_origin',
    'content_use',coalesce(p->>'content_use','study'),'archive_name',p->>'archive_name');
  update public.questions set stem=coalesce(p->>'front',''),options=opts,correct_index=coalesce(correct,0),
    explanation=detail,specialty=c.specialty,topic=c.topic,subtopic=c.subtopic,section=c.section,
    status=qstatus,source='RemNote',source_exam=exam,remnote_metadata=meta,updated_at=now() where source_uid=key;
  if not found then
    insert into public.questions(source_uid,stem,options,correct_index,explanation,specialty,topic,subtopic,section,status,source,source_exam,remnote_metadata)
      values(key,coalesce(p->>'front',''),opts,coalesce(correct,0),detail,c.specialty,c.topic,c.subtopic,c.section,qstatus,'RemNote',exam,meta);
  end if;
end $$;
revoke all on function public.nexmir_sync_content_test(public.content_items) from public,anon,authenticated;

create or replace function public.nexmir_content_test_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if pg_trigger_depth()>1 then return null; end if;
  if TG_OP='DELETE' then
    update public.questions set status='archived',updated_at=now() where source_uid='remnote:'||old.source_uid;
  else
    perform public.nexmir_sync_content_test(new);
  end if;
  return null;
end $$;
revoke all on function public.nexmir_content_test_trigger() from public,anon,authenticated;
drop trigger if exists nexmir_content_test_sync on public.content_items;
create trigger nexmir_content_test_sync after insert or update or delete on public.content_items
  for each row execute function public.nexmir_content_test_trigger();

-- Edits/archives in the question manager must also update the original card.
create or replace function public.nexmir_question_content_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  rec public.content_items%rowtype;
  p jsonb;
  opts jsonb;
  stamp timestamptz:=now();
  content_status public.content_items.status%type;
begin
  if pg_trigger_depth()>1 or old.source_uid not like 'remnote:%' then return null; end if;
  select * into rec from public.content_items where source_uid=substring(old.source_uid from 9) for update;
  if not found then return null; end if;
  if TG_OP='DELETE' then
    update public.content_items set status='archived',updated_at=stamp where id=rec.id;
    return null;
  end if;
  if new.stem is not distinct from old.stem and new.options is not distinct from old.options
    and new.correct_index is not distinct from old.correct_index and new.explanation is not distinct from old.explanation
    and new.specialty is not distinct from old.specialty and new.topic is not distinct from old.topic
    and new.subtopic is not distinct from old.subtopic and new.section is not distinct from old.section
    and new.status is not distinct from old.status then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('text',case when jsonb_typeof(value)='string' then value#>>'{}' else value->>'text' end,
    'correct',(ordinality-1)=new.correct_index,'extra',case when rec.payload->'options'->(ordinality::integer-1)->>'text'=value#>>'{}'
      then coalesce(rec.payload->'options'->(ordinality::integer-1)->'extra','[]'::jsonb) else '[]'::jsonb end) order by ordinality),'[]'::jsonb)
    into opts from jsonb_array_elements(coalesce(new.options,'[]'::jsonb)) with ordinality o(value,ordinality);
  p := rec.payload||jsonb_build_object('front',new.stem,'options',opts,'back',opts->new.correct_index->>'text',
    'explanation',case when coalesce(new.explanation,'')='' then '[]'::jsonb else jsonb_build_array(new.explanation) end,
    'specialty',new.specialty,'topic',new.topic,'subtopic',new.subtopic,'section',new.section,
    'classification_origin','admin_manual');
  p := p||jsonb_build_object('content_hash',md5(p::text));
  content_status := new.status::text;
  update public.content_items set payload=p,status=content_status,current_version=coalesce(rec.current_version,1)+1,
    specialty=new.specialty,topic=new.topic,subtopic=new.subtopic,section=new.section,
    source_hash=p->>'content_hash',updated_at=stamp,last_reviewed_at=stamp where id=rec.id;
  insert into public.content_versions(content_id,version,action,payload,source_hash,published_by,published_at)
    values(rec.id,coalesce(rec.current_version,1)+1,'updated',p,p->>'content_hash',auth.uid(),stamp);
  return null;
end $$;
revoke all on function public.nexmir_question_content_trigger() from public,anon,authenticated;
drop trigger if exists nexmir_question_content_sync on public.questions;
create trigger nexmir_question_content_sync after update or delete on public.questions
  for each row execute function public.nexmir_question_content_trigger();

create or replace function public.nexmir_test_content_sync_ready()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','moderator')) then
    raise exception 'Solo administración puede comprobar la sincronización de tests.' using errcode='42501';
  end if;
  return jsonb_build_object('available',true,'version','5.1.4');
end $$;
revoke all on function public.nexmir_test_content_sync_ready() from public,anon;
grant execute on function public.nexmir_test_content_sync_ready() to authenticated;

-- Backfill existing MCQ, without changing their content or version history.
do $$ declare c public.content_items%rowtype; begin
  for c in select * from public.content_items where kind='card' and card_type='multiple_choice' loop
    perform public.nexmir_sync_content_test(c);
  end loop;
end $$;
commit;
