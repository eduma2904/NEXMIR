import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = read('app.js');

function extract(name) {
  const m = new RegExp(`^(?:async )?function ${name}\\b`, 'm').exec(app);
  assert.ok(m, `No encontré ${name} en app.js`);
  const rest = app.slice(m.index);
  const next = rest.slice(1).search(/\n(?:async )?function \w+|\nconst \w+=|\n\$\('#/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

function makeWindow() {
  const dom = new JSDOM('<!doctype html><body><div id="view-bookmarks"></div><div id="view-errors"></div><dialog id="questionDialog"><div id="questionDialogBody"></div></dialog></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const calls = { toast: [], showQuestion: 0 };
  w.eval(`
    var $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
    var esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    var displaySpecialty=s=>s||'Sin especialidad';
    var bankQKey=q=>(q._source||'questions')+':'+q.id;
    var reviewQuestionPreview=(q,n=120)=>String(q.stem||'').slice(0,n);
    var encodeActionArg=v=>encodeURIComponent(v).replace(/'/g,'%27');
    var state={view:'bookmarks',bookmarks:[],questions:[],content:[],bank:null};
    var questionPool=()=>state.questions.map(q=>({...q,_source:q._source||'questions'}));
    var contentRow=x=>'<div class="list-item">'+x.id+'</div>';
    var __toasts=[],__showQ=0;
    var toast=m=>__toasts.push(m);
    var showQuestion=()=>{__showQ++};
    var renderBankReviewQuestion=()=>{};
  `);
  for (const n of ['bankTick','fmtDuration','bankSummaryData','repeatBankFrom','renderBankSummary','bookmarkedQuestion','bookmarkedQuestions','startBookmarkSession','openBookmarkedQuestion','practiceBookmarkedQuestions','renderBookmarks','answerQuestion']) w.eval(extract(n));
  return { w, calls };
}

const q = (id, topic, correct = 0, src = 'questions') => ({ id, stem: `Pregunta ${id}`, specialty: 'Cardiología', topic, options: ['a', 'b', 'c', 'd'], correct_index: correct, _source: src });

// 1) Tiempos por pregunta y resumen
{
  const { w } = makeWindow();
  w.eval(`
    var __t=1000;Date.now=()=>__t;
    state.bank={pool:[${JSON.stringify(q(1, 'Arritmias'))},${JSON.stringify(q(2, 'Arritmias'))},${JSON.stringify(q(3, 'Valvulopatías'))},${JSON.stringify(q(4, 'Valvulopatías'))}],mode:'end',answers:{},results:[]};
    const b=state.bank;
    bankTick(b,b.pool[0]);__t+=30000;bankTick(b,b.pool[1]);__t+=500000;bankTick(b,b.pool[2]);__t+=60000;bankTick(b,null);
  `);
  const times = w.eval('state.bank.times');
  assert.equal(times['questions:1'], 30000, 'El tiempo de la pregunta 1 debe acumularse');
  assert.equal(times['questions:2'], 180000, 'Un tramo inactivo se limita a 3 minutos');
  assert.equal(times['questions:3'], 60000);
  assert.equal(w.eval('fmtDuration(75000)'), '1:15');
  assert.equal(w.eval('fmtDuration(3900000)'), '1 h 05 min');

  w.eval(`
    const b=state.bank;
    b.answers={'questions:1':{selected:0},'questions:2':{selected:1},'questions:3':{selected:2}};
    b.results=b.pool.map(q=>{const a=b.answers['questions:'+q.id];const sel=a?a.selected:null;return{q,selected:sel,correct:sel===null?null:sel===q.correct_index}});
    document.body.insertAdjacentHTML('beforeend','<div class="sim-review-nav"></div><main id="bankReviewDetail"></main>');
  `);
  const data = w.eval('bankSummaryData()');
  assert.equal(data.groups[0].label, 'Cardiología › Valvulopatías', 'El tema más débil va primero');
  assert.equal(data.groups[1].ok, 1);
  assert.equal(Math.round(data.avgMs), 90000, 'Media sobre preguntas respondidas con tiempo');
  w.eval('renderBankSummary()');
  const html = w.document.getElementById('bankReviewDetail').innerHTML;
  assert.match(html, /Repetir las falladas \(2\)/);
  assert.match(html, /Repetir falladas y en blanco \(3\)/);
  assert.match(html, /Por tema/);

  w.eval(`repeatBankFrom('wrong')`);
  assert.equal(w.eval('state.bank.pool.length'), 2, 'Repetir falladas solo incluye las falladas');
  assert.equal(w.eval('state.bank.mode'), 'immediate');
  assert.equal(w.eval('__showQ'), 1);
  w.eval(`state.bank={pool:[],results:[{q:${JSON.stringify(q(9, 'x'))},selected:null,correct:null}]};repeatBankFrom('wrong')`);
  assert.match(w.eval('__toasts.at(-1)'), /No hay preguntas/);
}

// 2) Marcadas: acciones y preguntas que vienen de tarjetas RemNote
{
  const { w } = makeWindow();
  w.eval(`
    state.questions=[${JSON.stringify(q('a1', 'Arritmias'))},${JSON.stringify(q('r9', 'Valvulopatías', 0, 'remnote'))}];
    state.bookmarks=[{item_type:'question',item_id:'a1'},{item_type:'question',item_id:'r9'},{item_type:'question',item_id:'gone'},{item_type:'content',item_id:'c1'}];
    state.content=[{id:'c1'}];
    renderBookmarks();
  `);
  const html = w.document.getElementById('view-bookmarks').innerHTML;
  assert.equal((html.match(/openBookmarkedQuestion\(decodeURIComponent/g) || []).length, 4, 'Cada pregunta marcada tiene Resolver y fila pulsable');
  assert.equal((html.match(/>Quitar</g) || []).length, 2, 'Cada pregunta marcada se puede quitar');
  assert.match(html, /Practicar preguntas marcadas \(2\)/);
  assert.match(html, /list-item">c1/, 'La teoría y las tarjetas se siguen mostrando');
  w.eval(`openBookmarkedQuestion('a1')`);
  assert.equal(w.eval('state.bank.pool.length'), 1);
  assert.equal(w.eval('state.bank.mode'), 'immediate');
  w.eval(`openBookmarkedQuestion('gone')`);
  assert.match(w.eval('__toasts.at(-1)'), /ya no está disponible/);
  w.eval('practiceBookmarkedQuestions()');
  assert.equal(w.eval('state.bank.pool.length'), 2);
}

// 3) Modo "Al final": sin toast, con estado en la línea de guardado
{
  const { w } = makeWindow();
  w.eval(`
    var bankSavedAnswer=q=>state.bank.answers[bankQKey(q)];
    var goBankQuestion=i=>{state.bank.index=i;document.body.insertAdjacentHTML('beforeend','<p id="bankSelectionStatus"></p>')};
    state.bank={pool:[${JSON.stringify(q(1, 'A'))},${JSON.stringify(q(2, 'A'))}],index:0,mode:'end',selected:0,answers:{}};
  `);
  w.eval('answerQuestion()');
  assert.equal(w.eval('__toasts.length'), 0, 'No debe lanzar toast al guardar una respuesta en modo Al final');
  assert.match(w.document.getElementById('bankSelectionStatus').textContent, /Respuesta 1 guardada/);
}

// 4) Pista de teclado coherente en el origen
assert.match(app, /Teclado: 1–\$\{Math\.min\(9,options\.length\)\} o A–\$\{String\.fromCharCode\(64\+Math\.min\(9,options\.length\)\)\} · N siguiente · P anterior/, 'La pista de teclado debe mostrar números y letras desde el origen');
assert.doesNotMatch(app, /para elegir<\/span>/, 'No debe quedar la pista antigua');

// 5) Mis errores: filtros, superadas y rehacer
{
  const dom = new JSDOM('<!doctype html><body><section id="view-errors"></section></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const rows = [
    ['q1', 'Cardiología', true], ['q2', 'Cardiología', false], ['q3', 'Neurología', false], ['q4', 'Neurología', false],
  ];
  const past = new Date(Date.now() - 86400000).toISOString(), future = new Date(Date.now() + 5 * 86400000).toISOString();
  w.eval(`
    var $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
    var esc=s=>String(s??'');
    var toasts=[];var toast=m=>toasts.push(m);var shown=0;var showQuestion=()=>{shown++};
    var displaySpecialty=s=>s;
    var mk=(id,sp)=>({id,_source:'questions',specialty:sp,topic:'T',options:['a','b'],correct_index:0});
    var Q={q1:mk('q1','Cardiología'),q2:mk('q2','Cardiología'),q3:mk('q3','Neurología'),q4:mk('q4','Neurología')};
    var state={attempts:[
      {question_id:'q1',is_correct:false,answered_at:'2026-10-01T10:00:00Z'},{question_id:'q1',is_correct:true,answered_at:'2026-10-02T10:00:00Z'},{question_id:'q1',is_correct:true,answered_at:'2026-10-03T10:00:00Z'},
      {question_id:'q2',is_correct:false,answered_at:'2026-10-01T10:00:00Z'},{question_id:'q2',is_correct:true,answered_at:'2026-10-02T10:00:00Z'},
      {question_id:'q3',is_correct:false,answered_at:'2026-10-01T10:00:00Z'},{question_id:'q3',is_correct:false,answered_at:'2026-10-03T10:00:00Z'},
      {question_id:'q4',is_correct:true,answered_at:'2026-10-01T10:00:00Z'},{question_id:'q4',is_correct:false,answered_at:'2026-10-02T10:00:00Z'}]};
    var getAttemptQuestion=a=>Q[a.question_id];
    window.__nexmirAdaptiveTest={errorRows:()=>[
      {q:Q.q1,e:{source_type:'questions',source_id:'q1',next_review_at:'${past}'}},
      {q:Q.q2,e:{source_type:'questions',source_id:'q2',next_review_at:'${past}'}},
      {q:Q.q3,e:{source_type:'questions',source_id:'q3',next_review_at:'${future}'}},
      {q:Q.q4,e:{source_type:'questions',source_id:'q4',next_review_at:'${past}'}}]};
    var renderErrors=function(){document.getElementById('view-errors').innerHTML='<div class="section-head"><p></p></div><div class="list">'+
      ['q1','q2','q3','q4'].map(id=>'<div class="card error-entry"><div class="row"><div class="grow">'+id+'</div><span class="chip">x</span></div></div>').join('')+'</div>'};
  `);
  w.eval(read('study_clarity.js'));
  w.eval('renderErrors()');
  const visible = () => [...w.document.querySelectorAll('.error-entry')].filter(e => !e.hidden).map(e => e.textContent.replace(/Ya acertada|x/g, '').trim());
  assert.deepEqual(visible(), ['q2', 'q4'], 'Por defecto: pendientes de hoy; un solo acierto (q2) no la supera');
  assert.match(w.document.querySelector('.errors-summary').textContent, /2 para repasar hoy/);
  assert.match(w.document.querySelector('.errors-summary').textContent, /1 programadas/);
  assert.match(w.document.querySelector('.errors-summary').textContent, /1 superadas/);
  const click = sel => w.document.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  click('[data-ef="done"]');
  assert.deepEqual(visible(), ['q1'], 'Superadas: dos últimos intentos correctos');
  click('[data-ef="all"]');
  assert.deepEqual(visible(), ['q2', 'q3', 'q4'], 'Todos excluye las superadas');
  const sel = w.document.getElementById('errSpec');
  sel.value = 'Neurología'; sel.dispatchEvent(new w.Event('change'));
  assert.deepEqual(visible(), ['q3', 'q4'], 'Filtro por especialidad');
  const redo = w.document.getElementById('errRedoBtn');
  assert.match(redo.textContent, /Rehacer estos errores \(2\)/);
  redo.click();
  assert.equal(w.eval('shown'), 1);
  assert.equal(w.eval('state.bank.pool.length'), 2);
  assert.equal(w.eval('state.bank.mode'), 'immediate');
  assert.equal(w.eval('state.bank.context'), 'errors');
  // Cambio de pestaña vacía: botón deshabilitado
  click('[data-ef="done"]');
  assert.equal(w.document.getElementById('errRedoBtn').disabled, true, 'Sin preguntas en la lista no se puede rehacer');
}

// 6) Áreas táctiles
{
  const css = read('study_compact_5_1_64.css');
  assert.match(css, /@media \(pointer:coarse\)\{[\s\S]*inset:-4px/, 'Los controles compactos deben ampliar su zona táctil en pantallas táctiles');
  assert.match(css, /--nx-ctl-h:32px/);
  const html = read('index.dev.html');
  assert.match(html, /ux_followup_5_1_65\.css/);
  assert.match(html, /<title>NEXMIR V5\.1\.65<\/title>/);
}

console.log('✔ test-v5-1-65: errores, marcadas, resumen del banqueo, tiempos, modo Al final y áreas táctiles verificados.');
