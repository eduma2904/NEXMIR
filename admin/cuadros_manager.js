/* NEXMIR V5.1.50 · nombres de cuadros (tablas) en el panel Admin.
   El nombre vive en el bloque de tabla (payload.blocks[i].title). No cambia la base de datos:
   se guarda con la misma función segura de edición (nexmir_edit_content) que ya usa el editor. */
(() => {
  'use strict';
  const $c=s=>document.querySelector(s);
  const canWrite=()=>!cloudMode||cloudRole==='admin';
  const sig=h=>JSON.stringify((h||[]).map(x=>String(x).trim().toLowerCase()));
  const PAGE=12;
  let page=0,lastMsg='';

  /* ---------- utilidades ---------- */
  function blocksOf(v){return v?.blocks?.length?v.blocks:theoryBlocks(v?.text||'')}
  function tablesOf(v){return blocksOf(v).map((b,i)=>({b,i})).filter(t=>t.b.type==='table')}
  function suggest(v,b,n){
    const ctx=stripMd((v.context||[]).at(-1)||v.topic||'Cuadro').slice(0,60)||'Cuadro';
    const heads=(b.headers||[]).map(h=>stripMd(h)).filter(Boolean).slice(0,3).join(' / ');
    return (n>1&&heads?`${ctx}: ${heads}`:ctx).slice(0,90);
  }
  function tableHtml(b){
    return `<div class="tableWrap cuadroPreview"><table><thead><tr>${(b.headers||[]).map(h=>`<th>${inlineMd(h)}</th>`).join('')}</tr></thead><tbody>${(b.rows||[]).map(r=>`<tr>${(b.headers||[]).map((_,i)=>`<td>${inlineMd(r[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function records(){return Object.values(state.db.theory).filter(r=>r.status==='published'&&tablesOf(r.current).length)}
  function allTables(){const out=[];for(const rec of records()){const ts=tablesOf(rec.current);ts.forEach(t=>out.push({rec,idx:t.i,b:t.b,n:ts.length}))}return out}
  const named=t=>!!String(t.b.title||'').trim();

  /* ---------- conservar nombres al editar texto o reimportar ---------- */
  function carryTitles(oldBlocks,newBlocks){
    const pool=new Map();
    (oldBlocks||[]).filter(b=>b.type==='table'&&String(b.title||'').trim()).forEach(b=>{const k=sig(b.headers);if(!pool.has(k))pool.set(k,[]);pool.get(k).push(b.title)});
    (newBlocks||[]).filter(b=>b.type==='table'&&!('title' in b)).forEach(b=>{const q=pool.get(sig(b.headers));if(q?.length)b.title=q.shift()});
  }
  if(window.NexmirContentAdmin&&!NexmirContentAdmin.__cuadros){
    const mutate=NexmirContentAdmin.mutate.bind(NexmirContentAdmin);
    NexmirContentAdmin.mutate=async function(client,args){
      try{
        if(args?.action==='edit'&&args.payload?.blocks){
          const rec=Object.values(state.db.theory).find(r=>r.id===args.id);
          if(rec)carryTitles(blocksOf(rec.current),args.payload.blocks),args.payload.tables=args.payload.blocks.filter(b=>b.type==='table');
        }
      }catch(e){console.warn('Nombres de cuadros',e)}
      return mutate(client,args);
    };
    NexmirContentAdmin.__cuadros=true;
  }
  if(typeof compareImport==='function'){
    const baseCompare=compareImport;
    compareImport=function(...args){
      const result=baseCompare.apply(this,args);
      try{for(const d of state.import?.diffs||[]){if(d.kind==='theory'&&d.status==='modified'&&d.oldValue&&d.newValue){carryTitles(blocksOf(d.oldValue),blocksOf(d.newValue));d.newValue.tables=blocksOf(d.newValue).filter(b=>b.type==='table')}}}catch(e){console.warn('Nombres de cuadros',e)}
      return result;
    };
  }

  /* ---------- fila reutilizable (importación y revisión) ---------- */
  function rowHtml(id,t,path,extra=''){
    return `<div class="cuadroItem" data-cid="${esc(id)}"><div class="cuadroHead"><label class="fieldLabel">Nombre del cuadro<input class="cuadroName" data-cid="${esc(id)}" data-orig="${esc(t.b.title||'')}" maxlength="120" placeholder="${esc(suggest(t.rec?t.rec.current:t.v,t.b,t.n))}" value="${esc(t.b.title||'')}"></label><div class="cuadroBtns"><button type="button" class="secondary cuadroSuggest" data-cid="${esc(id)}">Usar sugerido</button>${extra}</div></div><div class="path">${esc(path||'—')} · ${t.b.rows?.length||0} filas × ${t.b.headers?.length||0} columnas</div>${tableHtml(t.b)}</div>`;
  }

  /* ---------- 1) Importación: panel dentro de la revisión de cada bloque ---------- */
  function importTables(d){return d?.newValue&&d.kind==='theory'&&d.status!=='missing'?tablesOf(d.newValue):[]}
  function applyTitle(v,idx,title){
    const blocks=blocksOf(v);if(!v.blocks?.length)v.blocks=blocks;
    const b=v.blocks[idx];if(b&&b.type==='table'){b.title=title}
    v.tables=v.blocks.filter(x=>x.type==='table');
  }
  /* V5.1.60 · nombre sugerido en lote (solo a los cuadros sin nombre; nunca pisa uno escrito a mano) */
  function pendingImport(){let n=0;for(const d of state.import?.diffs||[]){if(d.status==='missing')continue;importTables(d).forEach(t=>{if(!String(t.b.title||'').trim())n++})}return n}
  function nameAllImport(){
    let n=0;
    for(const d of state.import?.diffs||[]){
      if(d.status==='missing')continue;
      const ts=importTables(d);
      ts.forEach(t=>{
        if(String(t.b.title||'').trim())return;
        const name=suggest(d.newValue,t.b,ts.length);
        if(name){applyTitle(d.newValue,t.i,name);n++}
      });
    }
    return n;
  }
  function bindImportInputs(root,resolve,onChange){
    root.querySelectorAll('.cuadroName').forEach(inp=>inp.addEventListener('input',()=>{const hit=resolve(inp.dataset.cid);if(hit){applyTitle(hit.v,hit.idx,inp.value.trim());onChange&&onChange()}}));
    root.querySelectorAll('.cuadroSuggest').forEach(btn=>btn.addEventListener('click',()=>{const inp=root.querySelector(`.cuadroName[data-cid="${CSS.escape(btn.dataset.cid)}"]`);if(inp){inp.value=inp.placeholder;inp.dispatchEvent(new Event('input'))}}));
  }
  if(typeof showDiff==='function'){
    const baseShow=showDiff;
    showDiff=function(d){
      baseShow.apply(this,arguments);
      try{
        const tables=importTables(d);if(!tables.length||!canWrite())return;
        const detail=$c('#dialogBody .detail');if(!detail)return;
        const box=document.createElement('section');box.className='cuadrosPanelAdmin';
        box.innerHTML=`<h3>▦ Nombres de los cuadros (${tables.length})</h3><p class="muted">El nombre aparecerá en Estudiar y en Repaso. Es opcional y se publica junto con este bloque.</p>${tables.length>1?`<div class="cuadroToolbar"><button type="button" class="secondary" id="cuadrosBlockSuggestAll">Usar sugerido en todos los cuadros sin nombre de este bloque</button></div>`:''}${tables.map((t,k)=>rowHtml('d'+t.i,{b:t.b,v:d.newValue,n:tables.length},(d.newValue.context||[]).join(' › '))).join('')}`;
        detail.appendChild(box);
        bindImportInputs(box,cid=>({v:d.newValue,idx:+cid.slice(1)}),()=>{if(typeof renderDiffList==='function')renderDiffList()});
        box.querySelector('#cuadrosBlockSuggestAll')?.addEventListener('click',()=>{box.querySelectorAll('.cuadroName').forEach(i=>{if(!i.value.trim()&&i.placeholder){i.value=i.placeholder;i.dispatchEvent(new Event('input'))}})});
      }catch(e){console.warn('Panel de cuadros',e)}
    };
  }
  if(typeof renderDiffList==='function'){
    const baseList=renderDiffList;
    renderDiffList=function(){
      baseList.apply(this,arguments);
      try{
        const byKey=new Map((state.import?.diffs||[]).map(d=>[diffKey(d),d]));
        document.querySelectorAll('#diffList .diffRow').forEach(row=>{
          const d=byKey.get(row.dataset.key),ts=importTables(d);if(!ts.length)return;
          const missing=ts.filter(t=>!String(t.b.title||'').trim()).length;
          row.querySelector('.meta')?.insertAdjacentHTML('beforeend',` · <span class="cuadroTag ${missing?'pending':'done'}">▦ ${ts.length} cuadro${ts.length>1?'s':''}${missing?` · ${missing} sin nombre`:' · con nombre'}</span>`);
        });
        ensureBulkButton();
      }catch(e){console.warn('Etiquetas de cuadros',e)}
    };
  }
  function ensureBulkButton(){
    if(!$c('#compareStats'))return;
    if(!$c('#cuadrosBulkBtn')){
      const btn=document.createElement('button');btn.id='cuadrosBulkBtn';btn.type='button';btn.className='secondary';btn.textContent='▦ Nombrar cuadros de esta importación';
      btn.onclick=openImportBulk;$c('#compareStats').insertAdjacentElement('afterend',btn);
      const all=document.createElement('button');all.id='cuadrosAutoAllBtn';all.type='button';all.className='secondary';
      all.onclick=()=>{const n=nameAllImport();if(typeof renderDiffList==='function')renderDiffList();const m=$c('#cuadrosAutoAllMsg');if(m)m.textContent=n?`Nombre sugerido aplicado a ${n} cuadro${n>1?'s':''}. Se guardan al publicar.`:'No hay cuadros sin nombre.'};
      btn.insertAdjacentElement('afterend',all);
      const msg=document.createElement('span');msg.id='cuadrosAutoAllMsg';msg.className='muted';msg.setAttribute('aria-live','polite');all.insertAdjacentElement('afterend',msg);
    }
    const k=pendingImport(),all=$c('#cuadrosAutoAllBtn');
    if(all){all.textContent=`✨ Usar nombre sugerido en todos los sin nombre (${k})`;all.disabled=!k}
  }
  let bulkPage=0;
  function openImportBulk(){
    if(!state.import)return;
    const items=[];for(const d of state.import.diffs){if(d.status==='missing')continue;importTables(d).forEach(t=>items.push({d,t}))}
    const dialog=$c('#detailDialog');
    const draw=()=>{
      const pages=Math.max(1,Math.ceil(items.length/PAGE));bulkPage=Math.min(bulkPage,pages-1);
      const slice=items.slice(bulkPage*PAGE,(bulkPage+1)*PAGE),pending=items.filter(x=>!String(x.t.b.title||'').trim()).length;
      $c('#dialogBody').innerHTML=`<div class="detail cuadrosBulk"><h2>▦ Cuadros de esta importación</h2><p class="muted">${items.length} cuadros · ${pending} sin nombre. Los nombres se guardan al publicar.</p>${items.length?`<div class="cuadroToolbar"><button type="button" class="secondary" id="cbSuggestAll">Sugerir nombre a los sin nombre de esta página</button><button type="button" class="secondary" id="cbSuggestEvery" ${pending?'':'disabled'}>Sugerir nombre a TODOS los sin nombre (${pending})</button></div>`:''}<div id="cbList">${slice.map(({d,t},k)=>rowHtml('b'+(bulkPage*PAGE+k),{b:t.b,v:d.newValue,n:importTables(d).length},(d.newValue.context||[]).join(' › '))).join('')||'<div class="empty">Esta importación no trae cuadros.</div>'}</div><div class="cuadroPager"><button type="button" class="secondary" id="cbPrev" ${bulkPage?'':'disabled'}>Anterior</button><span>Página ${bulkPage+1} de ${pages}</span><button type="button" class="secondary" id="cbNext" ${bulkPage+1<pages?'':'disabled'}>Siguiente</button></div></div>`;
      bindImportInputs($c('#cbList'),cid=>{const it=items[+cid.slice(1)];return it?{v:it.d.newValue,idx:it.t.i}:null},()=>{renderDiffList()});
      $c('#cbSuggestAll')?.addEventListener('click',()=>{$c('#cbList').querySelectorAll('.cuadroName').forEach(i=>{if(!i.value.trim()){i.value=i.placeholder;i.dispatchEvent(new Event('input'))}});draw()});
      $c('#cbSuggestEvery')?.addEventListener('click',()=>{nameAllImport();renderDiffList();draw()});
      $c('#cbPrev').onclick=()=>{bulkPage--;draw()};$c('#cbNext').onclick=()=>{bulkPage++;draw()};
    };
    bulkPage=0;draw();if(!dialog.open)dialog.showModal();
  }

  /* ---------- 2) Herramienta de revisión de cuadros ya publicados ---------- */
  function filtered(){
    const st=$c('#cuadrosState')?.value||'all',sp=$c('#cuadrosSubject')?.value||'',q=RemnoteTaxonomy.searchable($c('#cuadrosSearch')?.value||'');
    return allTables().filter(t=>(st==='all'||(st==='unnamed')===!named(t))&&(!sp||displayGroupName(t.rec.current.specialty)===sp)&&(!q||RemnoteTaxonomy.searchable([t.b.title,(t.rec.current.context||[]).join(' '),t.rec.current.topic,t.rec.current.subtopic,(t.b.headers||[]).join(' ')].join(' ')).includes(q)));
  }
  function displayGroupName(s){return s||'Sin asignatura'}
  function renderTool(){
    const host=$c('#cuadrosList');if(!host)return;
    const all=allTables(),done=all.filter(named).length;
    $c('#cuadrosStats').innerHTML=all.length?`<strong>${all.length}</strong> cuadros · <strong>${done}</strong> con nombre · <strong>${all.length-done}</strong> sin nombre<div class="cuadrosBar"><span style="width:${Math.round(done/all.length*100)}%"></span></div>`:'Aún no hay cuadros en la teoría publicada.';
    const sel=$c('#cuadrosSubject');if(sel&&sel.options.length<=1){[...new Set(all.map(t=>displayGroupName(t.rec.current.specialty)))].sort((a,b)=>a.localeCompare(b,'es')).forEach(s=>sel.insertAdjacentHTML('beforeend',`<option>${esc(s)}</option>`))}
    const list=filtered(),pages=Math.max(1,Math.ceil(list.length/PAGE));page=Math.min(page,pages-1);
    const slice=list.slice(page*PAGE,(page+1)*PAGE);
    $c('#cuadrosCount').textContent=`${list.length} coincidencias · página ${page+1} de ${pages}`;
    const allBtn=$c('#cuadrosNameAll');
    if(allBtn&&!allBtn.dataset.busy){const k=list.filter(t=>!named(t)).length;allBtn.textContent=`✨ Nombrar y guardar todos los sin nombre (${k})`;allBtn.disabled=!k||!canWrite()}
    host.innerHTML=slice.map(t=>rowHtml(t.rec.uid+'§'+t.idx,{b:t.b,rec:t.rec,n:t.n},[t.rec.current.specialty,t.rec.current.topic,t.rec.current.subtopic].filter(Boolean).join(' › '),`<button type="button" class="cuadroSave" data-cid="${esc(t.rec.uid+'§'+t.idx)}" ${canWrite()?'':'disabled'}>Guardar</button><button type="button" class="secondary cuadroView" data-uid="${esc(t.rec.uid)}">Ver teoría</button>`)).join('')||'<div class="empty">No hay cuadros con este filtro.</div>';
    host.querySelectorAll('.cuadroSuggest').forEach(b=>b.onclick=()=>{const i=host.querySelector(`.cuadroName[data-cid="${CSS.escape(b.dataset.cid)}"]`);if(i)i.value=i.placeholder});
    host.querySelectorAll('.cuadroSave').forEach(b=>b.onclick=()=>saveOne(b));
    host.querySelectorAll('.cuadroView').forEach(b=>b.onclick=()=>showRecord('theory',b.dataset.uid));
    $c('#cuadrosPager').innerHTML=list.length>PAGE?`<button type="button" class="secondary" id="cuadrosPrev" ${page?'':'disabled'}>Anterior</button><span>${page+1} / ${pages}</span><button type="button" class="secondary" id="cuadrosNext" ${page+1<pages?'':'disabled'}>Siguiente</button>`:'';
    $c('#cuadrosPrev')?.addEventListener('click',()=>{page--;renderTool()});$c('#cuadrosNext')?.addEventListener('click',()=>{page++;renderTool()});
    if(lastMsg)$c('#cuadrosMessage').textContent=lastMsg;
  }
  async function saveOne(btn){
    const msg=$c('#cuadrosMessage'),[uid,idx]=btn.dataset.cid.split('§');
    const rec=state.db.theory[uid];if(!rec||!canWrite())return;
    const input=$c(`#cuadrosList .cuadroName[data-cid="${CSS.escape(btn.dataset.cid)}"]`),title=input.value.trim();
    btn.disabled=true;msg.textContent='Guardando…';
    try{
      const next=structuredClone(rec.current);next.blocks=blocksOf(next);
      applyTitle(next,+idx,title);
      if(cloudMode){const r=await NexmirContentAdmin.mutate(sb,{id:rec.id,action:'edit',payload:next,version:rec.version});rec.current=next;rec.version=r?.version??rec.version+1}
      else{const now=new Date().toISOString();rec.current=next;rec.version++;rec.updated_at=now;rec.last_reviewed_at=now;(rec.versions||(rec.versions=[])).push({version:rec.version,action:'updated',published_at:now,value:structuredClone(next)});saveDb()}
      lastMsg=title?`Guardado: «${title}»`:'Nombre quitado';input.dataset.orig=title;
      renderTool();
    }catch(e){lastMsg='';msg.textContent=/asignatura|sin clasificar/i.test(e.message)?'Primero agrupa este bloque en una asignatura y vuelve a guardar. '+e.message:e.message;btn.disabled=false}
  }
  /* V5.1.60 · un clic: pone el nombre sugerido y guarda todos los cuadros publicados sin nombre (respeta los filtros activos) */
  async function nameAllSaved(btn){
    const msg=$c('#cuadrosMessage');
    if(!canWrite())return;
    const targets=filtered().filter(t=>!named(t));
    if(!targets.length){msg.textContent='No hay cuadros sin nombre con este filtro.';return}
    if(!confirm(`Se pondrá el nombre sugerido a ${targets.length} cuadro${targets.length>1?'s':''} sin nombre y se guardará de inmediato.\nLos que ya tienen nombre no se tocan.\n\n¿Continuar?`))return;
    const groups=new Map();
    targets.forEach(t=>{if(!groups.has(t.rec.uid))groups.set(t.rec.uid,{rec:t.rec,items:[]});groups.get(t.rec.uid).items.push(t)});
    btn.dataset.busy='1';btn.disabled=true;
    let ok=0,fail=0,done=0,firstErr='';
    for(const {rec,items} of groups.values()){
      msg.textContent=`Guardando… ${done} de ${groups.size} bloques`;
      try{
        const next=structuredClone(rec.current);next.blocks=blocksOf(next);
        items.forEach(t=>applyTitle(next,t.idx,suggest(rec.current,t.b,t.n)));
        if(cloudMode){const r=await NexmirContentAdmin.mutate(sb,{id:rec.id,action:'edit',payload:next,version:rec.version});rec.current=next;rec.version=r?.version??rec.version+1}
        else{const now=new Date().toISOString();rec.current=next;rec.version++;rec.updated_at=now;rec.last_reviewed_at=now;(rec.versions||(rec.versions=[])).push({version:rec.version,action:'updated',published_at:now,value:structuredClone(next)});saveDb()}
        ok+=items.length;
      }catch(e){fail+=items.length;if(!firstErr)firstErr=e.message||String(e)}
      done++;
    }
    delete btn.dataset.busy;
    lastMsg=`Listo: ${ok} cuadro${ok===1?'':'s'} nombrado${ok===1?'':'s'}.`+(fail?` ${fail} no se pudieron guardar (${firstErr}). Puedes volver a pulsar el botón para reintentar.`:'');
    renderTool();
  }
  document.addEventListener('click',e=>{const b=e.target.closest?.('#cuadrosNameAll');if(b&&!b.dataset.busy)nameAllSaved(b)});
  if(typeof go==='function'){
    const baseGo=go;
    go=function(view){baseGo(view);if(view==='cuadros'){page=0;lastMsg='';renderTool()}};
  }
  document.addEventListener('input',e=>{if(e.target.matches('#cuadrosSearch'))(page=0,renderTool())});
  document.addEventListener('change',e=>{if(e.target.matches('#cuadrosState,#cuadrosSubject'))(page=0,renderTool())});
  document.addEventListener('click',e=>{const b=e.target.closest?.('#cuadrosSuggestPage');if(!b)return;document.querySelectorAll('#cuadrosList .cuadroName').forEach(i=>{if(!i.value.trim())i.value=i.placeholder});$c('#cuadrosMessage').textContent='Sugerencias puestas en esta página. Revisa y pulsa Guardar en cada cuadro.'});
  window.NexmirCuadros={tablesOf,carryTitles,suggest,allTables,renderTool};
})();
