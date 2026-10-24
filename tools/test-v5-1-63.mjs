import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('app.js');
const dashboard=read('dashboard.js');
const resume=read('study_resume.js');
const personalization=read('personalization.js');
const html=read('index.dev.html');
const quality=read('quality_refinements.css');

assert.match(dashboard,/const options=\(q\.options\|\|\[\]\)\.map\(/,'La tarjeta diaria debe mostrar todas las alternativas');
assert.doesNotMatch(dashboard,/\(q\.options\|\|\[\]\)\.slice\(0,3\)/,'La tarjeta diaria no debe ocultar alternativas');
assert.match(dashboard,/reviewQuestionPreview\(q,190\)/,'El enunciado diario debe cortarse por palabras y con elipsis');
assert.match(dashboard,/window\.nexmirBeginStudy\?\.\('questions'\)/,'La pregunta diaria debe iniciar el cronómetro');

assert.match(app,/function closeDailyQuestion\(\).*?window\.nexmirClearBankResume\?\.\(\)/s,'Cerrar la pregunta diaria debe limpiar su recuperación');
assert.match(app,/state\.bank=\{pool:\[\],index:0.*?context:null/s,'Cerrar la pregunta diaria debe descartar el estado temporal');
assert.match(app,/#questionDialog'\)\?\.addEventListener\('cancel'.*?closeBankDialog/s,'Escape debe pasar por el cierre controlado');
assert.match(app,/#questionDialog'\)\?\.addEventListener\('cancel'.*?state\.diagnostic\?\.active.*?closeDiagnostic.*?#questionDialog #bankStem.*?closeBankDialog/s,'Escape debe respetar el flujo activo: diagnóstico o banco');

assert.match(resume,/bank\?\.context!==\'daily\'/,'La pregunta diaria no debe guardarse como banqueo pendiente');
assert.match(resume,/value\?\.bank\?\.context===\'daily\'/,'Las recuperaciones antiguas de preguntas diarias deben sanearse');
assert.match(resume,/window\.nexmirClearBankResume=/,'Debe existir una limpieza específica que no borre Focus');
assert.match(personalization,/window\.nexmirBeginStudy=beginStudy/,'El cronómetro debe exponer una entrada común para nuevos flujos');

assert.match(html,/quality_refinements\.css\?v=5\.1\.63/,'La capa final de calidad debe cargarse en desarrollo y producción');
assert.match(quality,/--n-primary:var\(--ui-accent\)/,'El acento visual debe tener una única fuente efectiva');
assert.match(quality,/sim-result-card span[\s\S]*font-size:12px!important/,'Los resultados no deben usar texto de 9 px');

for(const match of html.matchAll(/<button\b([^>]*)>([×✕✖])<\/button>/g)){
  assert.match(match[1],/aria-label=/,`Botón de cierre sin nombre accesible: ${match[0]}`);
}

// Comportamiento real del selector diario: abre la clave exacta e inicia el tiempo.
{
  const q1={id:'q1',_source:'questions',stem:'Primera',options:['A','B'],_aliases:['questions:q1']};
  const q2={id:'q2',_source:'questions',stem:'Segunda',options:['A','B'],_aliases:['questions:q2']};
  let timerKind=null,shown=0;
  const context={
    state:{attempts:[],bank:null,view:'dashboard'},
    questionPool:()=>[q1,q2],showQuestion:()=>{shown++},toast:()=>{},
    esc:String,reviewQuestionPreview:q=>q.stem||'',NxIcon:()=>'',
    document:{querySelector:()=>null},setTimeout:()=>0,
  };
  context.window=context;context.window.addEventListener=()=>{};
  context.window.nexmirBeginStudy=kind=>{timerKind=kind};
  vm.runInNewContext(dashboard,context,{filename:'dashboard.js'});
  assert.equal(context.openDailyQuestion(encodeURIComponent('questions:q2')),true);
  assert.equal(context.state.bank.pool[0],q2,'Debe abrir la pregunta pulsada, no otra del banco');
  assert.equal(context.state.bank.context,'daily');
  assert.equal(timerKind,'questions');
  assert.equal(shown,1);
}

// Comportamiento real de la recuperación: nunca persiste una pregunta diaria.
{
  const values=new Map();
  const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const state={user:{id:'u1'},deviceBlocked:false,view:'dashboard',bank:{context:'daily',pool:[{id:'q1',_source:'questions'}],index:0,answers:{}},focusActiveSession:null};
  const context={state,localStorage,toast:()=>{},questionPool:()=>[],bankQKey:q=>`questions:${q.id}`,renderBankResults:()=>{},showQuestion:()=>{},route:async()=>{},console};
  context.document={querySelector:()=>null,getElementById:()=>null};
  context.window={route:async()=>{},renderBank:()=>{},addEventListener:()=>{}};
  vm.runInNewContext(resume,context,{filename:'study_resume.js'});
  context.window.nexmirSaveStudy();
  const saved=JSON.parse(values.get('nexmir_study_resume:u1'));
  assert.equal(saved.bank,undefined,'La Pregunta del día no debe convertirse en un banqueo pendiente');
}

console.log('✔ test-v5-1-63: Pregunta del día, cronómetro, recuperación, legibilidad y accesibilidad verificados.');
