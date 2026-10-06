-- NEXMIR V5.0.29 · Execute once on the existing project in SQL Editor.
-- Installs individual editing/deletion. Running this file does not delete content.
begin;

-- Alinea profiles con las funciones Free/Pro, nombre visible y dispositivo que usa la app.
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists active_device_id text;
alter table public.profiles add column if not exists active_device_label text;
alter table public.profiles add column if not exists device_updated_at timestamptz;

-- La interfaz de bancos/simulacros usa el año de origen de cada pregunta.
alter table public.questions add column if not exists year integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_plan_check' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_plan_check check (plan in ('free','pro'));
  end if;
end $$;

-- Completa datos existentes desde Auth sin sobrescribir valores ya guardados.
update public.profiles p
set email=coalesce(p.email,u.email),
    display_name=coalesce(nullif(p.display_name,''),nullif(u.raw_user_meta_data->>'display_name',''),split_part(coalesce(u.email,''),'@',1))
from auth.users u
where u.id=p.id and (p.email is null or p.display_name is null or p.display_name='');

-- Restrictive policies apply even if an older permissive policy grants DELETE.
alter table public.content_items enable row level security;
alter table public.questions enable row level security;
drop policy if exists nexmir_content_delete_admin_only on public.content_items;
create policy nexmir_content_delete_admin_only on public.content_items as restrictive
for delete to anon,authenticated using (exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
drop policy if exists nexmir_question_delete_admin_only on public.questions;
create policy nexmir_question_delete_admin_only on public.questions as restrictive
for delete to anon,authenticated using (exists(select 1 from public.profiles where id=auth.uid() and role='admin'));

-- Prevent a regular browser account from granting itself admin privileges.
create or replace function public.nexmir_guard_profile_role() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(auth.role(),'') in ('anon','authenticated') then
    if (TG_OP='INSERT' and (coalesce(new.role::text,'user') <> 'user' or coalesce(new.plan::text,'free') <> 'free'))
      or (TG_OP='UPDATE' and (new.role is distinct from old.role or new.plan is distinct from old.plan)) then
      if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
        raise exception 'Solo un administrador puede asignar roles o planes.' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists nexmir_guard_profile_role on public.profiles;
create trigger nexmir_guard_profile_role before insert or update of role,plan on public.profiles
for each row execute function public.nexmir_guard_profile_role();

create or replace function public.nexmir_edit_content(
  p_id uuid,
  p_kind text,
  p_action text,
  p_payload jsonb default null,
  p_expected_version integer default null,
  p_expected_updated_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid:=auth.uid();
  rec public.content_items%rowtype;
  question_row public.questions%rowtype;
  next_payload jsonb;
  ver integer;
  stamp timestamptz:=clock_timestamp();
  tbl text;
  predicate text;
  source_type_value text;
  source_uid_value text;
  correct_count integer;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin') then
    raise exception 'Solo un administrador puede editar o eliminar contenido.' using errcode='42501';
  end if;
  if p_id is null or p_kind is null or p_kind not in ('content','question') or p_action is null or p_action not in ('edit','delete') then
    raise exception 'Acción o contenido no válido.' using errcode='22023';
  end if;
  -- Same lock as publication: edits and imports cannot overwrite each other mid-transaction.
  perform pg_advisory_xact_lock(50220022);
  if p_kind='content' then
    select * into rec from public.content_items where id=p_id for update;
    if not found then raise exception 'El contenido ya no existe. Actualiza el panel.' using errcode='P0002'; end if;
    if p_expected_version is null or p_expected_version is distinct from rec.current_version then
      raise exception 'Otra sesión modificó este contenido. Actualiza el panel antes de continuar.' using errcode='40001';
    end if;
    source_type_value:='remnote';source_uid_value:=rec.source_uid;
  else
    if p_action <> 'delete' then raise exception 'Usa el editor de preguntas para modificar el banco.' using errcode='22023'; end if;
    select * into question_row from public.questions where id=p_id for update;
    if not found then raise exception 'La pregunta ya no existe. Actualiza el panel.' using errcode='P0002'; end if;
    if p_expected_updated_at is null or p_expected_updated_at is distinct from question_row.updated_at then
      raise exception 'Otra sesión modificó esta pregunta. Actualiza el panel antes de continuar.' using errcode='40001';
    end if;
    source_type_value:='questions';source_uid_value:=question_row.source_uid;
  end if;
  if p_action='edit' then
    if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Falta el contenido.' using errcode='22023'; end if;
    if coalesce(p_payload->>'type','') is distinct from coalesce(rec.payload->>'type','') then
      raise exception 'El editor no cambia el tipo de tarjeta.' using errcode='22023';
    end if;
    if coalesce(btrim(p_payload->>'specialty'),'')='' or lower(btrim(p_payload->>'specialty')) in ('sin clasificar','desagrupadas','unclassified') then
      raise exception 'Elige una asignatura antes de guardar.' using errcode='22023';
    end if;
    if coalesce(p_payload->>'content_use','study') not in ('study','simulation') then raise exception 'Destino no válido.' using errcode='22023'; end if;
    if rec.kind='card' then
      if coalesce(btrim(p_payload->>'front'),'')='' then raise exception 'El anverso no puede quedar vacío.' using errcode='22023'; end if;
      if rec.card_type='multiple_choice' then
        if jsonb_typeof(p_payload->'options') is distinct from 'array' then raise exception 'Faltan alternativas.' using errcode='22023'; end if;
        if jsonb_array_length(p_payload->'options') < 2 then raise exception 'Añade al menos dos alternativas.' using errcode='22023'; end if;
        select count(*) into correct_count from jsonb_array_elements(p_payload->'options') o where o->>'correct'='true';
        if correct_count<>1 or exists(select 1 from jsonb_array_elements(p_payload->'options') o where coalesce(btrim(o->>'text'),'')='') then
          raise exception 'Cada alternativa debe tener texto y exactamente una debe ser correcta.' using errcode='22023';
        end if;
      end if;
    elsif coalesce(btrim(p_payload->>'text'),'')='' then raise exception 'El texto no puede quedar vacío.' using errcode='22023'; end if;
    -- Merge preserves metadata and assets that the editor does not alter.
    next_payload:=coalesce(rec.payload,'{}'::jsonb)||p_payload;
    ver:=coalesce(rec.current_version,1)+1;
    update public.content_items set payload=next_payload,current_version=ver,
      specialty=next_payload->>'specialty',topic=coalesce(nullif(next_payload->>'topic',''),'General'),
      subtopic=nullif(next_payload->>'subtopic',''),section=nullif(next_payload->>'section',''),
      source_hash=next_payload->>'content_hash',last_reviewed_at=stamp,updated_at=stamp where id=p_id;
    insert into public.content_versions(content_id,version,action,payload,source_hash,published_by,published_at)
    values(p_id,ver,'updated',next_payload,next_payload->>'content_hash',actor,stamp);
    return jsonb_build_object('id',p_id,'action','edit','version',ver);
  end if;
  -- Delete only dependants of this record, in one transaction. Keep historical
  -- simulation summaries and Storage assets; other questions may share assets.
  foreach tbl in array array['battle_answers','user_question_attempts','user_flashcard_reviews','user_bookmarks','user_notes','user_error_log','question_reports','content_versions','remnote_import_changes'] loop
    if to_regclass(format('public.%I',tbl)) is null then continue; end if;
    predicate:=case tbl
      when 'battle_answers' then case when p_kind='question' then 'to_jsonb(d)->>''question_id''=$1' else 'false' end
      when 'user_question_attempts' then case when p_kind='content' then 'to_jsonb(d)->>''source_content_id''=$1' else 'to_jsonb(d)->>''question_id''=$1' end
      when 'user_flashcard_reviews' then case when p_kind='content' then 'to_jsonb(d)->>''content_id''=$1' else 'false' end
      when 'user_bookmarks' then '(to_jsonb(d)->>''item_id''=$1)'
      when 'user_notes' then case when p_kind='content' then 'to_jsonb(d)->>''content_id''=$1 or to_jsonb(d)->>''item_id''=$1' else 'to_jsonb(d)->>''question_id''=$1 or to_jsonb(d)->>''item_id''=$1' end
      when 'user_error_log' then 'to_jsonb(d)->>''source_type''=$2 and to_jsonb(d)->>''source_id''=$1'
      when 'question_reports' then 'to_jsonb(d)->>''source_type''=$2 and to_jsonb(d)->>''source_id''=$1'
      when 'content_versions' then case when p_kind='content' then 'to_jsonb(d)->>''content_id''=$1' else 'false' end
      when 'remnote_import_changes' then case when p_kind='content' then 'to_jsonb(d)->>''source_uid''=$3' else 'false' end
      else 'false' end;
    execute format('delete from public.%I d where %s',tbl,predicate) using p_id::text,source_type_value,source_uid_value;
  end loop;
  if p_kind='content' then delete from public.content_items where id=p_id;
  else delete from public.questions where id=p_id; end if;
  return jsonb_build_object('id',p_id,'action','delete');
end; $$;
revoke all on function public.nexmir_edit_content(uuid,text,text,jsonb,integer,timestamptz) from public,anon;
grant execute on function public.nexmir_edit_content(uuid,text,text,jsonb,integer,timestamptz) to authenticated;
commit;
notify pgrst, 'reload schema';
