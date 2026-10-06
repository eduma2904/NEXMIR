// Destructive operations are separate from incremental imports.
(()=>{
  let preview=null,busy=false,specialtyGroups=new Map();
  const labels={content_items:'Flashcards y teoría',questions:'Preguntas de banco y simulacro',content_versions:'Versiones de contenido',user_flashcard_reviews:'Repasos',user_question_attempts:'Respuestas y progreso',user_bookmarks:'Marcadas',user_notes:'Notas',remnote_import_changes:'Cambios de importación',remnote_imports:'Historial de importaciones RemNote',question_imports:'Historial de bancos y simulacros',simulations:'Resultados de simulacros',battle_rooms:'Batallas',battle_participants:'Participaciones en batallas',battle_answers:'Respuestas de batallas',study_plans:'Planes de estudio'};
  const el=id=>document.getElementById(id);
  function invalidate(){preview=null;el('resetResult').innerHTML='';el('resetConfirm').value='';el('resetConfirmArea').hidden=true;el('resetExecute').disabled=true}
  function selectedSpecialties(){return [...document.querySelectorAll('#resetSpecialties input:checked')].flatMap(x=>[...(specialtyGroups.get(x.value)||[])]).filter((x,i,a)=>a.indexOf(x)===i)}
  function chosen(){return el('resetScope').value==='specialties'?{p_scope:'specialties',p_specialties:selectedSpecialties()}:{p_scope:el('resetScope').value,p_specialties:[]}}
  function errorMessage(e){
    const raw=String(e?.message||e||''),code=String(e?.code||'');
    if(code==='PGRST202'||(/Could not find the function/i.test(raw)&&/nexmir_reset_content/.test(raw)))return 'Falta instalar la función de borrado en este proyecto Supabase. Abre SQL Editor, ejecuta el archivo supabase/CONTENT_RESET.sql y vuelve a consultar la vista previa. Ejecutar el SQL no borra datos.';
    if(code==='42501'||/administrador|permission denied/i.test(raw))return 'Tu sesión no tiene permiso de administrador para borrar contenido. Entra con tu cuenta admin.';
    return raw;
  }
  function dialog(){
    if(el('contentResetDialog'))return;
    const d=document.createElement('dialog');d.id='contentResetDialog';d.className='resetDialog';
    d.innerHTML=`<h2>Borrar contenido / reiniciar base</h2><p>Esta acción es permanente y afecta al contenido compartido de todos los usuarios. Conserva cuentas, contraseñas, roles y configuración de acceso.</p><label>Qué quieres borrar<select id="resetScope"><option value="flashcards">Todas las flashcards</option><option value="specialties">Una o varias especialidades</option><option value="all">Todo el contenido</option></select></label><fieldset id="resetSpecialtyLabel"><legend>Especialidades a eliminar</legend><p class="muted">Marca una o más. Solo se eliminará el contenido de las que señales.</p><div id="resetSpecialties" class="resetSpecialtyGrid"></div></fieldset><p class="muted">La opción «Todas las flashcards» conserva teoría, bancos y simulacros. «Una o varias especialidades» y «Todo el contenido» incluyen flashcards, teoría y preguntas, incluso archivadas. Se eliminan notas, marcadas y progreso asociado a lo seleccionado. Si un resultado de simulacro o una batalla contiene preguntas afectadas, se elimina ese resultado o batalla completo; las demás preguntas se conservan. Las imágenes almacenadas se conservan.</p><div class="actions"><button id="resetPreview" class="secondary">Ver cantidades antes de borrar</button><button id="resetClose" class="secondary">Cancelar</button></div><div id="resetResult" aria-live="polite"></div><div id="resetConfirmArea" hidden><p id="resetConfirmHint"></p><input id="resetConfirm" autocomplete="off" placeholder="Escribe la confirmación"><button id="resetExecute" class="secondary danger" disabled>Borrar definitivamente</button></div>`;
    document.body.append(d);
    el('resetClose').onclick=()=>{if(!busy)d.close()};
    d.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
    el('resetScope').onchange=()=>{el('resetSpecialtyLabel').hidden=el('resetScope').value!=='specialties';invalidate()};
    el('resetSpecialties').onchange=invalidate;
    el('resetConfirm').oninput=()=>el('resetExecute').disabled=busy||!preview||el('resetConfirm').value!==preview.confirmation;
    el('resetPreview').onclick=async()=>{
      if(busy)return;invalidate();busy=true;el('resetPreview').disabled=true;
      try{const args=chosen();if(args.p_scope==='specialties'&&!args.p_specialties[0])throw new Error('Selecciona una especialidad.');
        const {data,error}=await sb.rpc('nexmir_reset_content',{...args,p_execute:false});if(error)throw error;
        preview={...data,args};el('resetResult').innerHTML='<h3>Se eliminarán estos registros</h3><table><tbody>'+Object.entries(data.counts||{}).filter(([,n])=>n>0).map(([k,n])=>`<tr><td>${esc(labels[k]||k)}</td><td>${Number(n).toLocaleString('es-ES')}</td></tr>`).join('')+'</tbody></table>';
        const total=Object.values(data.counts||{}).reduce((s,n)=>s+Number(n),0);
        if(!total){el('resetResult').textContent='No hay contenido que borrar en esta selección.';preview=null;return}
        el('resetConfirmHint').textContent=`Para confirmar escribe exactamente: ${data.confirmation}`;el('resetConfirmArea').hidden=false;
      }catch(e){el('resetResult').textContent=errorMessage(e)}finally{busy=false;el('resetPreview').disabled=false}
    };
    el('resetExecute').onclick=async()=>{
      if(busy||!preview||el('resetConfirm').value!==preview.confirmation)return;
      if(chosen().p_scope!==preview.args.p_scope||JSON.stringify(chosen().p_specialties)!==JSON.stringify(preview.args.p_specialties)){invalidate();return}
      busy=true;el('resetExecute').disabled=true;el('resetPreview').disabled=true;el('resetScope').disabled=true;$$('#resetSpecialties input').forEach(x=>x.disabled=true);
      try{
        const {data,error}=await sb.rpc('nexmir_reset_content',{...preview.args,p_execute:true,p_confirmation:el('resetConfirm').value,p_fingerprint:preview.fingerprint});if(error)throw error;
        if(!data?.executed)throw new Error('La base no confirmó el borrado.');
        state.import=null;state.selected.clear();$('#compareView').classList.add('hidden');$('#fileInput').value='';
        // Reload discards stale cached bank, simulation and editor selections too.
        alert('Contenido eliminado. Se recargará el panel para descartar las cargas y selecciones anteriores.');location.reload();
      }catch(e){invalidate();el('resetResult').textContent=errorMessage(e)+' Si hubo un error de conexión, consulta una nueva vista previa para comprobar el estado.'}
      finally{busy=false;el('resetPreview').disabled=false;el('resetScope').disabled=false;$$('#resetSpecialties input').forEach(x=>x.disabled=false)}
    };
  }
  window.openContentReset=async()=>{
    if(!cloudMode||!sb||cloudRole!=='admin'){alert('Conecta Supabase con una cuenta de administrador para gestionar el borrado.');return}
    dialog();invalidate();el('resetScope').value='flashcards';el('resetSpecialtyLabel').hidden=true;el('resetSpecialties').innerHTML='Cargando especialidades…';el('contentResetDialog').showModal();
    try{
      const rows=[];
      for(const table of ['content_items','questions'])rows.push(...await fetchAllPages(()=>sb.from(table).select('id,specialty').order('id')));
      specialtyGroups=new Map();for(const r of rows){const raw=r.specialty||'Sin clasificar',canonical=explicitSpecialty(raw)||raw;if(!specialtyGroups.has(canonical))specialtyGroups.set(canonical,new Set());specialtyGroups.get(canonical).add(raw)}
      const specialties=[...specialtyGroups.keys()].sort((a,b)=>a.localeCompare(b,'es'));
      el('resetSpecialties').innerHTML=specialties.length?specialties.map(x=>`<label><input type="checkbox" value="${esc(x)}"> ${esc(x)}</label>`).join(''):'<span class="muted">No hay especialidades disponibles.</span>';
    }catch(e){el('resetResult').textContent=errorMessage(e)}
  };
})();
