-- Run in Supabase SQL Editor when upgrading an existing Arcade installation.
-- Preserves current questions and existing reports; safe to repeat.
begin;
alter table public.arcade_questions add column if not exists clue_image_path text
 check (clue_image_path is null or char_length(btrim(clue_image_path)) between 1 and 300);
alter table public.arcade_questions drop constraint if exists arcade_questions_answer_check;
alter table public.arcade_questions drop constraint if exists arcade_answer_format;
alter table public.arcade_questions add constraint arcade_answer_format
 check (char_length(btrim(answer)) between 2 and 160 and answer ~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ -]+$' and answer ~ '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]');

alter table public.question_reports drop constraint if exists question_reports_source_type_check;
alter table public.question_reports drop constraint if exists question_reports_source_type_arcade_check;
alter table public.question_reports add constraint question_reports_source_type_arcade_check
 check (source_type in ('questions','remnote','arcade'));
drop policy if exists reports_insert_self on public.question_reports;
create policy reports_insert_self on public.question_reports for insert to authenticated with check (
 user_id=auth.uid() and status='open' and admin_note is null and reviewed_by is null and reviewed_at is null
 and ((source_type='questions' and exists(select 1 from public.questions q where q.id::text=source_id and q.status='published'))
   or (source_type='remnote' and exists(select 1 from public.content_items c where c.id::text=source_id and c.status='published' and c.kind='card'))
   or (source_type='arcade' and exists(select 1 from public.arcade_questions a where a.id::text=source_id and a.published)))
);
commit;
notify pgrst,'reload schema';
