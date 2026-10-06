const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');

async function main(){
  const db=new PGlite();
  await db.exec(`
    create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
    create table profiles(id uuid primary key,role text);
    insert into profiles values('00000000-0000-0000-0000-000000000001','admin'),('00000000-0000-0000-0000-000000000002','user');
    create table content_items(id uuid primary key default gen_random_uuid(),source_uid text unique,kind text,card_type text,status text,
      payload jsonb,current_version integer default 1,source_path text,source_hash text,specialty text,topic text,subtopic text,section text,
      updated_at timestamptz,last_reviewed_at timestamptz);
    create table questions(id uuid primary key default gen_random_uuid(),source_uid text,stem text,options jsonb,correct_index integer,
      explanation text,specialty text,topic text,subtopic text,section text,status text,source text,source_exam text,updated_at timestamptz);
    create table content_versions(content_id uuid,version integer,action text,payload jsonb,source_hash text,published_by uuid,published_at timestamptz);
    select set_config('test.actor','00000000-0000-0000-0000-000000000001',false);
  `);
  const sql=fs.readFileSync(path.join(__dirname,'../supabase/TEST_CONTENT_SYNC.sql'),'utf8');
  const payload=(n=4)=>({type:'multiple_choice',front:'Pregunta de cardiología',options:Array.from({length:n},(_,i)=>({text:'Respuesta '+i,correct:i===n-1,extra:[]})),explanation:['Explicación original'],content_use:'study'});
  async function add(uid,p,cardType='multiple_choice'){
    return (await db.query(`insert into content_items(source_uid,kind,card_type,status,payload,specialty,topic) values($1,'card',$2,'published',$3,'Cardiología','General') returning id`,[uid,cardType,p])).rows[0].id;
  }
  const seed=await add('seed',payload());await db.exec(sql);
  const first=(await db.query(`select * from questions where source_uid='remnote:seed'`)).rows[0];
  assert.equal(first.status,'published');assert.equal(first.correct_index,3);
  assert.equal(first.remnote_metadata.content_id,seed);
  await db.exec(sql);
  assert.equal((await db.query('select count(*)::int n from questions')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from content_versions')).rows[0].n,0);
  console.log('PASS migration backfill and repeatability');

  for(const n of [2,5]){await add('options'+n,payload(n));const q=(await db.query('select * from questions where source_uid=$1',['remnote:options'+n])).rows[0];assert.equal(q.options.length,n);assert.equal(q.correct_index,n-1);assert.equal(q.status,'published')}
  for(const type of ['basic','cloze','ordered','reverse','bidirectional','multiline'])await add(type,{type,front:'Recuerdo',back:'Respuesta',content_use:'simulation'},type);
  assert.equal((await db.query('select count(*)::int n from questions')).rows[0].n,3);
  const bad=payload();bad.options[0].text='';await add('invalid',bad);
  assert.equal((await db.query(`select status from questions where source_uid='remnote:invalid'`)).rows[0].status,'draft');
  console.log('PASS only complete MCQ enter test modes; all option counts preserved');

  await db.query(`update content_items set payload=jsonb_set(payload,'{front}','"Enunciado corregido"') where id=$1`,[seed]);
  assert.equal((await db.query(`select stem from questions where id=$1`,[first.id])).rows[0].stem,'Enunciado corregido');
  await db.query(`update questions set stem='Editada desde el banco',options='["Uno","Dos"]',correct_index=1,explanation='Explicación corregida' where id=$1`,[first.id]);
  const rec=(await db.query('select * from content_items where id=$1',[seed])).rows[0];
  assert.equal(rec.payload.front,'Editada desde el banco');assert.equal(rec.payload.options.length,2);assert.equal(rec.payload.options[1].correct,true);assert.equal(rec.current_version,2);
  assert.equal((await db.query('select count(*)::int n from content_versions')).rows[0].n,1);
  console.log('PASS edits synchronize both ways, preserving question IDs and content versions');

  await db.query(`update questions set status='archived' where id=$1`,[first.id]);
  assert.equal((await db.query('select status from content_items where id=$1',[seed])).rows[0].status,'archived');
  await db.query(`update content_items set status='published' where id=$1`,[seed]);
  assert.equal((await db.query('select status from questions where id=$1',[first.id])).rows[0].status,'published');
  await db.query('delete from content_items where id=$1',[seed]);
  assert.equal((await db.query('select status from questions where id=$1',[first.id])).rows[0].status,'archived');
  await db.query(`delete from questions where source_uid='remnote:options2'`);
  assert.equal((await db.query(`select status from content_items where source_uid='options2'`)).rows[0].status,'archived');
  console.log('PASS archive, restore and deletion do not leave active copies');

  assert.equal((await db.query('select nexmir_test_content_sync_ready() ready')).rows[0].ready.available,true);
  await db.exec(`select set_config('test.actor','00000000-0000-0000-0000-000000000002',false)`);
  await assert.rejects(db.query('select nexmir_test_content_sync_ready()'),/Solo administración/);
  assert.equal((await db.query(`select has_function_privilege('authenticated','nexmir_sync_content_test(content_items)','execute') allowed`)).rows[0].allowed,false);
  console.log('PASS readiness requires administration; synchronization functions are not exposed');
  await db.close();
}
main().catch(e=>{console.error(e);process.exitCode=1});
