-- NEXMIR V5.0.22 · execute once in Supabase > SQL Editor.
-- Content, versions and audit commit together for each bounded batch.
-- Repeating an identical (import, batch) returns its receipt without rewriting.
begin;

create table if not exists public.remnote_batch_receipts (
  import_id uuid not null references public.remnote_imports(id) on delete cascade,
  batch_id integer not null check (batch_id >= 0),
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (import_id, batch_id)
);
alter table public.remnote_batch_receipts enable row level security;
-- Only the checked function writes receipts. No direct client grants.
revoke all on public.remnote_batch_receipts from anon, authenticated;

create or replace function public.nexmir_publish_remnote_batch(
  p_import_id uuid,
  p_batch_id integer,
  p_changes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  imp public.remnote_imports%rowtype;
  rec public.content_items%rowtype;
  receipt public.remnote_batch_receipts%rowtype;
  d jsonb;
  incoming jsonb;
  source_id public.content_items.source_uid%type;
  item_kind public.content_items.kind%type;
  card_type_value public.content_items.card_type%type;
  audit_kind public.remnote_import_changes.kind%type;
  change_kind public.remnote_import_changes.change_type%type;
  next_version integer;
  version_action public.content_versions.action%type;
  processed integer := 0;
  skipped integer := 0;
  result_json jsonb;
  request_digest text;
  stamp timestamptz := now();
begin
  if actor is null or not exists (
    select 1 from public.profiles where id = actor and role in ('admin','moderator')
  ) then
    raise exception 'Solo administración puede publicar RemNote.' using errcode = '42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'Se esperaba una lista de cambios.' using errcode = '22023';
  end if;
  if p_import_id is null and p_batch_id = 0 and jsonb_array_length(p_changes) = 0 then
    return jsonb_build_object('available',true,'max_rows',100);
  end if;
  if p_batch_id is null or p_batch_id < 0 or jsonb_array_length(p_changes) not between 1 and 100 then
    raise exception 'El lote debe contener entre 1 y 100 cambios.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_changes) c
    group by c->>'source_uid', c->>'kind' having count(*) > 1
  ) then raise exception 'El lote contiene identificadores repetidos.' using errcode = '22023'; end if;
  -- Lock one import and then serialize RemNote writes to avoid racing admins.
  select * into imp from public.remnote_imports where id = p_import_id for update;
  if not found then raise exception 'Importación no encontrada.' using errcode = '22023'; end if;
  if imp.created_by is distinct from actor then
    raise exception 'La importación pertenece a otra cuenta.' using errcode = '42501';
  end if;
  request_digest := md5(p_changes::text);
  select * into receipt from public.remnote_batch_receipts where import_id = p_import_id and batch_id = p_batch_id;
  if found then
    if receipt.request_hash <> request_digest then
      raise exception 'El contenido de un lote confirmado no puede cambiar.' using errcode = '22023';
    end if;
    return receipt.result;
  end if;
  if imp.status <> 'review' then raise exception 'La importación ya no está en revisión.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(50220022);
  for d in select value from jsonb_array_elements(p_changes)
  loop
    source_id := d->>'source_uid';item_kind := d->>'kind';audit_kind := d->>'kind';change_kind := d->>'change_type';
    if coalesce(source_id,'') = '' or item_kind is null or item_kind not in ('card','theory')
      or change_kind is null or change_kind not in ('new','modified','missing') then
      raise exception 'Cambio no válido.' using errcode = '22023';
    end if;
    if coalesce((d->>'selected')::boolean,false) then
      select * into rec from public.content_items where source_uid = source_id for update;
      if change_kind = 'missing' then
        if rec.id is not null then
          next_version := coalesce(rec.current_version,1)+1;incoming := rec.payload;version_action := 'archived';
          update public.content_items set status='archived',current_version=next_version,archived_at=stamp,updated_at=stamp where id=rec.id;
        else
          skipped := skipped+1;
        end if;
      else
        incoming := d->'new_payload';
        if incoming is null or jsonb_typeof(incoming) <> 'object' then
          raise exception 'Falta el contenido del cambio.' using errcode = '22023';
        end if;
        card_type_value := case when item_kind='card' then incoming->>'type' else null end;
        if rec.id is null then
          insert into public.content_items(source_uid,kind,card_type,status,current_version,payload,source_hash,source_path,specialty,topic,subtopic,section,last_reviewed_at,created_by)
          values(source_id,item_kind,card_type_value,'published',1,incoming,incoming->>'content_hash',incoming->>'source',coalesce(incoming->>'specialty','Sin clasificar'),coalesce(incoming->>'topic','General'),incoming->>'subtopic',incoming->>'section',stamp,actor)
          returning * into rec;
          next_version := 1;version_action := 'created';
        else
          next_version := coalesce(rec.current_version,1)+1;version_action := 'updated';
          update public.content_items set kind=item_kind,card_type=card_type_value,
            status='published',current_version=next_version,payload=incoming,source_hash=incoming->>'content_hash',source_path=incoming->>'source',
            specialty=coalesce(incoming->>'specialty','Sin clasificar'),topic=coalesce(incoming->>'topic','General'),subtopic=incoming->>'subtopic',section=incoming->>'section',
            last_reviewed_at=stamp,updated_at=stamp,archived_at=null where id=rec.id;
        end if;
      end if;
      if rec.id is not null then
        insert into public.content_versions(content_id,version,action,payload,source_hash,published_by,published_at)
        values(rec.id,next_version,version_action,incoming,incoming->>'content_hash',actor,stamp);
      end if;
      processed := processed+1;
    end if;
    insert into public.remnote_import_changes(import_id,source_uid,kind,change_type,old_payload,new_payload,selected,reviewed)
    values(p_import_id,source_id,audit_kind,change_kind,nullif(d->'old_payload','null'::jsonb),nullif(d->'new_payload','null'::jsonb),coalesce((d->>'selected')::boolean,false),coalesce((d->>'selected')::boolean,false));
  end loop;
  result_json := jsonb_build_object('processed',processed,'skipped',skipped,'batch_id',p_batch_id);
  insert into public.remnote_batch_receipts(import_id,batch_id,request_hash,result) values(p_import_id,p_batch_id,request_digest,result_json);
  return result_json;
end;
$$;
revoke all on function public.nexmir_publish_remnote_batch(uuid,integer,jsonb) from public;
grant execute on function public.nexmir_publish_remnote_batch(uuid,integer,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
