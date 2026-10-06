-- Ejecutar una vez en el MISMO proyecto Supabase de NEXMIR.
-- Conserva el esquema y los datos existentes. No modifica preguntas.
create table if not exists public.user_error_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('questions','remnote')),
  source_id text not null,
  reason text not null default 'pending' check (reason in ('pending','knowledge','interpretation','memory','time','doubt','other')),
  note text not null default '' check (length(note) <= 1000),
  failures integer not null default 0 check (failures >= 0),
  uncertain boolean not null default false,
  last_error_at timestamptz,
  next_review_at timestamptz not null default (now() + interval '1 day'),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,source_type,source_id)
);
create index if not exists user_error_log_due_idx on public.user_error_log(user_id,next_review_at);
alter table public.user_error_log enable row level security;
drop policy if exists error_log_select_self on public.user_error_log;
create policy error_log_select_self on public.user_error_log for select to authenticated using (user_id=auth.uid());
drop policy if exists error_log_insert_self on public.user_error_log;
create policy error_log_insert_self on public.user_error_log for insert to authenticated with check (user_id=auth.uid());
drop policy if exists error_log_update_self on public.user_error_log;
create policy error_log_update_self on public.user_error_log for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Los fallos de cualquier modalidad se registran incluso al guardar un simulacro en lote.
create or replace function public.nexmir_record_error_attempt() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_source text; v_id text;
begin
  v_source := case when new.question_id is not null then 'questions' else 'remnote' end;
  v_id := coalesce(new.question_id::text,new.source_content_id::text);
  if v_id is null then return new; end if;
  if new.is_correct is true then
    update public.user_error_log set uncertain=false,reviewed_at=coalesce(new.answered_at,now()),
      next_review_at=coalesce(new.answered_at,now())+interval '7 days',updated_at=now()
    where user_id=new.user_id and source_type=v_source and source_id=v_id;
    return new;
  end if;
  if new.is_correct is distinct from false then return new; end if;
  insert into public.user_error_log(user_id,source_type,source_id,failures,last_error_at,next_review_at)
  values(new.user_id,v_source,v_id,1,coalesce(new.answered_at,now()),coalesce(new.answered_at,now())+interval '1 day')
  on conflict(user_id,source_type,source_id) do update set
    failures=public.user_error_log.failures+1,
    last_error_at=excluded.last_error_at,
    next_review_at=least(public.user_error_log.next_review_at,excluded.next_review_at),
    reviewed_at=null,updated_at=now();
  return new;
end $$;
drop trigger if exists nexmir_record_error_attempt on public.user_question_attempts;
create trigger nexmir_record_error_attempt after insert on public.user_question_attempts
for each row execute function public.nexmir_record_error_attempt();

-- Recupera fallos previos sin contar de nuevo los ya registrados.
insert into public.user_error_log(user_id,source_type,source_id,failures,last_error_at,next_review_at)
select a.user_id,
       case when a.question_id is not null then 'questions' else 'remnote' end,
       coalesce(a.question_id::text,a.source_content_id::text),
       count(*)::integer,
       max(a.answered_at),
       max(a.answered_at)+interval '1 day'
from public.user_question_attempts a
where a.is_correct=false and coalesce(a.question_id::text,a.source_content_id::text) is not null
group by a.user_id,case when a.question_id is not null then 'questions' else 'remnote' end,
         coalesce(a.question_id::text,a.source_content_id::text)
on conflict(user_id,source_type,source_id) do nothing;

create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('questions','remnote')),
  source_id text not null,
  part text not null check (part in ('question','answer','explanation','image','other')),
  category text not null check (category in ('incorrect','ambiguous','typo','outdated','missing','other')),
  detail text not null check (length(detail) between 10 and 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists question_reports_status_idx on public.question_reports(status,created_at desc);
alter table public.question_reports enable row level security;
drop policy if exists reports_select_self_or_staff on public.question_reports;
create policy reports_select_self_or_staff on public.question_reports for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','moderator'))
);
drop policy if exists reports_insert_self on public.question_reports;
create policy reports_insert_self on public.question_reports for insert to authenticated with check (
  user_id=auth.uid() and status='open' and admin_note is null and reviewed_by is null and reviewed_at is null
  and ( (source_type='questions' and exists(select 1 from public.questions q where q.id::text=source_id and q.status='published'))
     or (source_type='remnote' and exists(select 1 from public.content_items c where c.id::text=source_id and c.status='published' and c.kind='card')) )
);
drop policy if exists reports_update_staff on public.question_reports;
create policy reports_update_staff on public.question_reports for update to authenticated
using (exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','moderator')))
with check (exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','moderator')));
-- Protege identidad y texto original también frente a llamadas directas a la API.
create or replace function public.nexmir_lock_report_fields() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (new.user_id,new.source_type,new.source_id,new.part,new.category,new.detail,new.created_at)
     is distinct from (old.user_id,old.source_type,old.source_id,old.part,old.category,old.detail,old.created_at) then
    raise exception 'El reporte original no se puede editar';
  end if;
  new.updated_at=now();return new;
end $$;
drop trigger if exists nexmir_lock_report_fields on public.question_reports;
create trigger nexmir_lock_report_fields before update on public.question_reports
for each row execute function public.nexmir_lock_report_fields();
grant select,insert,update on public.user_error_log to authenticated;
grant select,insert,update on public.question_reports to authenticated;
