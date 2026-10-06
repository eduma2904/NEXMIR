/* Consistent bulk selection for all published content types. */
(() => {
  function mount(api,name){
    if(!api)return;const host=document.querySelector(api.host);if(!host)return;
    const selected=api.selected||new Set(),bar=document.createElement('div');bar.className='bulkbar';
    bar.innerHTML=`<span class="bulk-count" aria-live="polite"></span>${api.nativeChecks?'':'<button class="secondary bulk-all" type="button">Seleccionar todo el filtro</button><button class="secondary bulk-clear" type="button">Quitar selección</button>'}<button class="secondary danger bulk-delete" type="button">Eliminar seleccionadas</button><span class="bulk-status" role="status"></span>`;
    const table=host.closest('.tableWrap');(table||host).before(bar);let busy=false;
    const count=bar.querySelector('.bulk-count'),status=bar.querySelector('.bulk-status');
    function sync(){
      NexmirContentRules.retainSelection(selected,api.all(),api.key);
      const visible=api.visible();document.querySelectorAll(api.selector).forEach((node,i)=>{
        const row=visible[i];if(!row||api.nativeChecks)return;let box=node.querySelector('.bulk-record-check');
        if(!box){box=document.createElement('input');box.type='checkbox';box.className='bulk-record-check';box.setAttribute('aria-label','Seleccionar '+name);box.onclick=e=>e.stopPropagation();box.onchange=()=>{box.checked?selected.add(api.key(row)):selected.delete(api.key(row));sync()};if(node.tagName==='TR')node.firstElementChild.prepend(box);else node.prepend(box)}
        box.checked=selected.has(api.key(row));box.disabled=busy||api.busy?.();
      });
      const text=`${selected.size} seleccionadas`;if(count.textContent!==text)count.textContent=text;
      bar.querySelectorAll('button').forEach(b=>b.disabled=busy||api.busy?.()||!api.canWrite());
      bar.querySelector('.bulk-delete').disabled=busy||api.busy?.()||!api.canWrite()||!selected.size;
    }
    bar.querySelector('.bulk-all')?.addEventListener('click',()=>{api.all().forEach(r=>selected.add(api.key(r)));sync()});
    bar.querySelector('.bulk-clear')?.addEventListener('click',()=>{selected.clear();sync()});
    bar.querySelector('.bulk-delete').onclick=async()=>{
      if(busy||api.busy?.()||!api.canWrite())return;
      const targets=api.all().filter(r=>selected.has(api.key(r)));
      if(!targets.length){status.textContent='No hay seleccionadas dentro del filtro actual.';return}
      const typed=prompt(`Se eliminarán definitivamente ${targets.length} ${name} del filtro actual para todos los usuarios, junto con el progreso asociado. Las imágenes físicas se conservan. Para confirmar escribe ELIMINAR ${targets.length}.`);
      if(typed!==`ELIMINAR ${targets.length}`)return;
      busy=true;sync();let done=0;
      try{for(const row of targets){await api.remove(row);selected.delete(api.key(row));done++;status.textContent=`Eliminadas ${done} de ${targets.length}`}}
      catch(e){status.textContent=`${done} eliminadas. ${e.message||e}. Las pendientes conservan su selección para reintentar.`}
      finally{const remaining=[...selected];try{await api.refresh()}catch(e){status.textContent+=' No se pudo actualizar la lista: '+(e.message||e)}remaining.forEach(k=>selected.add(k));busy=false;sync()}
    };
    new MutationObserver(sync).observe(host,{childList:true,subtree:true});host.addEventListener('change',sync);sync();
  }
  mount(window.NexmirEditorialBulk,'contenidos');
  mount(window.NexmirGroupingBulk,'contenidos');
  mount(window.NexmirQuestionsBulk,'preguntas');
  mount(window.NexmirSimulationsBulk,'simulacros completos');
})();
