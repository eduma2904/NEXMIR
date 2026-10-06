const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');

async function main(){
  const db=new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.profiles(id uuid,email text,role text,plan text);
    alter table public.profiles enable row level security;

    create or replace function public.nexmir_refresh_streak()
    returns jsonb language sql security definer set search_path=public,pg_temp
    as $$ select '{}'::jsonb $$;

    create or replace function public.nexmir_add_xp(
      uuid,text,integer,text,text,text,uuid,jsonb
    ) returns integer language sql security definer set search_path=public,pg_temp
    as $$ select 1 $$;

    create or replace function public.nexmir_lock_report_fields()
    returns trigger language plpgsql
    as $$ begin return new; end $$;

    grant execute on function public.nexmir_add_xp(
      uuid,text,integer,text,text,text,uuid,jsonb
    ) to authenticated;
  `);

  const sql=fs.readFileSync(
    path.join(__dirname,'../supabase/SEGURIDAD_5_1_12.sql'),'utf8'
  );
  await db.exec(sql);

  const {rows:[permissions]}=await db.query(`
    select
      has_function_privilege(
        'authenticated','public.nexmir_refresh_streak()','execute'
      ) as public_rpc,
      has_function_privilege(
        'authenticated',
        'public.nexmir_add_xp(uuid,text,integer,text,text,text,uuid,jsonb)',
        'execute'
      ) as internal_rpc,
      has_function_privilege(
        'authenticated','public.nexmir_lock_report_fields()','execute'
      ) as trigger_rpc,
      has_function_privilege(
        'anon','public.nexmir_refresh_streak()','execute'
      ) as anonymous_rpc
  `);

  assert.equal(permissions.public_rpc,true);
  assert.equal(permissions.internal_rpc,false);
  assert.equal(permissions.trigger_rpc,false);
  assert.equal(permissions.anonymous_rpc,false);

  await db.exec(sql);
  const {rows:[repeat]}=await db.query(`
    select has_function_privilege(
      'authenticated','public.nexmir_add_xp(uuid,text,integer,text,text,text,uuid,jsonb)',
      'execute'
    ) as internal_rpc
  `);
  assert.equal(repeat.internal_rpc,false);
  console.log('PASS security allowlist, internal revocation and repeatability');
  await db.close();
}

main().catch(error=>{console.error(error);process.exitCode=1});
