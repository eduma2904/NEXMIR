-- Existing Arcade installations: run once in Supabase SQL Editor.
-- Revises untouched starter cases and adds image storage policies. Safe to repeat.
begin;
alter table public.arcade_questions add column if not exists topic text
 check (topic is null or char_length(btrim(topic)) between 1 and 160);
alter table public.arcade_questions add column if not exists answer_image_path text
 check (answer_image_path is null or char_length(btrim(answer_image_path)) between 1 and 300);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('arcade-images','arcade-images',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;
drop policy if exists arcade_images_read on storage.objects;
create policy arcade_images_read on storage.objects for select to authenticated
 using(bucket_id='arcade-images');
drop policy if exists arcade_images_admin_insert on storage.objects;
create policy arcade_images_admin_insert on storage.objects for insert to authenticated
 with check(bucket_id='arcade-images' and exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
drop policy if exists arcade_images_admin_delete on storage.objects;
create policy arcade_images_admin_delete on storage.objects for delete to authenticated
 using(bucket_id='arcade-images' and exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
-- Only revise the original starter values; preserve user edits.
update public.arcade_questions set answer='PROTEINOSIS ALVEOLAR',updated_at=now()
 where id='a7cade00-0000-4000-8000-000000000010' and answer='PROTEINOSISALVEOLAR';
update public.arcade_questions set answer='LAVADO ALVEOLAR',updated_at=now()
 where id='a7cade00-0000-4000-8000-000000000011' and answer='LAVADOALVEOLAR';
update public.arcade_questions set explanation='Criterios de Light (uno basta para EXUDADO): 1) proteínas pleural/sérica >0,5; 2) LDH pleural/sérica >0,6; 3) LDH pleural >2/3 del límite superior normal de LDH sérica. TRASUDADO: no cumple ninguno de los tres (cocientes ≤0,5 y ≤0,6, y LDH pleural ≤2/3 del límite). En este caso se cumplen los dos primeros, por lo que es exudado. Los diuréticos pueden hacer que un trasudado cardíaco aparente exudado.',updated_at=now()
 where id='a7cade00-0000-4000-8000-000000000012' and explanation='Los criterios de Light clasifican este derrame pleural como exudado.';
commit;
notify pgrst,'reload schema';
