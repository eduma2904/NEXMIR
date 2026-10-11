/* NEXMIR V5.1.34: claridad en Mis errores y en Estudiar.
   Se carga al final y envuelve las funciones existentes sin reemplazar su lógica de datos. */
(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const enc=encodeURIComponent;
 const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const PAGE=15;

 /* ───────── Mis errores: Hoy / Próximos / Todos, paginado y con práctica en bloque ───────── */
 let errFilter=null,errShown=PAGE;
 const errorRowsSafe=()=>{try{return window.__nexmirAdaptiveTest?.errorRows?.()||[]}catch{return[]}};
 const isDue=e=>Date.parse(e.next_review_at)<=Date.now();
 function decorateErrors(){
  const view=document.getElementById('view-errors');if(!view)return;
  const entries=$$('.error-entry',view),list=$('.list',view);if(!list)return;
  const rows=errorRowsSafe(),dueRows=rows.filter(r=>isDue(r.e));
  if(errFilter===null)errFilter=dueRows.length?'today':'all';
  entries.forEach(el=>{const chip=el.querySelector('.row > .chip');el.dataset.ef=/^Repasar hoy/.test(chip?.textContent||'')?'today':'later'});
  const p=$('.section-head p',view);if(p)p.textContent='Cada pregunta que fallas vuelve a ti en fechas espaciadas. Resuélvela de nuevo hasta que deje de fallar.';
  list.insertAdjacentHTML('beforebegin',`<div class="card errors-summary"><div class="row"><div><strong>${dueRows.length} para repasar hoy</strong><p class="muted small" style="margin:2px 0 0">${Math.max(0,rows.length-dueRows.length)} programadas para más adelante</p></div><button class="btn primary" ${dueRows.length?'':'disabled'} onclick="practiceDueErrors()">Practicar errores de hoy${dueRows.length?` (${Math.min(dueRows.length,20)})`:''}</button></div><div class="seg errors-seg" role="tablist"><button type="button" data-ef="today">Hoy</button><button type="button" data-ef="later">Próximos</button><button type="button" data-ef="all">Todos</button></div></div>`);
  const seg=$('.errors-seg',view);
  const apply=()=>{
   seg.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.ef===errFilter));
   const match=entries.filter(el=>errFilter==='all'||el.dataset.ef===errFilter);
   entries.forEach(el=>{el.hidden=true});
   match.slice(0,errShown).forEach(el=>{el.hidden=false});
   $('.errors-more',view)?.remove();
   if(match.length>errShown)list.insertAdjacentHTML('beforeend',`<button type="button" class="btn errors-more">Mostrar más (${match.length-errShown})</button>`);
   else if(!match.length&&entries.length)list.insertAdjacentHTML('beforeend',`<div class="empty errors-more">${errFilter==='today'?'No tienes errores para repasar hoy.':'Nada en esta lista.'}</div>`);
  };
  seg.addEventListener('click',e=>{const b=e.target.closest('button[data-ef]');if(!b)return;errFilter=b.dataset.ef;errShown=PAGE;apply()});
  list.addEventListener('click',e=>{if(e.target.closest('button.errors-more')){errShown+=PAGE;apply()}});
  apply();
 }
 const priorRenderErrors=renderErrors;
 renderErrors=function(){priorRenderErrors.apply(this,arguments);try{decorateErrors()}catch(e){console.warn('errores',e)}};
 window.practiceDueErrors=function(){
  const pool=errorRowsSafe().filter(r=>isDue(r.e)).map(r=>r.q).filter(q=>(q.options||[]).length>=2);
  if(!pool.length)return toast('No tienes errores para repasar hoy');
  const pick=shuffle(pool).slice(0,20);
  state.bank={pool:pick,index:0,answered:false,selected:null,mode:'immediate',results:[],context:'errors',highlights:{},answers:{},eliminations:{},submitted:false};
  showQuestion();
 };

 /* ───────── Estudiar: progreso real por tema (sin 0% engañoso) ───────── */
 function topicMeter(c,q){
  const cards=c&&c.total?`<div class="topic-meter-row"><span>Tarjetas estudiadas</span><strong>${c.studied} de ${c.total}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.round(c.studied/c.total*100)}%"></div></div>`:'';
  const quest=q&&q.n>=5?`<div class="topic-meter-row"><span>Aciertos en preguntas</span><strong>${Math.round(q.ok/q.n*100)}%</strong></div><small class="muted">${q.n} respuestas</small>`:`<div class="topic-meter-row muted"><span>Preguntas</span><strong>aún sin suficientes respuestas</strong></div>`;
  return `<div class="topic-meter">${cards}${quest}</div>`;
 }
 const priorOpenSpecialty=window.openSpecialty;
 window.openSpecialty=async function(encoded){
  const result=await priorOpenSpecialty.apply(this,arguments);
  try{
   const sp=decodeURIComponent(encoded),rm=reviewMap(),cardsBy=new Map(),qBy=new Map();
   for(const x of studyContent())if(x.kind==='card'&&displaySpecialty(x.specialty)===sp){const t=x.topic||'General',o=cardsBy.get(t)||{total:0,studied:0};o.total++;if(rm[x.id])o.studied++;cardsBy.set(t,o)}
   for(const a of state.attempts){if(a.is_valid===false)continue;const q=getAttemptQuestion(a);if(!q||displaySpecialty(q.specialty)!==sp)continue;const t=q.topic||'General',o=qBy.get(t)||{n:0,ok:0};o.n++;if(a.is_correct)o.ok++;qBy.set(t,o)}
   for(const card of $$('#studyDialogBody .specialty-card[onclick*="openTopic"]')){
    const m=card.getAttribute('onclick').match(/openTopic\('([^']*)','([^']*)'\)/);if(!m)continue;
    const t=decodeURIComponent(m[2]);
    card.querySelector('.progress-track')?.remove();$$('.path',card).filter(x=>/Dominio estimado/.test(x.textContent)).forEach(x=>x.remove());
    card.insertAdjacentHTML('beforeend',topicMeter(cardsBy.get(t),qBy.get(t)));
   }
  }catch(e){console.warn('dominio',e)}
  return result;
 };

 /* ───────── Estudiar: acciones dentro de un tema y subtemas pulsables ───────── */
 const path=()=>state.studyPath||{};
 function topicCards(sp,t,sub){
  const rm=reviewMap(),now=Date.now();
  const cards=studyContent().filter(x=>x.kind==='card'&&displaySpecialty(x.specialty)===sp&&(x.topic||'General')===t&&(!sub||(x.subtopic||'General')===sub));
  const pending=cards.filter(x=>{const r=rm[x.id];return !r||!r.next_review_at||Date.parse(r.next_review_at)<=now});
  pending.sort((a,b)=>(rm[a.id]?Date.parse(rm[a.id].next_review_at||0):Infinity)-(rm[b.id]?Date.parse(rm[b.id].next_review_at||0):Infinity));
  return{all:cards,pending};
 }
 const topicQuestions=(sp,t,sub)=>questionPool().filter(q=>displaySpecialty(q.specialty)===sp&&(q.topic||'General')===t&&(!sub||(q.subtopic||'General')===sub));
 function renderTopicActions(){
  const box=$('#topicActions');if(!box)return;
  const{sp,t,sub}=path(),c=topicCards(sp,t,sub),nq=topicQuestions(sp,t,sub).length;
  const cardBtn=c.all.length?`<button type="button" class="btn primary" ${c.pending.length?'':'disabled'} onclick="studyTopicCards()">${c.pending.length?`Estudiar tarjetas (${Math.min(c.pending.length,30)}${c.pending.length>30?' de '+c.pending.length:''})`:'Tarjetas al día'}</button>`:'';
  const qBtn=nq?`<button type="button" class="btn" onclick="banqueoTopic()">Banquear este tema (${Math.min(nq,20)}${nq>20?' de '+nq:''})</button>`:'';
  box.innerHTML=`${cardBtn}${qBtn}${sub?`<span class="chip">Subtema: ${esc(sub)} <button type="button" class="link-btn" onclick="topicPickSub()">quitar</button></span>`:''}${!cardBtn&&!qBtn?'<span class="muted small">Este tema solo tiene teoría por ahora.</span>':''}`;
 }
 function renderTopicList(){
  const st=path(),kind=st.kind||'all',box=$('#topicItems');if(!box)return;
  const items=(st.items||[]).filter(x=>(kind==='all'||x.kind===kind)&&(!st.sub||(x.subtopic||'General')===st.sub));
  box.innerHTML=items.map(contentRow).join('')||'<div class="empty">No hay contenido en esta selección.</div>';
 }
 window.topicTab=function(btn,kind){
  btn.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  state.studyPath.kind=kind;renderTopicList();
 };
 window.topicPickSub=function(name){
  const st=path();st.sub=(name&&st.sub!==name)?name:null;
  $$('#studyDialogBody .sub-clickable').forEach(c=>c.classList.toggle('sub-active',!!st.sub&&c.dataset.sub===st.sub));
  renderTopicList();renderTopicActions();
 };
 window.studyTopicCards=function(){
  const{sp,t,sub}=path(),{pending}=topicCards(sp,t,sub);
  if(!pending.length)return toast('No hay tarjetas pendientes en este tema');
  $('#studyDialog')?.close();
  window.startReviewPool(shuffle(pending.slice(0,30)));
 };
 window.banqueoTopic=function(){
  const{sp,t,sub}=path(),pool=shuffle(topicQuestions(sp,t,sub).filter(q=>(q.options||[]).length>=2)).slice(0,20);
  if(!pool.length)return toast('No hay preguntas para este tema todavía');
  $('#studyDialog')?.close();
  state.bank={pool,index:0,answered:false,selected:null,mode:'immediate',results:[],context:'bank',highlights:{},answers:{},eliminations:{},submitted:false};
  showQuestion();
 };
 const priorOpenTopic=window.openTopic;
 window.openTopic=async function(es,et){
  const result=await priorOpenTopic.apply(this,arguments);
  try{
   const body=$('#studyDialogBody'),seg=body?.querySelector('.seg');if(!seg||!state.studyPath)return;
   state.studyPath.sub=null;state.studyPath.kind='all';
   seg.insertAdjacentHTML('beforebegin','<div id="topicActions" class="topic-actions"></div>');
   renderTopicActions();
   const subHead=$$('.section-head',body).find(h=>/Subtemas/.test(h.textContent));
   if(subHead){
    const grid=subHead.nextElementSibling;
    subHead.insertAdjacentHTML('afterend','<p class="muted small" style="margin:-4px 0 10px">Toca un subtema para ver solo sus contenidos y estudiarlo.</p>');
    grid?.querySelectorAll(':scope > .card').forEach(card=>{
     const name=card.querySelector('strong')?.textContent||'General';
     card.classList.add('sub-clickable');card.dataset.sub=name;card.setAttribute('role','button');card.tabIndex=0;
     card.addEventListener('click',()=>window.topicPickSub(name));
     card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.topicPickSub(name)}});
    });
   }
  }catch(e){console.warn('tema',e)}
  return result;
 };
})();
