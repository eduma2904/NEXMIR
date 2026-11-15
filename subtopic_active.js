/* NEXMIR V5.1.66/67: estado visual del subtema elegido, filtros de Repaso, desplazamiento a la lista
   y contadores por subtema (tarjetas pendientes y teoría leída). */
(() => {
  'use strict';
  const hasState=()=>typeof state!=='undefined'&&state&&state.studyPath;
  const reduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* aria-pressed en el subtema elegido */
  function mark(){
    const sub=hasState()?(state.studyPath.sub||null):null;
    document.querySelectorAll('#studyDialogBody .subtopic-option').forEach(c=>c.setAttribute('aria-pressed',String(!!sub&&c.dataset.sub===sub)));
  }
  const prior=window.topicPickSub;
  if(typeof prior==='function'){
    window.topicPickSub=function(){const r=prior.apply(this,arguments);try{mark()}catch(e){}return r};
  }

  /* contadores por subtema: tarjetas pendientes (nuevas o vencidas) y bloques de teoría leídos */
  function decorateCounts(){
    if(!hasState()||!Array.isArray(state.studyPath.items))return;
    const rm=typeof reviewMap==='function'?reviewMap():{},now=Date.now();
    let read={};
    try{read=JSON.parse(localStorage.getItem('nexmir_study_order_v1:'+(state.user?.id||'anon'))||'{}').read||{}}catch(e){}
    const by=new Map();
    for(const x of state.studyPath.items){
      const k=x.subtopic||'General',s=by.get(k)||{n:0,t:0,r:0,c:0,p:0};
      s.n++;
      if(x.kind==='theory'){s.t++;if(read[x.id])s.r++}
      else if(x.kind==='card'){s.c++;const r=rm[x.id];if(!r||!r.next_review_at||Date.parse(r.next_review_at)<=now)s.p++}
      by.set(k,s);
    }
    document.querySelectorAll('#studyDialogBody .subtopic-option').forEach(card=>{
      const s=by.get(card.dataset.sub),p=card.querySelector('.path');
      if(!s||!p)return;
      const parts=[`<span>${s.n} ${s.n===1?'contenido':'contenidos'}</span>`];
      if(s.c)parts.push(`<span class="sub-stat${s.p?' has-pending':' is-done'}">${s.p} de ${s.c} ${s.c===1?'tarjeta pendiente':'tarjetas pendientes'}</span>`);
      if(s.t)parts.push(`<span class="sub-stat${s.r===s.t?' is-done':''}">${s.r} de ${s.t} ${s.t===1?'bloque de teoría leído':'bloques de teoría leídos'}</span>`);
      p.classList.add('sub-stats');
      p.innerHTML=parts.join('');
    });
  }

  const body=document.getElementById('studyDialogBody');
  if(body){
    /* el contenedor se reconstruye al abrir un tema; sin subtree, así que no se dispara con sus propios cambios */
    new MutationObserver(()=>{try{decorateCounts();mark()}catch(e){}}).observe(body,{childList:true});

    /* al elegir un subtema con el clic, llevar la vista a la lista si queda lejos o fuera de pantalla */
    body.addEventListener('click',e=>{
      if(!e.target.closest||!e.target.closest('.subtopic-option'))return;
      setTimeout(()=>{
        if(!hasState()||!state.studyPath.sub)return;
        const list=document.getElementById('topicItems'),dlg=document.getElementById('studyDialog');
        if(!list||!dlg)return;
        const r=list.getBoundingClientRect(),d=dlg.getBoundingClientRect();
        if(r.top>d.top+d.height*0.55||r.top<d.top)list.scrollIntoView({behavior:reduce()?'auto':'smooth',block:'start'});
      },60);
    });
  }

  /* filtros de Repaso con valor elegido */
  const SEL='#reviewSpecialty,#reviewTopic,#reviewSubtopic';
  const paint=()=>document.querySelectorAll(SEL).forEach(el=>el.classList.toggle('nx-filter-on',!!el.value));
  document.addEventListener('change',e=>{if(e.target.matches&&e.target.matches(SEL))setTimeout(paint,0)});
  const view=document.getElementById('view-reviews');
  if(view){let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(paint,0)}).observe(view,{childList:true,subtree:true})}
  paint();
})();
