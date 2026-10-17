/* NEXMIR V5.1.58 · buscador de Estudiar.
   Se monta en tres niveles (lista de asignaturas, dentro de una asignatura y dentro de un tema o subtema).
   Muestra primero los temas coincidentes ("Mejores coincidencias"), luego los cuadros con ese nombre y
   debajo las tarjetas y la teoría que contienen la palabra. Solo lee lo que la app ya cargó:
   no escribe datos ni toca repasos, bancos, permisos ni el panel Admin. */
(() => {
  'use strict';
  if(typeof state==='undefined'||typeof studyContent!=='function'||typeof esc!=='function'||typeof renderStudy!=='function')return;
  const $=(s,r=document)=>r.querySelector(s);
  const BEST_MAX=8,CUADRO_PAGE=6,DOC_PAGE=24;
  const LABEL={specialty:'Asignatura',topic:'Tema',subtopic:'Subtema',cuadro:'Cuadro',card:'Tarjeta',theory:'Teoría'};
  const ICON={topic:'▤',subtopic:'☰',cuadro:'▦',card:'F',theory:'T'};

  /* ---------- texto ---------- */
  /* Minúsculas y sin tildes, conservando la longitud (así los resaltados coinciden con el original). */
  function norm(s){
    s=String(s??'');
    let low=s.toLowerCase();
    if(low.length!==s.length)low=Array.from(s,c=>{const l=c.toLowerCase();return l.length===c.length?l:c}).join('');
    return /[^\x00-\x7f]/.test(low)?low.replace(/[^\x00-\x7f]/g,c=>{const b=c.normalize('NFD')[0]||c;return b.length===c.length?b.toLowerCase():c}):low;
  }
  const SKIP=/(^|_)(uid|hash|id|source|path|url|image|images|version|status|type|marker|kind|content_use)$/i;
  function walk(v,out,depth=0){
    if(v==null||depth>6)return;
    if(typeof v==='string'){out.push(v);return}
    if(Array.isArray(v)){v.forEach(x=>walk(x,out,depth+1));return}
    if(typeof v==='object')for(const [k,val] of Object.entries(v)){if(!SKIP.test(k))walk(val,out,depth+1)}
  }
  const clean=s=>String(s??'').replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/\^\^|\u200b/g,'').replace(/[*_`#>|]/g,' ').replace(/\s+/g,' ').trim();
  function plainOf(payload){const parts=[];walk(payload,parts);return clean(parts.join(' · '))}

  /* "anemias" también encuentra "anemia" (y al revés, por coincidencia parcial). */
  function variants(t){
    const v=new Set([t]);
    if(t.length>3&&t.endsWith('es'))v.add(t.slice(0,-2));
    if(t.length>3&&t.endsWith('s'))v.add(t.slice(0,-1));
    return [...v];
  }
  const parse=q=>norm(q).split(/[^a-z0-9]+/).filter(t=>t.length>=2||/^\d$/.test(t)).map(variants);
  function firstIdx(hay,vars){let best=-1;for(const v of vars){const i=hay.indexOf(v);if(i>=0&&(best<0||i<best))best=i}return best}

  /* ---------- índice (se reconstruye solo si cambió el contenido) ---------- */
  let index=null,built={content:null,n:-1};
  const rec=(type,title,path,text,extra)=>{title=clean(title).slice(0,200);return{type,title,path,text,nTitle:norm(title),nPath:norm(path),nText:norm(text),...extra}};
  function build(){
    const docs=[],cuadros=[],ents=[],specs=new Map(),topics=new Map(),subs=new Map();
    const bump=(map,key,mk,x)=>{let o=map.get(key);if(!o){o=mk();map.set(key,o)}o[x.kind==='card'?'cards':'theory']++;return o};
    for(const x of studyContent()){
      const p=x.payload||{},sp=displaySpecialty(x.specialty),t=x.topic||'General',sub=x.subtopic||'General',path=pathOf(x);
      bump(specs,sp,()=>({sp,cards:0,theory:0}),x);
      bump(topics,sp+'\u0001'+t,()=>({sp,t,cards:0,theory:0}),x);
      bump(subs,sp+'\u0001'+t+'\u0001'+sub,()=>({sp,t,sub,cards:0,theory:0}),x);
      const base={id:x.id,sp,t,sub};
      if(x.kind==='card'){
        const text=plainOf(p);
        docs.push(rec('card',p.front||p.question||text.slice(0,120),path,text,base));
      }else if(x.kind==='theory'){
        if(typeof namedCuadros==='function')for(const c of namedCuadros(x)){
          const b=c.block,txt=clean([...(b.headers||[]),...(b.rows||[]).flat()].join(' · '));
          cuadros.push(rec('cuadro',c.title,path,txt,{...base,index:c.index}));
        }
        if(!(typeof onlyNamedCuadros==='function'&&onlyNamedCuadros(x)))
          docs.push(rec('theory',p.context?.at(-1)||x.topic||'Teoría',path,plainOf(p),base));
      }
    }
    const count=o=>({cards:o.cards,theory:o.theory});
    for(const o of specs.values())ents.push(rec('specialty',o.sp,'','',{sp:o.sp,...count(o)}));
    for(const o of topics.values())ents.push(rec('topic',o.t,o.sp,'',{sp:o.sp,t:o.t,...count(o)}));
    for(const o of subs.values())if(o.sub!=='General')ents.push(rec('subtopic',o.sub,o.sp+' › '+o.t,'',{sp:o.sp,t:o.t,sub:o.sub,...count(o)}));
    return{docs,cuadros,ents};
  }
  function ensureIndex(){
    if(!index||built.content!==state.content||built.n!==state.content.length){index=build();built={content:state.content,n:state.content.length}}
    return index;
  }

  /* ---------- puntuación ---------- */
  function score(e,tv,phrase,needTitle){
    let s=0,core=false;
    for(const vars of tv){
      const inT=firstIdx(e.nTitle,vars),inP=firstIdx(e.nPath,vars),inX=e.nText?firstIdx(e.nText,vars):-1;
      if(inT<0&&inP<0&&inX<0)return -1;
      if(inT>=0){core=true;s+=(inT===0||e.nTitle[inT-1]===' ')?8:5}
      if(inP>=0)s+=2;
      if(inX>=0){core=true;s+=1}
    }
    if(!core||(needTitle&&!tv.some(vars=>firstIdx(e.nTitle,vars)>=0)))return -1;
    if(e.nTitle===phrase||(tv.length===1&&tv[0].some(v=>v===e.nTitle)))s+=12;
    else if(tv.length>1&&e.nTitle.includes(phrase))s+=8;
    return s;
  }
  const byScore=(a,b)=>b.s-a.s||a.e.nTitle.length-b.e.nTitle.length||(a.e.nTitle<b.e.nTitle?-1:a.e.nTitle>b.e.nTitle?1:0);
  function inScope(e,sc,ent){
    if(sc.level==='all')return true;
    if(ent){
      if(sc.level==='spec')return e.type!=='specialty'&&e.sp===sc.sp;
      if(sc.level==='topic')return e.type==='subtopic'&&e.sp===sc.sp&&e.t===sc.t;
      return false;
    }
    if(e.sp!==sc.sp)return false;
    if(sc.level==='spec')return true;
    if(e.t!==sc.t)return false;
    return sc.level==='topic'||e.sub===sc.sub;
  }
  function search(q,sc){
    const tv=parse(q);if(!tv.length)return null;
    const phrase=norm(q).trim().replace(/\s+/g,' '),idx=ensureIndex(),pick=(list,ent,needTitle)=>{
      const out=[];for(const e of list){if(!inScope(e,sc,ent))continue;const s=score(e,tv,phrase,needTitle);if(s>=0)out.push({e,s})}
      return out.sort(byScore).map(m=>m.e);
    };
    return{tv,best:pick(idx.ents,true,true),cuadros:pick(idx.cuadros,false,false),docs:pick(idx.docs,false,false)};
  }

  /* ---------- resaltado ---------- */
  function highlight(plain,nPlain,tv,max){
    const flat=[...new Set(tv.flat())].sort((a,b)=>b.length-a.length);
    let first=-1;for(const v of flat){const i=nPlain.indexOf(v);if(i>=0&&(first<0||i<first))first=i}
    const start=first>60?first-50:0,end=Math.min(plain.length,start+max),ranges=[];
    for(const v of flat){let i=nPlain.indexOf(v,start);while(i>=0&&i<end){ranges.push([i,Math.min(end,i+v.length)]);i=nPlain.indexOf(v,i+v.length)}}
    ranges.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);
    let html=start>0?'…':'',pos=start;
    for(const [a,b] of ranges){if(b<=pos)continue;const s=Math.max(a,pos);html+=esc(plain.slice(pos,s))+'<mark>'+esc(plain.slice(s,b))+'</mark>';pos=b}
    return html+esc(plain.slice(pos,end))+(end<plain.length?'…':'');
  }
  const titleHit=(e,tv)=>tv.some(vars=>firstIdx(e.nTitle,vars)>=0);

  /* ---------- abrir resultados ---------- */
  /* Otras capas de la app abren la ventana sin devolver una promesa, así que se espera
     a que el tema esté realmente dibujado (y con su buscador nuevo) antes de elegir el subtema. */
  function waitFor(test,ms=4000){
    return new Promise(resolve=>{
      const t0=Date.now();
      (function tick(){let ok=false;try{ok=test()}catch(e){}if(ok||Date.now()-t0>ms)resolve(ok);else setTimeout(tick,40)})();
    });
  }
  async function openEntry(e){
    if(e.type==='specialty')return openSpecialty(encodeActionArg(e.sp));
    if(e.type==='topic')return openTopic(encodeActionArg(e.sp),encodeActionArg(e.t));
    if(e.type==='subtopic'){
      const body=$('#studyDialogBody'),prevPath=state.studyPath,prevBox=body?.querySelector('.ss');
      await openTopic(encodeActionArg(e.sp),encodeActionArg(e.t));
      await waitFor(()=>state.studyPath!==prevPath&&state.studyPath?.sp===e.sp&&state.studyPath?.t===e.t&&(()=>{const b=$('#studyDialogBody .ss');return !!b&&b!==prevBox})());
      if(state.studyPath?.sp===e.sp&&state.studyPath?.t===e.t&&state.studyPath.sub!==e.sub&&typeof topicPickSub==='function')topicPickSub(encodeActionArg(e.sub));
      return;
    }
    if(e.type==='cuadro')return openCuadro(e.id,e.index);
    return openContent(e.id);
  }

  /* ---------- componente ---------- */
  function scopeInfo(sc){
    if(sc.level==='spec')return{label:sc.sp,place:'dentro de '+sc.sp};
    if(sc.level==='topic')return{label:sc.t,place:'dentro de este tema'};
    if(sc.level==='sub')return{label:sc.sub,place:'dentro de este subtema'};
    return{label:'',place:''};
  }
  function mount(anchor,root,getScope,placeholder){
    const box=document.createElement('div');box.className='ss';box.setAttribute('role','search');
    box.innerHTML=`<div class="ss-bar"><svg class="ss-ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input class="ss-input" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"><button type="button" class="ss-clear" hidden>Borrar</button></div><div class="ss-scope" hidden></div><div class="ss-panel" role="listbox" aria-label="Resultados de la búsqueda" hidden></div>`;
    anchor.insertAdjacentElement('afterend',box);
    const input=$('.ss-input',box),clear=$('.ss-clear',box),scopeEl=$('.ss-scope',box),panel=$('.ss-panel',box);
    let wide=false,active=0,rows=[],res=null,shown={cuadro:CUADRO_PAGE,doc:DOC_PAGE},timer=null;

    const scope=()=>wide?{level:'all'}:getScope();
    function rowHtml(e,k){
      const tv=res.tv,isEnt=e.type==='specialty'||e.type==='topic'||e.type==='subtopic';
      const meta=isEnt?`${e.theory} teoría · ${e.cards} flashcards`:'';
      const path=isEnt?(e.path?esc(e.path):''):esc(e.path||'');
      const snippet=!isEnt&&e.nText&&!titleHit(e,tv)?`<span class="ss-snippet">${highlight(e.text,e.nText,tv,170)}</span>`:'';
      const icon=e.type==='specialty'?esc((e.title[0]||'?').toUpperCase()):ICON[e.type];
      return `<button type="button" class="ss-row ss-r-${e.type}${k===active?' active':''}" role="option" data-k="${k}" aria-selected="${k===active}"><span class="type-icon ss-icon-box ss-t-${e.type}" aria-hidden="true">${icon}</span><span class="ss-main"><strong class="ss-title">${highlight(e.title,e.nTitle,tv,120)}</strong>${path?`<span class="ss-path">${path}</span>`:''}${meta?`<span class="ss-path">${meta}</span>`:''}${snippet}</span><span class="ss-side"><span class="chip ss-chip">${LABEL[e.type]}</span><span class="ss-open" aria-hidden="true">Abrir <kbd>↵</kbd></span></span></button>`;
    }
    function paint(){
      rows=[];
      const sec=(title,list,more)=>{
        if(!list.length)return '';
        const start=rows.length;rows.push(...list);
        return `<div class="ss-sec"><div class="ss-sec-title">${title}</div>${list.map((e,i)=>rowHtml(e,start+i)).join('')}${more||''}</div>`;
      };
      const best=res.best.slice(0,BEST_MAX),cu=res.cuadros.slice(0,shown.cuadro),dc=res.docs.slice(0,shown.doc);
      const moreBtn=(kind,left)=>left>0?`<button type="button" class="btn mini ss-more" data-more="${kind}">Mostrar más (${left})</button>`:'';
      let html=sec('Mejores coincidencias',best)+sec('Cuadros',cu,moreBtn('cuadro',res.cuadros.length-cu.length))+sec('Tarjetas y teoría',dc,moreBtn('doc',res.docs.length-dc.length));
      if(!rows.length){
        const sc=getScope();
        html=`<div class="ss-empty"><strong>Sin resultados</strong><p class="muted small">Prueba con menos palabras o con otra forma de la palabra.</p>${!wide&&sc.level!=='all'?'<button type="button" class="btn mini" data-wide="1">Buscar en toda la biblioteca</button>':''}</div>`;
      }
      panel.innerHTML=html;
    }
    function paintScope(q){
      const sc=getScope();
      if(!q||sc.level==='all'){scopeEl.hidden=true;return}
      const info=scopeInfo(sc);
      scopeEl.hidden=false;
      scopeEl.innerHTML=`<button type="button" class="chip ss-scope-chip${wide?'':' on'}" data-wide="0" aria-pressed="${!wide}"><span>En ${esc(info.label)}</span></button><button type="button" class="chip ss-scope-chip${wide?' on':''}" data-wide="1" aria-pressed="${wide}">Toda la biblioteca</button>`;
    }
    function run(){
      const q=input.value;
      clear.hidden=!q;
      paintScope(q.trim());
      if(!state.content?.length&&q.trim()){res=null;panel.hidden=false;root.classList.add('ss-active');panel.innerHTML='<div class="ss-empty"><strong>La biblioteca aún está cargando</strong><p class="muted small">Intenta de nuevo en unos segundos.</p></div>';return}
      res=search(q,scope());active=0;shown={cuadro:CUADRO_PAGE,doc:DOC_PAGE};
      const on=!!res;
      root.classList.toggle('ss-active',on);panel.hidden=!on;
      if(on)paint();else{panel.innerHTML='';rows=[]}
    }
    function setActive(n,scroll){
      active=Math.max(0,Math.min(rows.length-1,n));
      panel.querySelectorAll('.ss-row').forEach(b=>{const on=+b.dataset.k===active;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);if(on&&scroll)b.scrollIntoView({block:'nearest'})});
    }
    input.addEventListener('input',()=>{clearTimeout(timer);clear.hidden=!input.value;timer=setTimeout(run,110)});
    input.addEventListener('focus',()=>{try{ensureIndex()}catch(e){}},{once:true});
    input.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){if(!rows.length)return;e.preventDefault();setActive(active+(e.key==='ArrowDown'?1:-1),true)}
      else if(e.key==='Enter'){if(rows[active]){e.preventDefault();openEntry(rows[active])}}
      else if(e.key==='Escape'&&input.value){e.preventDefault();e.stopPropagation();input.value='';run()}
    });
    clear.addEventListener('click',()=>{input.value='';run();input.focus()});
    scopeEl.addEventListener('click',e=>{const b=e.target.closest('[data-wide]');if(!b)return;wide=b.dataset.wide==='1';run();input.focus()});
    panel.addEventListener('click',e=>{
      const w=e.target.closest('[data-wide]');if(w){wide=true;run();input.focus();return}
      const more=e.target.closest('[data-more]');if(more){shown[more.dataset.more]+=more.dataset.more==='doc'?DOC_PAGE:CUADRO_PAGE;paint();return}
      const row=e.target.closest('.ss-row');if(row&&rows[+row.dataset.k])openEntry(rows[+row.dataset.k]);
    });
    panel.addEventListener('mousemove',e=>{const row=e.target.closest('.ss-row');if(row&&+row.dataset.k!==active)setActive(+row.dataset.k,false)});
    box._ssRefresh=()=>{if(input.value.trim())run()};
    return box;
  }

  /* ---------- nivel 1: lista de asignaturas ---------- */
  const priorRenderStudy=renderStudy;
  renderStudy=function(){
    const r=priorRenderStudy.apply(this,arguments);
    try{
      const view=$('#view-study'),head=view?.querySelector('.section-head');if(!view||!head)return r;
      $('#studySearch',head)?.remove();
      view.classList.remove('ss-active');
      mount(head,view,()=>({level:'all'}),'Buscar asignatura, tema, tarjeta o cuadro');
    }catch(e){console.warn('Buscador de Estudiar',e)}
    return r;
  };
  window.renderStudy=renderStudy;

  /* ---------- nivel 2: dentro de una asignatura ---------- */
  const priorOpenSpecialty=openSpecialty;
  openSpecialty=async function(encoded){
    const r=await priorOpenSpecialty.apply(this,arguments);
    try{
      const body=$('#studyDialogBody'),head=body?.querySelector('.specialty-topic-search');if(!body||!head)return r;
      const sp=decodeURIComponent(encoded);
      $('#studyTopicSearch',head)?.remove();
      body.classList.remove('ss-active');
      mount(head,body,()=>({level:'spec',sp}),'Buscar tema, tarjeta o cuadro en '+sp);
    }catch(e){console.warn('Buscador de Estudiar',e)}
    return r;
  };
  window.openSpecialty=openSpecialty;

  /* ---------- nivel 3: dentro de un tema o subtema ---------- */
  const priorOpenTopic=openTopic;
  openTopic=async function(){
    const r=await priorOpenTopic.apply(this,arguments);
    try{
      const body=$('#studyDialogBody'),head=body?.querySelector('.dialog-head');if(!body||!head||!state.studyPath?.t)return r;
      body.classList.remove('ss-active');
      mount(head,body,()=>{const p=state.studyPath||{};return p.sub?{level:'sub',sp:p.sp,t:p.t,sub:p.sub}:{level:'topic',sp:p.sp,t:p.t}},'Buscar subtema, tarjeta o cuadro en este tema');
    }catch(e){console.warn('Buscador de Estudiar',e)}
    return r;
  };
  window.openTopic=openTopic;

  /* Al elegir o quitar un subtema, el ámbito de la búsqueda se actualiza. */
  const priorPickSub=window.topicPickSub;
  if(typeof priorPickSub==='function'){
    topicPickSub=function(){
      const r=priorPickSub.apply(this,arguments);
      try{$('#studyDialogBody .ss')?._ssRefresh?.()}catch(e){}
      return r;
    };
    window.topicPickSub=topicPickSub;
  }
  window.NexmirStudySearch={norm,parse,search};
})();
