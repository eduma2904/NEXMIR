#!/usr/bin/env node
/* NEXMIR: verificación previa a subir a GitHub.
   Uso:  node tools/verificar_js.js      (desde la carpeta raíz del proyecto)
   1) Revisa la sintaxis de cada .js.
   2) Une los scripts en el orden de index.html y detecta variables NO definidas
      (el error que rompió Focus en 5.1.45: "client is not defined").
   Requiere internet la primera vez (descarga eslint con npx). Sale con código 1 si hay errores. */
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os');
const root=process.cwd();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const files=[...html.matchAll(/<script[^>]*src="([^"?]+\.js)(?:\?[^"]*)?"/g)].map(m=>m[1]).filter(f=>!/^https?:/.test(f)&&!/^vendor\//.test(f));
let bad=false,all=[],map=[];
for(const f of files){
  const p=path.join(root,f);
  if(!fs.existsSync(p)){console.error('FALTA el archivo referenciado en index.html:',f);bad=true;continue}
  const r=cp.spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status){console.error('SINTAXIS',f,'\n'+r.stderr);bad=true}
  const lines=fs.readFileSync(p,'utf8').split('\n');map.push([all.length,all.length+lines.length,f]);all=all.concat(lines);
}
// Globales que se asignan sin declarar o vienen de UMD (válidos en tiempo de ejecución)
const allow=['module','exports','define','RemnoteTaxonomy','NexmirContentRules','NexmirPlanRules','NexmirFocusRules','renderBattles','renderCalendar'];
// Nombres que algún script publica con window.X = ... (o root./globalThis.X =) también son globales válidos
for(const m of all.join('\n').matchAll(/\b(?:window|root|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g))if(!allow.includes(m[1]))allow.push(m[1]);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'nexmir-'));
fs.writeFileSync(path.join(tmp,'all.js'),all.join('\n'));
fs.writeFileSync(path.join(tmp,'rc.json'),JSON.stringify({root:true,env:{browser:true,es2022:true},parserOptions:{ecmaVersion:2022,sourceType:'script'},globals:Object.fromEntries(allow.map(n=>[n,'writable'])),rules:{'no-undef':'error','no-const-assign':'error','no-dupe-keys':'error'}}));
const r=cp.spawnSync('npx',['--yes','eslint@8','--no-eslintrc','-c',path.join(tmp,'rc.json'),'--format','json',path.join(tmp,'all.js')],{encoding:'utf8',shell:process.platform==='win32'});
let res;try{res=JSON.parse(r.stdout)[0].messages}catch{console.error('No se pudo ejecutar eslint:',r.stderr||r.stdout);process.exit(1)}
const where=l=>{for(const [a,b,f] of map)if(a<l&&l<=b)return `${f}:${l-a}`;return '?'};
for(const m of res){console.error(`${where(m.line)}  ${m.message}  [${m.ruleId}]`);bad=true}
console.log(bad?'\nHAY ERRORES: no subas esta versión.':'OK: sin variables indefinidas ni errores de sintaxis.');
process.exit(bad?1:0);
