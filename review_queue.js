/* NEXMIR V5.1.34: Repasos con tarjetas "para repasar" separadas de las "nuevas".
   - Las nuevas se limitan por día (configurable) y las sesiones tienen tamaño.
   - Lo más atrasado va primero. Todo el resto de la app (badge, Inicio, mascota) usa dueCards(), que ahora es la cola real de hoy. */
(() => {
 'use strict';
 const uid=()=>(typeof state!=='undefined'&&state?.user?.id)||'anon';
 const day=()=>new Date().toLocaleDateString('en-CA');
 const PREF=()=>`nexmir_review_prefs_v1:${uid()}`,INTRO=()=>`nexmir_new_today_v1:${uid()}:${day()}`;
 const DEF={newLimit:20,session:25};
 const NEW_OPTIONS=[[10,'10'],[20,'20'],[30,'30'],[50,'50'],[9999,'Sin límite']];
 const SESSION_OPTIONS=[[15,'15 tarjetas'],[25,'25 tarjetas'],[40,'40 tarjetas'],[0,'Todas las de hoy']];
 const prefs=()=>{try{return{...DEF,...JSON.parse(localStorage.getItem(PREF())||'{}')}}catch{return{...DEF}}};
 const setPrefs=p=>{try{localStorage.setItem(PREF(),JSON.stringify({...prefs(),...p}))}catch{}};
 const introduced=()=>{try{return new Set(JSON.parse(localStorage.getItem(INTRO())||'[]'))}catch{return new Set()}};
 const markIntroduced=id=>{const s=introduced();s.add(id);try{localStorage.setItem(INTRO(),JSON.stringify([...s]))}catch{}};
 const allowance=()=>Math.max(0,prefs().newLimit-introduced().size);
 const when=r=>r?.next_review_at?Date.parse(r.next_review_at):0;

 /* Separa tarjetas ya vistas y vencidas ("due") de tarjetas nunca vistas ("fresh") */
 function split(){
  const rm=reviewMap(),now=Date.now(),due=[],fresh=[];
  for(const x of studyContent()){
   if(x.kind!=='card')continue;
   const r=rm[x.id];
   if(!r)fresh.push(x);else if(!r.next_review_at||Date.parse(r.next_review_at)<=now)due.push(x);
  }
  due.sort((a,b)=>when(rm[a.id])-when(rm[b.id]));
  return{due,fresh};
 }
 const matcher=()=>{
  const sp=document.getElementById('reviewSpecialty')?.value||'',topic=document.getElementById('reviewTopic')?.value||'',sub=document.getElementById('reviewSubtopic')?.value||'';
  return x=>(!sp||displaySpecialty(x.specialty)===sp)&&(!topic||(x.topic||'General')===topic)&&(!sub||(x.subtopic||'General')===sub);
 };

 function plan(){
  const{due,fresh}=split(),ok=matcher(),d=due.filter(ok),n=fresh.filter(ok),allow=allowance(),newUse=n.slice(0,allow),cap=prefs().session;
  let pool=[...d,...newUse];const total=pool.length;
  if(cap>0&&pool.length>cap)pool=pool.slice(0,cap);
  return{due:d.length,fresh:n.length,allow,newUse:newUse.length,total,pool,dueIds:new Set(d.map(x=>x.id))};
 }

 /* dueCards() ahora es la cola de HOY: vencidas + nuevas dentro del límite diario */
 dueCards=function(){const{due,fresh}=split();return[...due,...fresh.slice(0,allowance())]};
 reviewSpecialties=function(){const{due,fresh}=split();return[...new Set([...due,...fresh].map(x=>displaySpecialty(x.specialty)))].sort((a,b)=>a.localeCompare(b,'es'))};
 reviewFilteredDue=function(){return plan().pool};

 const options=(list,current)=>list.map(([v,l])=>`<option value="${v}" ${Number(current)===v?'selected':''}>${l}</option>`).join('');
 function renderReviewsView(){
  const view=document.getElementById('view-reviews');if(!view)return;
  const keep=[...view.querySelectorAll(':scope > [data-mascot]')];
  const{due,fresh}=split(),p=prefs(),allow=allowance(),intro=introduced().size,newToday=Math.min(fresh.length,allow),queue=due.length+newToday;
  const limitTxt=p.newLimit>=9999?'sin límite diario':`límite diario de ${p.newLimit}`;
  view.innerHTML=`<div class="hero-main review-hero"><span class="chip">Repaso espaciado</span><h1>${queue?`Hoy te tocan ${queue} tarjetas`:'Estás al día por hoy'}</h1>
   <p><strong>${due.length}</strong> para <strong>repasar</strong> (ya las viste y vuelven según tu valoración) y <strong>${newToday}</strong> <strong>nuevas</strong> (las verás por primera vez; ${limitTxt}${intro?`, hoy ya estudiaste ${intro}`:''}).</p>
   <div class="grid cols-3 review-filters"><label>Asignatura MIR<select id="reviewSpecialty" onchange="refreshReviewTopics()"><option value="">Todas las asignaturas</option>${reviewSpecialties().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label><label>Tema<select id="reviewTopic" onchange="refreshReviewSubtopics()"><option value="">Todos los temas</option></select></label><label>Subtema<select id="reviewSubtopic" onchange="updateReviewFilterCount()"><option value="">Todos los subtemas</option></select></label></div>
   <div class="grid cols-3 review-prefs"><label>Nuevas por día<select id="reviewNewLimit" onchange="reviewPrefChanged()">${options(NEW_OPTIONS,p.newLimit)}</select></label><label>Tamaño de sesión<select id="reviewSessionSize" onchange="reviewPrefChanged()">${options(SESSION_OPTIONS,p.session)}</select></label></div>
   <div class="row review-start"><span id="reviewFilteredCount" class="muted"></span><button id="startReviewBtn" class="btn primary" onclick="startReview()">Empezar repaso</button></div></div>
   <div class="grid cols-3" style="margin-top:16px"><div class="card"><div class="metric">${due.length}</div><div class="metric-label">Para repasar hoy</div></div><div class="card"><div class="metric">${newToday}</div><div class="metric-label">Nuevas disponibles hoy</div></div><div class="card"><div class="metric">${state.reviews.length}</div><div class="metric-label">Tarjetas ya estudiadas</div></div></div>
   <p class="muted small" style="margin-top:10px">Quedan ${fresh.length} tarjetas por ver por primera vez. Las nuevas se limitan por día para que el repaso no se acumule.</p>`;
  keep.slice().reverse().forEach(n=>view.prepend(n));
  refreshReviewTopics();
 }
 const priorRenderReviews=renderReviews;
 renderReviews=function(){priorRenderReviews.apply(this,arguments);renderReviewsView()};

 refreshReviewTopics=function(){
  const sp=document.getElementById('reviewSpecialty')?.value||'',old=document.getElementById('reviewTopic')?.value||'',{due,fresh}=split();
  let cards=[...due,...fresh];if(sp)cards=cards.filter(x=>displaySpecialty(x.specialty)===sp);
  const topics=[...new Set(cards.map(x=>x.topic||'General'))].sort((a,b)=>a.localeCompare(b,'es')),el=document.getElementById('reviewTopic');
  if(el){el.innerHTML='<option value="">Todos los temas</option>'+topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if(topics.includes(old))el.value=old}
  refreshReviewSubtopics();
 };
 refreshReviewSubtopics=function(){
  const sp=document.getElementById('reviewSpecialty')?.value||'',topic=document.getElementById('reviewTopic')?.value||'',old=document.getElementById('reviewSubtopic')?.value||'',{due,fresh}=split();
  let cards=[...due,...fresh];if(sp)cards=cards.filter(x=>displaySpecialty(x.specialty)===sp);if(topic)cards=cards.filter(x=>(x.topic||'General')===topic);
  const subs=[...new Set(cards.map(x=>x.subtopic||'General'))].sort((a,b)=>a.localeCompare(b,'es')),el=document.getElementById('reviewSubtopic');
  if(el){el.innerHTML='<option value="">Todos los subtemas</option>'+subs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if(subs.includes(old))el.value=old}
  updateReviewFilterCount();
 };
 updateReviewFilterCount=function(){
  const pl=plan(),el=document.getElementById('reviewFilteredCount'),btn=document.getElementById('startReviewBtn');
  if(el){
   if(pl.pool.length){
    const nDue=pl.pool.filter(x=>pl.dueIds.has(x.id)).length,nNew=pl.pool.length-nDue,rest=pl.total-pl.pool.length;
    el.textContent=`Sesión de ${pl.pool.length} tarjetas: ${nDue} para repasar + ${nNew} nuevas${rest>0?` · quedan ${rest} para otra ronda`:''}`;
   }else if(pl.fresh&&!pl.allow)el.textContent='Ya completaste tus tarjetas nuevas de hoy. Puedes subir el límite si quieres seguir.';
   else el.textContent='No hay tarjetas pendientes con esta selección.';
  }
  if(btn)btn.disabled=!pl.pool.length;
 };
 window.reviewPrefChanged=function(){
  setPrefs({newLimit:Number(document.getElementById('reviewNewLimit')?.value)||DEF.newLimit,session:Number(document.getElementById('reviewSessionSize')?.value)});
  updateDueBadge();renderReviewsView();
 };

 window.startReviewPool=function(pool){
  if(!pool?.length)return toast('No hay tarjetas para estudiar ahora');
  state.review={pool,index:0,revealed:false};showReviewCard();
 };
 startReview=function(){
  const{pool}=plan();
  if(!pool.length)return toast('No hay tarjetas pendientes para esa selección');
  window.startReviewPool(pool);
 };

 /* Registrar qué tarjetas nuevas empezaste hoy (para respetar el límite diario) */
 const priorRate=rateCard;
 rateCard=async function(q){
  const x=state.review?.pool?.[state.review.index],wasNew=!!x&&!state.reviews.some(r=>r.content_id===x.id);
  const result=await priorRate.apply(this,arguments);
  if(wasNew&&state.reviews.some(r=>r.content_id===x.id)){markIntroduced(x.id);updateDueBadge()}
  return result;
 };
 window.NexmirReviewQueue={split,plan,prefs,introduced,allowance};
 try{updateDueBadge()}catch{}
})();
