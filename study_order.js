/* NEXMIR V5.1.50 · estudiar en orden. Agrega Anterior/Siguiente, progreso y "leído" a la teoría,
   y un botón "Continuar donde quedé" por tema. El avance se guarda en este navegador
   (localStorage); no escribe en Supabase y no toca repasos, bancos ni permisos. */
(() => {
  'use strict';
  if(typeof state==='undefined'||typeof openContent!=='function'||typeof contentRow!=='function')return;
  const $=(s,r=document)=>r.querySelector(s);
  const keyOf=()=>'nexmir_study_order_v1:'+(state.user?.id||'anon');
  function load(){try{const v=JSON.parse(localStorage.getItem(keyOf())||'{}');return{read:v.read||{},last:v.last||{}}}catch(e){return{read:{},last:{}}}}
  function save(v){try{localStorage.setItem(keyOf(),JSON.stringify(v))}catch(e){/* sin espacio: se ignora */}}
  const topicKey=x=>displaySpecialty(x.specialty)+'§'+(x.topic||'General');
  const isRead=id=>!!load().read[id];

  /* Orden del tema: por archivo de origen y, dentro de él, en el orden en que se publicó. */
  function ordered(x){
    const k=topicKey(x);
    return studyContent().filter(y=>y.kind==='theory'&&topicKey(y)===k).sort((a,b)=>
      String(a.payload?.source||'').localeCompare(String(b.payload?.source||''),'es')||
      String(a.created_at||'').localeCompare(String(b.created_at||''))||
      String(a.id).localeCompare(String(b.id)));
  }
  function stats(list){const r=load().read;return list.filter(y=>r[y.id]).length}

  /* ---------- navegación dentro de la teoría ---------- */
  function decorate(id){
    const x=state.content.find(c=>c.id===id);if(!x||x.kind!=='theory')return;
    const list=ordered(x),i=list.findIndex(y=>y.id===id);if(i<0)return;
    const st=load();st.last[topicKey(x)]=id;save(st);
    const body=$('#studyDialogBody');if(!body||$('.order-nav',body))return;
    const read=!!st.read[id],last=i===list.length-1;
    const sp=displaySpecialty(x.specialty),t=x.topic||'General';
    const nav=document.createElement('div');nav.className='order-nav';
    nav.innerHTML=`<div class="order-mid" aria-live="polite"><strong>Bloque ${i+1} de ${list.length}</strong> · ${stats(list)} leído${stats(list)===1?'':'s'}<div class="order-track"><span style="width:${Math.round(stats(list)/list.length*100)}%"></span></div></div><button type="button" class="btn" data-order="prev" ${i?'':'disabled'}>← Anterior</button><button type="button" class="btn order-read${read?' is-read':''}" data-order="read" aria-pressed="${read}">${read?'✓ Leído':'Marcar leído'}</button>${last?'<button type="button" class="btn primary" data-order="end">Terminar tema</button>':'<button type="button" class="btn primary" data-order="next">Siguiente →</button>'}<button type="button" class="link-btn" data-order="topic">Ver el tema</button>`;
    const actions=$('.dialog-actions',body);(actions||body).insertAdjacentElement(actions?'beforebegin':'beforeend',nav);
    nav.addEventListener('click',e=>{
      const b=e.target.closest('[data-order]');if(!b)return;
      const a=b.dataset.order;
      if(a==='prev'&&i>0)go(list[i-1].id);
      else if(a==='next'&&i<list.length-1)go(list[i+1].id);
      else if(a==='read'){const s=load();if(s.read[id])delete s.read[id];else s.read[id]=Date.now();save(s);body.querySelector('.order-nav')?.remove();decorate(id)}
      else if(a==='end'||a==='topic')openTopic(encodeActionArg(sp),encodeActionArg(t));
    });
  }
  function go(id){openContent(id);const d=$('#studyDialog');if(d){d.scrollTop=0;const b=$('#studyDialogBody');if(b)b.scrollTop=0}}
  const baseOpen=openContent;
  openContent=function(id){
    const r=baseOpen.apply(this,arguments);
    try{decorate(id)}catch(e){console.warn('Estudiar en orden',e)}
    return r;
  };
  window.openContent=openContent;
  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
    const d=$('#studyDialog');if(!d?.open||!$('.order-nav',d))return;
    const tag=e.target?.tagName?.toLowerCase();if(tag==='input'||tag==='textarea'||tag==='select'||e.target?.isContentEditable)return;
    if(e.key==='ArrowRight'){const b=$('[data-order="next"]',d);if(b){e.preventDefault();b.click()}}
    else if(e.key==='ArrowLeft'){const b=$('[data-order="prev"]:not(:disabled)',d);if(b){e.preventDefault();b.click()}}
  });

  /* ---------- marca de leído en la lista del tema ---------- */
  const baseRow=contentRow;
  contentRow=function(x){
    let html=baseRow.apply(this,arguments);
    if(x&&x.kind==='theory'&&isRead(x.id))html=html.replace('class="list-item','class="list-item is-read');
    return html;
  };
  window.contentRow=contentRow;

  /* ---------- barra "Continuar donde quedé" en la vista del tema ---------- */
  function topicBar(){
    const body=$('#studyDialogBody'),sp=state.studyPath;if(!body||!sp?.items||$('.order-bar',body))return;
    const probe=sp.items.find(x=>x.kind==='theory');if(!probe)return;
    const list=ordered(probe),st=load(),n=list.length,r=stats(list);
    const lastId=st.last[topicKey(probe)],li=list.findIndex(y=>y.id===lastId);
    const firstUnread=list.findIndex(y=>!st.read[y.id]);
    const resume=li>=0?li:(firstUnread>=0?firstUnread:-1);
    const bar=document.createElement('div');bar.className='order-bar';
    bar.innerHTML=`<div class="grow"><strong>▶ Estudiar este tema en orden</strong><span class="muted small">${n} bloque${n>1?'s':''} de teoría · ${r} leído${r===1?'':'s'}</span><div class="order-track"><span style="width:${Math.round(r/n*100)}%"></span></div></div><button type="button" class="btn" data-start="0">Desde el principio</button>${resume>=0&&(li>=0||resume>0)?`<button type="button" class="btn primary" data-start="${resume}">Continuar donde quedé (bloque ${resume+1})</button>`:''}`;
    const anchor=$('#topicActions',body)||$('.seg',body);
    if(!anchor)return;
    anchor.insertAdjacentElement('beforebegin',bar);
    bar.addEventListener('click',e=>{const b=e.target.closest('[data-start]');if(b&&list[+b.dataset.start])openContent(list[+b.dataset.start].id)});
  }
  const baseTopic=window.openTopic;
  if(typeof baseTopic==='function'){
    window.openTopic=async function(){
      const r=await baseTopic.apply(this,arguments);
      try{topicBar()}catch(e){console.warn('Barra de orden',e)}
      return r;
    };
    openTopic=window.openTopic;
  }
  window.NexmirStudyOrder={ordered,isRead};
})();
