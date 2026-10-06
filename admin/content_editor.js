/* Editorial search, typed flashcard editor and individual administrative deletion. */
(() => {
 const $e=s=>document.querySelector(s),canWrite=()=>!cloudMode||cloudRole==='admin';let page=0;
 const stringify=v=>Array.isArray(v)?v.join('\n'):String(v??'');
 function record(kind,uid){return(kind==='card'?state.db.cards:state.db.theory)[uid]}
 function actions(kind,uid){if(!canWrite())return '';return `<div class="actions editorial-actions"><button class="secondary" data-edit="${esc(uid)}" data-kind="${kind}">Editar</button><button class="secondary danger" data-delete="${esc(uid)}" data-kind="${kind}">Eliminar</button></div>`}
 function rows(){const term=RemnoteTaxonomy.searchable($e('#contentSearch').value),type=$e('#contentType').value,kind=state.contentKind==='cards'?'card':'theory';return Object.values(kind==='card'?state.db.cards:state.db.theory).filter(r=>r.status==='published').filter(r=>(kind==='theory'||type==='all'||r.current.type===type)&&(!term||RemnoteTaxonomy.searchable(r.current).includes(term))).map(r=>({r,kind}))}
 function bind(container){container.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();edit(btn.dataset.kind,btn.dataset.edit)});container.querySelectorAll('[data-delete]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();remove(btn.dataset.kind,btn.dataset.delete,btn)})}
 function render(){
   const list=rows(),size=60,pages=Math.max(1,Math.ceil(list.length/size));page=Math.max(0,Math.min(page,pages-1));
   $e('#editorialCount').textContent=`${list.length} coincidencias · página ${page+1} de ${pages}`;
   $e('#contentList').innerHTML=list.slice(page*size,(page+1)*size).map(({r,kind})=>`<div class="contentRow editorial-row"><span class="badge">${kind==='card'?(typeNames[r.current.type]||r.current.type):'Teoría'}${RemnoteTaxonomy.simulationContent(r.current)?' · Simulacros':''}</span><div><button class="ghost editorial-preview" data-view-record="${esc(r.uid)}" data-kind="${kind}">${esc(stripMd(kind==='card'?r.current.front:r.current.text)).slice(0,300)}</button><div class="meta">v${r.version} · ${esc(stringify(kind==='card'?r.current.back:'').slice(0,140))}</div></div><div class="path">${esc((r.current.path||r.current.context||[]).join(' › ')||r.current.source||'')}</div>${actions(kind,r.uid)}</div>`).join('')||'<div class="empty">No hay contenido que coincida con la búsqueda.</div>';
   if(list.length>size)$e('#contentList').insertAdjacentHTML('beforeend',`<div class="editorial-pager"><button id="editorialPrev" ${page?'':'disabled'}>Anterior</button><span>${page+1} / ${pages}</span><button id="editorialNext" ${page+1<pages?'':'disabled'}>Siguiente</button></div>`);
   $e('#editorialPrev')?.addEventListener('click',()=>{page--;render()});$e('#editorialNext')?.addEventListener('click',()=>{page++;render()});bind($e('#contentList'));
   $e('#contentList').querySelectorAll('[data-view-record]').forEach(btn=>btn.onclick=()=>showRecord(btn.dataset.kind,btn.dataset.viewRecord));
 }
 function field(id,label,value){return `<label class="fieldLabel">${label}<textarea id="${id}" class="qeTextarea">${esc(stringify(value))}</textarea></label>`}
 function edit(kind,uid){
   const rec=record(kind,uid);if(!rec||!canWrite())return alert('Solo el administrador puede editar este contenido.');recordDialogSequence++;
   const p=rec.current,mcq=p.type==='multiple_choice',items=Array.isArray(p.items),cloze=p.type==='cloze',dialog=$e('#detailDialog');
   $e('#dialogBody').innerHTML=`<div class="questionEditor"><h2>Editar ${kind==='card'?'flashcard':'teoría'}</h2><p class="muted">Se conservan el identificador, las imágenes y el historial de versiones.</p>${kind==='theory'?field('ceText','Texto (Markdown y tablas)',p.text):field('ceFront','Anverso / pregunta',p.front)}${kind==='card'?(mcq?`<div class="qeOptions">${(p.options||[]).map((o,i)=>field('ceOption'+i,'Alternativa '+String.fromCharCode(65+i),typeof o==='string'?o:o.text)).join('')}</div><label class="fieldLabel">Correcta<select id="ceCorrect">${(p.options||[]).map((o,i)=>`<option value="${i}" ${o.correct?'selected':''}>${String.fromCharCode(65+i)}</option>`).join('')}</select></label>${field('ceExplanation','Explicación',p.explanation)}`:items?field('ceItems','Respuestas (una por línea; se conservan las sangrías existentes)',p.items.map(x=>x.text)):cloze?'<p class="muted">Edita los huecos en el anverso usando {{respuesta}}.</p>':field('ceBack','Reverso / respuesta',p.back)):''}
   <div class="qeMetaGrid"><label class="fieldLabel">Asignatura<input id="ceSpecialty" list="classificationSubjects" value="${esc(p.specialty||'')}"></label><label class="fieldLabel">Tema<input id="ceTopic" value="${esc(p.topic||'General')}"></label><label class="fieldLabel">Subtema<input id="ceSubtopic" value="${esc(p.subtopic||'')}"></label><label class="fieldLabel">Apartado<input id="ceSection" value="${esc(p.section||'')}"></label><label class="fieldLabel">Destino<select id="ceUse"><option value="study">Estudio y flashcards</option><option value="simulation" ${RemnoteTaxonomy.simulationContent(p)?'selected':''}>Banco para simulacros</option></select></label></div><p id="ceMessage" class="muted" role="status"></p><div class="qeSticky"><button id="ceCancel" class="secondary">Cancelar</button><button id="ceSave" class="primary">Guardar cambios</button></div></div>`;
   $e('#ceCancel').onclick=()=>dialog.close();$e('#ceSave').onclick=async()=>{
     const save=$e('#ceSave');if(save.disabled)return;save.disabled=true;
     try{
       const next={...structuredClone(p),...RemnoteTaxonomy.manual($e('#ceSpecialty').value,{topic:$e('#ceTopic').value,subtopic:$e('#ceSubtopic').value,section:$e('#ceSection').value}),content_use:$e('#ceUse').value};
       if(kind==='theory'){next.text=$e('#ceText').value.trim();next.blocks=theoryBlocks(next.text);next.tables=next.blocks.filter(x=>x.type==='table');next.content_hash=hash(normalize(next.text));if(!next.text)throw new Error('El texto no puede quedar vacío.')}
       else{
         next.front=$e('#ceFront').value.trim();if(!next.front)throw new Error('El anverso no puede quedar vacío.');
         if(mcq){const correct=+$e('#ceCorrect').value;next.options=p.options.map((o,i)=>({...(typeof o==='object'?o:{}),text:$e('#ceOption'+i).value.trim(),correct:i===correct}));if(next.options.some(o=>!o.text))throw new Error('Todas las alternativas deben tener texto.');next.back=next.options[correct]?.text;next.explanation=$e('#ceExplanation').value.trim().split('\n').filter(Boolean);next.correct_inferred_by='explicit_marker'}
         else if(items){next.items=$e('#ceItems').value.split('\n').map((text,i)=>({...(p.items[i]||{depth:1}),text:text.trim()})).filter(x=>x.text);if(!next.items.length)throw new Error('Añade al menos una respuesta.');next.back=next.items.map(x=>x.text).join(' | ')}
         else if(cloze){next.clozes=[...next.front.matchAll(/{{([^}]+)}}/g)].map(x=>x[1]);if(!next.clozes.length)throw new Error('Añade al menos un hueco {{respuesta}}.')}
         else{next.back=$e('#ceBack').value.trim();if(!next.back)throw new Error('La respuesta no puede quedar vacía.')}next.content_hash=contentHash(next);
       }
       const now=new Date().toISOString();
       if(cloudMode){await NexmirContentAdmin.mutate(sb,{id:rec.id,action:'edit',payload:next,version:rec.version});await loadCloudDb()}
       else{rec.current=next;rec.version++;rec.updated_at=now;rec.last_reviewed_at=now;rec.versions.push({version:rec.version,action:'updated',published_at:now,value:structuredClone(next)});saveDb()}
       dialog.close();render();renderDashboard();
     }catch(error){$e('#ceMessage').textContent=error.message;save.disabled=false}
   };if(!dialog.open)dialog.showModal();
 }
 async function remove(kind,uid,btn){
   const rec=record(kind,uid);if(!rec||!canWrite())return alert('Solo el administrador puede eliminar contenido.');
   if(!confirm('¿Eliminar este contenido para todos los usuarios? También se eliminarán sus repasos e intentos asociados.'))return;
   if(btn)btn.disabled=true;
   try{if(cloudMode){await NexmirContentAdmin.mutate(sb,{id:rec.id,action:'delete',version:rec.version});await loadCloudDb()}else{delete(kind==='card'?state.db.cards:state.db.theory)[uid];saveDb()}recordDialogSequence++;$e('#detailDialog').close();render();renderDashboard()}catch(error){alert(error.message);if(btn)btn.disabled=false}
 }
 window.NexmirEditorial={render,recordActions:actions};
 window.NexmirEditorialBulk={all:rows,visible:()=>rows().slice(page*60,(page+1)*60),selector:'#contentList .contentRow',host:'#contentList',canWrite,remove:async row=>{const {r,kind}=row;if(cloudMode)await NexmirContentAdmin.mutate(sb,{id:r.id,action:'delete',version:r.version});else{delete(kind==='card'?state.db.cards:state.db.theory)[r.uid];saveDb()}},refresh:async()=>{if(cloudMode)await loadCloudDb();render();renderDashboard()},key:row=>row.kind+':'+row.r.uid};
 // Version-history rendering can replace the dialog body, so use delegation there.
 $e('#dialogBody').addEventListener('click',e=>{const btn=e.target.closest('[data-edit],[data-delete]');if(!btn)return;btn.dataset.edit?edit(btn.dataset.kind,btn.dataset.edit):remove(btn.dataset.kind,btn.dataset.delete,btn)});
 $e('#contentSearch').oninput=()=>{page=0;render()};$e('#contentType').onchange=()=>{page=0;render()};render();
})();
