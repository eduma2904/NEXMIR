/* Free classification from the export hierarchy, reviewed before publication. */
(() => {
  const el=id=>document.getElementById(id);
  const pending=r=>RemnoteTaxonomy.unclassified(r.specialty);
  const locked=()=>remnoteQueue.running||remnoteQueue.publishing||state.import?.cloudPublish;
  const dialog=document.createElement('dialog');dialog.className='classificationDialog';dialog.id='freeClassificationDialog';document.body.append(dialog);
  function recover(row){
    const meta=row.remnote_metadata||{},context=row.context||meta.context||[];
    const sources=[row.source_path,meta.source_path,row.source,...(row.sources||[])].filter(Boolean);
    for(const source of sources.length?sources:['']){const p=RemnoteTaxonomy.classify(context,source);if(!pending(p))return{patch:p,method:'hierarchy'}}
    const archive=row.archive_name||meta.archive_name;
    const known=archive&&RemnoteTaxonomy.known(archive);if(known)return{patch:RemnoteTaxonomy.manual(known,{topic:row.topic,subtopic:row.subtopic,section:row.section}),method:'hierarchy'};
    const inferred=RemnoteTaxonomy.inferContent(row);if(!inferred)return null;
    const patch=RemnoteTaxonomy.manual(inferred.specialty,{topic:row.topic,subtopic:row.subtopic,section:row.section});
    patch.classification_origin='local_content_inference';
    return{patch,method:'content',confidence:inferred.confidence,matched:inferred.matched};
  }
  window.openFreeClassification=(rows,after=()=>{})=>{
    const missing=rows.filter(pending);if(!missing.length){alert('Las seleccionadas ya tienen especialidad.');return}
    const proposals=missing.map(row=>{const found=recover(row);return{row,patch:found?.patch||null,method:found?.method||null,confidence:found?.confidence||null}}),recovered=proposals.filter(p=>p.patch),unresolved=proposals.filter(p=>!p.patch),fromHierarchy=recovered.filter(p=>p.method==='hierarchy').length,fromContent=recovered.filter(p=>p.method==='content').length;
    dialog.innerHTML=`<div class="compareHead"><h2>Recuperar clasificación gratis</h2><button id="freeClassClose" class="secondary">Cerrar</button></div><p><strong>${recovered.length}</strong> clasificaciones recuperables: ${fromHierarchy} por carpetas o títulos y ${fromContent} por coincidencias claras del contenido. <strong>${unresolved.length}</strong> quedan pendientes.</p><p class="muted">Todo se procesa dentro del navegador y no usa servicios de pago. Revisa los grupos antes de aplicarlos.</p><div class="classificationProposals">${[...new Set(recovered.map(p=>p.patch.specialty))].map(sp=>`<p><strong>${esc(sp)}</strong> · ${recovered.filter(p=>p.patch.specialty===sp).length} contenidos</p>`).join('')||'<p>No se encontró una jerarquía ni una coincidencia de contenido suficientemente clara.</p>'}</div>${unresolved.length?`<label class="fieldLabel">Especialidad para los ${unresolved.length} pendientes<input id="freeClassFallback" list="classificationSubjects" value="${esc(el('importFallbackSpecialty')?.value||'')}" placeholder="Elige o escribe una especialidad"></label><div class="actions compact"><button id="freeClassUseMisc" class="secondary" type="button">Usar Miscelánea para los pendientes</button></div><p class="muted">Si el archivo mezcla materias y necesitas publicarlo ahora, usa Miscelánea; después podrás reagrupar esos contenidos desde el panel.</p>`:''}<p id="freeClassMsg" class="muted" aria-live="polite"></p><div class="actions"><button id="freeClassApply" class="primary">Aplicar y revisar</button></div>`;
    el('freeClassClose').onclick=()=>dialog.close();
    if(el('freeClassUseMisc'))el('freeClassUseMisc').onclick=()=>{el('freeClassFallback').value='Miscelánea';el('freeClassMsg').textContent='Los pendientes se asignarán a Miscelánea para permitir la publicación.'};
    el('freeClassApply').onclick=()=>{
      if(locked())return;const fallback=el('freeClassFallback')?.value.trim()||'';let patches;
      try{patches=proposals.map(p=>p.patch||(!fallback?null:RemnoteTaxonomy.manual(fallback,{topic:p.row.topic,subtopic:p.row.subtopic,section:p.row.section})));if(!patches.some(Boolean))throw Error('Elige una especialidad de respaldo o agrupa por separado.')}catch(e){el('freeClassMsg').textContent=e.message;return}
      proposals.forEach((p,i)=>{const patch=patches[i];if(!patch)return;Object.assign(p.row,patch);if(p.row.remnote_metadata)Object.assign(p.row.remnote_metadata,{classification_origin:patch.classification_origin,context:p.row.remnote_metadata.context||[]})});
      if(state.import)state.import.meta.unclassified=state.import.diffs.filter(d=>pending(d.newValue||{})).length;
      dialog.close();after();window.NexmirBankImportReview?.classify?.();window.NexmirSimImportReview?.render?.();
    };
    if(!dialog.open)dialog.showModal();
  };
  const chosen=()=>filteredDiffs().filter(d=>state.selected.has(diffKey(d)))||[];
  el('importSelectAll').onclick=()=>{if(locked())return;filteredDiffs().filter(d=>d.status!=='unchanged').forEach(d=>state.selected.add(diffKey(d)));renderCompare()};
  el('importClearSelected').onclick=()=>{if(locked())return;state.selected.clear();renderCompare()};
  el('importDeleteSelected').onclick=()=>{
    if(locked())return;const selected=chosen();if(!selected.length)return alert('Selecciona contenido primero.');
    if(!confirm(`¿Eliminar ${selected.length} contenidos de esta importación? Se excluyen de esta carga; el contenido ya publicado se conserva.`))return;
    const ids=new Set(selected.map(diffKey));ids.forEach(k=>remnoteQueue.excluded.add(k));state.import.diffs=state.import.diffs.filter(d=>!ids.has(diffKey(d)));state.selected.clear();state.import.meta.unclassified=state.import.diffs.filter(d=>pending(d.newValue||{})).length;renderCompare();
  };
  el('importRepairSelected').onclick=()=>{if(!locked())openFreeClassification(chosen().filter(d=>d.newValue&&d.status!=='missing').map(d=>d.newValue),renderCompare)};
  new MutationObserver(()=>{if(!state.import)return;const count=chosen().filter(d=>d.status!=='missing'&&pending(d.newValue||{})).length,warning=el('importClassifyWarning');warning.textContent=count?`${count} seleccionadas sin especialidad. Usa Recuperar clasificación gratis o Agrupar seleccionadas.`:'';warning.classList.toggle('hidden',!count);['importDeleteSelected','importClearSelected','importRepairSelected'].forEach(id=>el(id).disabled=locked()||!state.selected.size)}).observe(el('selectedCount'),{childList:true});
  function addControls(api,prefix,countId,checkId,existingDelete=false){
    if(!api)return;const parent=el(countId)?.closest('.bulkbar');if(!parent)return;
    parent.insertAdjacentHTML('beforeend',`<button id="${prefix}Clear" class="secondary" type="button">Quitar selección</button>${existingDelete?'':`<button id="${prefix}Delete" class="secondary danger" type="button">Eliminar seleccionadas</button>`}<button id="${prefix}Repair" class="secondary" type="button">Recuperar clasificación gratis</button>`);
    const sync=()=>{const n=api.selected().size;if(el(prefix+'Delete'))el(prefix+'Delete').disabled=!n||api.busy();el(prefix+'Clear').disabled=!n||api.busy();el(prefix+'Repair').disabled=!n||api.busy();if(el(checkId)){const visible=api.filtered().filter(q=>q.status_import!=='unchanged');el(checkId).checked=!!visible.length&&visible.every(q=>api.selected().has(q.source_uid));el(checkId).indeterminate=visible.some(q=>api.selected().has(q.source_uid))&&!el(checkId).checked;el(checkId).disabled=api.busy()||!visible.length}};
    el(prefix+'Clear').onclick=()=>{if(api.busy())return;api.selected().clear();api.render();sync()};
    if(!existingDelete)el(prefix+'Delete').onclick=()=>{if(api.busy())return;const ids=new Set(api.selected());if(!ids.size)return;if(confirm(`¿Eliminar ${ids.size} preguntas de esta importación? El contenido ya publicado se conserva.`)){api.remove(ids);api.selected().clear();api.render();sync()}};
    el(prefix+'Repair').onclick=()=>{if(!api.busy())openFreeClassification(api.rows().filter(q=>api.selected().has(q.source_uid)),()=>{api.classify?.();api.render();sync()})};
    new MutationObserver(sync).observe(el(countId),{childList:true});sync();
  }
  addControls(window.NexmirBankImportReview,'bankBulk','bankSelectedCount','bankSelectVisible');
  addControls(window.NexmirSimImportReview,'simBulk','simImportSelectedCount','simSelectVisible',true);
})();
