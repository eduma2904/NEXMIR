-- NEXMIR 5.1.16: independent Arcade bank. Run once in Supabase SQL Editor.
-- Repeat-safe: never overwrites edits to seeded questions.
begin;
create table if not exists public.arcade_questions (
 id uuid primary key default gen_random_uuid(),
 game text not null default 'codigo_vital' check (game='codigo_vital'),
 specialty text not null check (char_length(btrim(specialty)) between 2 and 160),
 category text not null check (char_length(btrim(category)) between 2 and 80),
 answer text not null check (char_length(btrim(answer)) between 2 and 80 and answer ~ '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ -]+$' and answer ~ '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]'),
 clue text not null check (char_length(btrim(clue)) between 15 and 1200 and right(btrim(clue),1)='?'),
 explanation text not null check (char_length(btrim(explanation)) between 10 and 3000),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.arcade_questions enable row level security;
-- Optional metadata: existing questions remain playable without a topic.
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
revoke all on public.arcade_questions from anon;
grant select,insert,update,delete on public.arcade_questions to authenticated;
drop policy if exists arcade_read on public.arcade_questions;
create policy arcade_read on public.arcade_questions for select to authenticated using (published or exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
drop policy if exists arcade_admin on public.arcade_questions;
create policy arcade_admin on public.arcade_questions for all to authenticated using (exists(select 1 from public.profiles where id=auth.uid() and role='admin')) with check (exists(select 1 from public.profiles where id=auth.uid() and role='admin'));
create index if not exists arcade_published_specialty_idx on public.arcade_questions(game,published,specialty);
insert into public.arcade_questions(id,specialty,category,answer,clue,explanation,published) values
('a7cade00-0000-4000-8000-000000000001','Enfermedades Infecciosas','Fármacos','DOLUTEGRAVIR','¿Qué antirretroviral inhibe la integrasa del VIH e impide la integración del ADN viral?','Dolutegravir es un inhibidor de la transferencia de cadena de la integrasa del VIH.',true),
('a7cade00-0000-4000-8000-000000000002','Endocrinología y Nutrición','Fármacos','METFORMINA','¿Cuál es la biguanida de primera línea en numerosos pacientes con diabetes mellitus tipo 2?','La metformina disminuye principalmente la producción hepática de glucosa.',true),
('a7cade00-0000-4000-8000-000000000003','Enfermedades Infecciosas','Diagnósticos','ENDOCARDITIS','Paciente con fiebre, soplo y hemocultivos positivos. ¿Cuál es el diagnóstico más probable?','La endocarditis infecciosa se estudia mediante hemocultivos y ecocardiografía, entre otros hallazgos.',true),
('a7cade00-0000-4000-8000-000000000004','Enfermedades Infecciosas','Microorganismos','SALMONELLA','¿Qué género de bacilos gramnegativos se asocia a fiebre tifoidea y gastroenteritis?','Salmonella incluye serovares causantes de gastroenteritis y fiebre entérica.',true),
('a7cade00-0000-4000-8000-000000000005','Enfermedades Infecciosas','Fármacos','AMOXICILINA','¿Qué antibiótico betalactámico pertenece al grupo de las aminopenicilinas?','Amoxicilina inhibe la síntesis de la pared bacteriana al unirse a proteínas fijadoras de penicilina.',true),
('a7cade00-0000-4000-8000-000000000006','Enfermedades Infecciosas','Diagnósticos','MENINGITIS','Paciente con fiebre, cefalea y rigidez de nuca. ¿Cuál es el diagnóstico sindrómico más probable?','La meningitis puede tener etiologías infecciosas y no infecciosas; requiere valoración urgente ante sospecha clínica.',true),
('a7cade00-0000-4000-8000-000000000007','Neumología','Perlas MIR','LINFANGIOLEIOMIOMATOSIS','Mujer joven con disnea progresiva, neumotórax recurrente, quistes pulmonares difusos de pared fina y angiomiolipomas renales. ¿Cuál es el diagnóstico?','La linfangioleiomiomatosis se asocia a angiomiolipomas renales y afecta típicamente a mujeres en edad fértil.',true),
('a7cade00-0000-4000-8000-000000000008','Neumología','Tratamiento clave','DURVALUMAB','Carcinoma de pulmón no microcítico estadio III irresecable, sin progresión tras quimiorradioterapia concomitante. ¿Qué fármaco se usa como consolidación?','Durvalumab es un anti-PD-L1 indicado como mantenimiento tras quimiorradioterapia en este contexto.',true),
('a7cade00-0000-4000-8000-000000000009','Neumología','Tratamiento clave','NINTEDANIB','Paciente con fibrosis pulmonar idiopática progresiva. ¿Qué antifibrótico puede ralentizar el deterioro de la función pulmonar?','Nintedanib inhibe tirosina-cinasas y puede ralentizar la progresión de la fibrosis pulmonar.',true),
('a7cade00-0000-4000-8000-000000000010','Neumología','Perlas MIR','PROTEINOSIS ALVEOLAR','Disnea subaguda e infiltrado bilateral en alas de mariposa sin insuficiencia cardiaca; lavado broncoalveolar lechoso con material PAS positivo. ¿Cuál es el diagnóstico?','La proteinosis alveolar se caracteriza por acumulación intraalveolar de material PAS positivo.',true),
('a7cade00-0000-4000-8000-000000000011','Neumología','Tratamiento clave','LAVADO ALVEOLAR','Paciente con proteinosis alveolar primaria y deterioro del intercambio gaseoso. ¿Cuál es el procedimiento terapéutico característico?','Los lavados alveolares repetidos son el tratamiento característico de la proteinosis alveolar primaria.',true),
('a7cade00-0000-4000-8000-000000000012','Neumología','Criterios y pruebas','EXUDADO','Líquido pleural con proteínas pleural/séricas mayores de 0,5 y LDH pleural/sérica mayor de 0,6. Según Light, ¿cómo se clasifica?','Criterios de Light (uno basta para EXUDADO): 1) proteínas pleural/sérica >0,5; 2) LDH pleural/sérica >0,6; 3) LDH pleural >2/3 del límite superior normal de LDH sérica. TRASUDADO: no cumple ninguno de los tres (cocientes ≤0,5 y ≤0,6, y LDH pleural ≤2/3 del límite). En este caso se cumplen los dos primeros, por lo que es exudado. Los diuréticos pueden hacer que un trasudado cardíaco aparente exudado.',true),
('a7cade00-0000-4000-8000-000000000013','Neumología','Criterios y pruebas','CATETERISMO','Sospecha de hipertensión pulmonar tras ecocardiograma. ¿Qué prueba confirma el diagnóstico y mide las presiones pulmonares?','El cateterismo cardiaco derecho confirma definitivamente la hipertensión pulmonar.',true),
('a7cade00-0000-4000-8000-000000000014','Neumología','Criterios y pruebas','POLISOMNOGRAFIA','Obesidad, somnolencia diurna, ronquido intenso y apneas presenciadas durante el sueño. ¿Qué estudio nocturno completo es el de referencia?','La polisomnografía permite estudiar los eventos respiratorios y el sueño de forma completa.',true),
('a7cade00-0000-4000-8000-000000000015','Neumología','Tratamiento clave','OMALIZUMAB','Paciente asmático con tapones mucosos marrones, IgE elevada y bronquiectasias centrales por aspergilosis broncopulmonar alérgica. ¿Qué biológico puede ser útil?','Omalizumab puede ser útil en pacientes asmáticos con aspergilosis broncopulmonar alérgica.',true),
('a7cade00-0000-4000-8000-000000000016','Neumología','Perlas MIR','HISTIOCITOSIS','Varón fumador con nódulos y quistes de predominio en lóbulos superiores; células CD1 positivas y gránulos de Birbeck. ¿Cuál es el diagnóstico?','La histiocitosis X pulmonar se asocia al tabaco y a células de Langerhans con gránulos de Birbeck.',true)
on conflict(id) do nothing;
commit;
notify pgrst,'reload schema';
