/* NEXMIR V5.1.50 · búsqueda global. Solo lee lo que la app ya cargó (teoría, tarjetas,
   cuadros con nombre y preguntas); no escribe datos ni toca repasos, bancos ni permisos. */
(() => {
  'use strict';
  if(typeof state==='undefined'||typeof esc!=='function')return;
  const $=(s,r=document)=>r.querySelector(s);
  const TYPES=[['all','Todo'],['theory','Teoría'],['card','Tarjetas'],['cuadro','Cuadros'],['question','Preguntas']];
  const LABEL={theory:'Teoría',card:'Tarjeta',cuadro:'Cuadro',question:'Pregunta'};
  const PAGE=40;
  let index=null,built={content:null,questions:null,n:-1,q:-1},active=0,shown=PAGE,results=[],terms=[],typeFilter='all',spFilter='',timer=null,dialog=null;

  /* Normaliza sin cambiar la longitud del texto (así los resaltados coinciden con el original). */
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
  const clean=s=>String(s||'').replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/\^\^|\u200b/g,'').replace(/[*_`#>|]/g,' ').replace(/\s+/g,' ').trim();
  function plainOf(payload){const parts=[];walk(payload,parts);return clean(parts.join(' · '))}
  function entry(type,id,title,path,spec,text,extra){
    title=clean(title).slice(0,160);
    return {type,id,title,path,spec,text,nTitle:norm(title),nPath:norm(path),nText:norm(text),...extra};
  }
  function build(){
    const out=[];
    const content=typeof studyContent==='function'?studyContent():state.content;
    for(const x of content){
      const p=x.payload||{},spec=displaySpecialty(x.specialty),path=pathOf(x);
      if(x.kind==='theory'){
        out.push(entry('theory',x.id,p.context?.at(-1)||x.topic||'Teoría',path,spec,plainOf(p)));
        (p.blocks||[]).forEach((b,i)=>{
          if(b&&b.type==='table'&&String(b.title||'').trim()){
            const t=[...(b.headers||[]),...(b.rows||[]).flat()].join(' · ');
            out.push(entry('cuadro',x.id,b.title,path,spec,clean(t),{index:i}));
          }
        });
      }else if(x.kind==='card'){
        const text=plainOf(p);
        out.push(entry('card',x.id,p.front||p.question||text.slice(0,120),path,spec,text));
      }
    }
    for(const q of state.questions||[]){
      const opts=(q.options||[]).map(o=>typeof o==='string'?o:o?.text||'');
      const expl=Array.isArray(q.explanation)?q.explanation.join(' '):(q.explanation||'');
      const path=[displaySpecialty(q.specialty),q.topic,q.subtopic].filter(Boolean).map(clean).join(' › ');
      out.push(entry('question',q.id,q.stem||q.question||'Pregunta',path,displaySpecialty(q.specialty),clean([q.stem,...opts,expl].join(' · '))));
    }
    return out;
  }
  function ensureIndex(){
    if(!index||built.content!==state.content||built.questions!==state.questions||built.n!==state.content.length||built.q!==state.questions.length){
      index=build();built={content:state.content,questions:state.questions,n:state.content.length,q:state.questions.length};
    }
    return index;
  }

  /* ---------- búsqueda ---------- */
  function parse(q){return norm(q).split(/[^a-z0-9ñ]+/i).filter(t=>t.length>=2||/^\d$/.test(t))}
  function score(e,ts,phrase){
    let s=0;
    for(const t of ts){
      const inT=e.nTitle.indexOf(t),inP=e.nPath.indexOf(t),inX=e.nText.indexOf(t);
      if(inT<0&&inP<0&&inX<0)return -1;
      if(inT>=0)s+=(inT===0||e.nTitle[inT-1]===' ')?8:5;
      if(inP>=0)s+=3;
      if(inX>=0){s+=1;let c=0,i=inX;while(i>=0&&c<4){c++;i=e.nText.indexOf(t,i+t.length)}s+=c*.5}
    }
    if(ts.length>1){if(e.nTitle.includes(phrase))s+=8;else if(e.nText.includes(phrase))s+=3}
    return s;
  }
  function run(){
    const q=$('#gsInput').value;terms=parse(q);active=0;shown=PAGE;
    const status=$('#gsStatus'),list=$('#gsResults');
    if(!state.content?.length&&!state.questions?.length){list.innerHTML='';status.textContent='La biblioteca aún está cargando. Intenta en unos segundos.';return}
    if(!terms.length){results=[];list.innerHTML=hintHtml();status.textContent='';paintChips({});return}
    const idx=ensureIndex(),phrase=norm(q).trim().replace(/\s+/g,' '),counts={all:0,theory:0,card:0,cuadro:0,question:0};
    const bySp=new Set(),matches=[];
    for(const e of idx){
      const sc=score(e,terms,phrase);if(sc<0)continue;
      bySp.add(e.spec);
      if(spFilter&&e.spec!==spFilter)continue;
      counts.all++;counts[e.type]++;
      if(typeFilter==='all'||typeFilter===e.type)matches.push({e,sc});
    }
    matches.sort((a,b)=>b.sc-a.sc||(a.e.nTitle<b.e.nTitle?-1:a.e.nTitle>b.e.nTitle?1:0));
    results=matches.map(m=>m.e);
    paintChips(counts);paintSubjects(idx);
    status.textContent=results.length?`${results.length} resultado${results.length>1?'s':''}`:'Sin resultados. Prueba con menos palabras o quita los filtros.';
    paintList();
  }
  function hintHtml(){return `<div class="gs-hint"><p><strong>Busca en toda tu biblioteca.</strong></p><p class="muted">Escribe una o más palabras: teoría, tarjetas, cuadros con nombre y preguntas. Usa <kbd>↑</kbd> <kbd>↓</kbd> y <kbd>Enter</kbd> para abrir; <kbd>Esc</kbd> para cerrar.</p></div>`}

  /* Resalta coincidencias con el texto original (misma longitud que el normalizado). */
  function highlight(plain,nPlain,ts,max){
    let first=-1;for(const t of ts){const i=nPlain.indexOf(t);if(i>=0&&(first<0||i<first))first=i}
    const start=first>60?first-50:0,end=Math.min(plain.length,start+max);
    const ranges=[];
    for(const t of ts){let i=nPlain.indexOf(t,start);while(i>=0&&i<end){ranges.push([i,Math.min(end,i+t.length)]);i=nPlain.indexOf(t,i+t.length)}}
    ranges.sort((a,b)=>a[0]-b[0]);
    let html=start>0?'…':'',pos=start;
    for(const [a,b] of ranges){if(b<=pos)continue;const s=Math.max(a,pos);html+=esc(plain.slice(pos,s))+'<mark>'+esc(plain.slice(s,b))+'</mark>';pos=b}
    html+=esc(plain.slice(pos,end))+(end<plain.length?'…':'');
    return html;
  }
  function paintList(){
    const list=$('#gsResults'),slice=results.slice(0,shown);
    list.innerHTML=slice.map((e,i)=>`<button type="button" class="gs-item${i===active?' active':''}" role="option" data-i="${i}" aria-selected="${i===active}"><span class="gs-badge gs-${e.type}">${LABEL[e.type]}</span><span class="gs-main"><strong>${highlight(e.title,e.nTitle,terms,110)}</strong><span class="gs-path">${esc(e.path||'')}</span><span class="gs-snippet">${highlight(e.text,e.nText,terms,170)}</span></span></button>`).join('')+(results.length>shown?`<button type="button" class="btn gs-more" id="gsMore">Mostrar más (${results.length-shown})</button>`:'');
  }
  function paintChips(counts){
    $('#gsTypes').innerHTML=TYPES.map(([k,l])=>`<button type="button" class="chip gs-chip${typeFilter===k?' on':''}" data-type="${k}" aria-pressed="${typeFilter===k}">${l}${counts[k]!=null&&terms.length?` <span class="gs-count">${counts[k]}</span>`:''}</button>`).join('');
  }
  function paintSubjects(idx){
    const sel=$('#gsSubject');if(sel.options.length>1)return;
    [...new Set(idx.map(e=>e.spec).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(s=>sel.insertAdjacentHTML('beforeend',`<option>${esc(s)}</option>`));
  }

  /* ---------- abrir resultados ---------- */
  function openQuestion(id){
    const q=(state.questions||[]).find(x=>String(x.id)===String(id));if(!q)return;
    const opts=(q.options||[]).map(o=>typeof o==='string'?o:o?.text||'');
    const expl=Array.isArray(q.explanation)?q.explanation.join('\n'):(q.explanation||'');
    $('#studyDialogBody').innerHTML=`<div class="dialog-head"><div><span class="chip">Pregunta</span><div class="path">${esc([displaySpecialty(q.specialty),q.topic,q.subtopic].filter(Boolean).join(' › '))}</div></div><button class="icon-btn" aria-label="Cerrar" onclick="$('#studyDialog').close()">×</button></div><div class="theory-body"><p>${mdInline(q.stem||'')}</p><ol type="A" class="gs-options">${opts.map((o,i)=>`<li data-i="${i}">${mdInline(o)}</li>`).join('')}</ol><button type="button" class="btn" id="gsReveal">Mostrar respuesta y explicación</button><div id="gsAnswer" hidden><p><strong>Respuesta: ${String.fromCharCode(65+(q.correct_index||0))}</strong></p>${expl?`<p>${mdInline(expl)}</p>`:''}</div></div>`;
    $('#gsReveal').onclick=()=>{$('#gsAnswer').hidden=false;$('#gsReveal').hidden=true;$('#studyDialogBody').querySelectorAll('.gs-options li')[q.correct_index||0]?.classList.add('gs-correct')};
    const d=$('#studyDialog');if(!d.open)d.showModal();
  }
  function open(e){
    if(!e)return;
    dialog.close();
    if(e.type==='question')openQuestion(e.id);
    else if(e.type==='cuadro'&&typeof openCuadro==='function')openCuadro(e.id,e.index);
    else if(typeof openContent==='function')openContent(e.id);
  }

  /* ---------- diálogo ---------- */
  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='globalSearchDialog';dialog.className='dialog wide gs-dialog';dialog.setAttribute('aria-label','Buscar en la biblioteca');
    dialog.innerHTML=`<div class="gs-head"><input id="gsInput" type="search" autocomplete="off" spellcheck="false" placeholder="Buscar en teoría, tarjetas, cuadros y preguntas" aria-label="Buscar"><button type="button" class="icon-btn" id="gsClose" aria-label="Cerrar búsqueda">×</button></div><div class="gs-filters"><div id="gsTypes" class="gs-types"></div><select id="gsSubject" aria-label="Filtrar por asignatura"><option value="">Todas las asignaturas</option></select></div><p id="gsStatus" class="muted small" aria-live="polite"></p><div id="gsResults" class="gs-results" role="listbox" aria-label="Resultados"></div>`;
    document.body.appendChild(dialog);
    const input=$('#gsInput',dialog);
    input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(run,120)});
    input.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();if(!results.length)return;
        active=Math.max(0,Math.min(Math.min(shown,results.length)-1,active+(e.key==='ArrowDown'?1:-1)));
        $('#gsResults').querySelectorAll('.gs-item').forEach((b,i)=>{b.classList.toggle('active',i===active);b.setAttribute('aria-selected',i===active);if(i===active)b.scrollIntoView({block:'nearest'})});
      }else if(e.key==='Enter'){e.preventDefault();open(results[active])}
    });
    dialog.addEventListener('click',e=>{
      const item=e.target.closest('.gs-item');if(item){open(results[+item.dataset.i]);return}
      const chip=e.target.closest('.gs-chip');if(chip){typeFilter=chip.dataset.type;run();$('#gsInput',dialog).focus();return}
      if(e.target.id==='gsMore'){shown+=PAGE;paintList();return}
      if(e.target.id==='gsClose'||e.target===dialog)dialog.close();
    });
    $('#gsSubject',dialog).addEventListener('change',e=>{spFilter=e.target.value;run();$('#gsInput',dialog).focus()});
    return dialog;
  }
  function openSearch(prefill){
    if(!state.user)return;
    ensureDialog();
    if(!dialog.open)dialog.showModal();
    const input=$('#gsInput');
    if(typeof prefill==='string')input.value=prefill;
    input.focus();input.select();run();
  }
  function typingNow(t){const tag=t?.tagName?.toLowerCase();return tag==='input'||tag==='textarea'||tag==='select'||t?.isContentEditable}
  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented||!e.isTrusted||e.repeat)return;
    const slash=e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey,ctrlK=(e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='k';
    if(!slash&&!ctrlK)return;
    if(slash&&typingNow(e.target))return;
    if(!state.user)return;
    if(document.querySelector('dialog[open]:not(#globalSearchDialog)'))return;
    e.preventDefault();openSearch();
  });
  function mountButton(){
    if($('#globalSearchBtn'))return;
    const host=$('.top-actions');if(!host)return;
    const b=document.createElement('button');b.id='globalSearchBtn';b.type='button';b.className='btn mini gs-launch';
    b.title='Buscar en toda la biblioteca (atajo: /)';b.setAttribute('aria-label','Buscar en toda la biblioteca. Atajo: barra inclinada');
    b.innerHTML='🔍 <span>Buscar</span>';b.addEventListener('click',()=>openSearch());
    const warm=()=>{(window.requestIdleCallback||setTimeout)(()=>{try{if(state.content?.length||state.questions?.length)ensureIndex()}catch(e){}})};
    ['pointerenter','focus','touchstart'].forEach(ev=>b.addEventListener(ev,warm,{once:true,passive:true}));
    host.prepend(b);
  }
  mountButton();
  window.NexmirSearch={open:openSearch,norm,parse,_index:()=>ensureIndex()};
})();
