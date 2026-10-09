// Administrator-only cleanup, with exact preview and stale-preview protection in the RPC.
(()=>{
  let preview=null,busy=false,groups=new Map(),inventory=[];
  const el=id=>document.getElementById(id);
  const labels={content_items:'Flashcards y teoría',questions:'Preguntas',content_versions:'Versiones de contenido',user_flashcard_reviews:'Repasos',user_topic_feedback:'Autoevaluaciones de teoría',user_question_attempts:'Respuestas y progreso',user_bookmarks:'Marcadas',user_notes:'Notas',remnote_import_changes:'Cambios de importación',remnote_imports:'Historial RemNote',question_imports:'Historial de preguntas',battle_answers:'Respuestas de batallas',user_error_log:'Errores registrados',question_reports:'Reportes'};
  function invalidate(){preview=null;el('resetResult').textContent='';el('resetConfirm').value='';el('resetConfirmArea').hidden=true;el('resetExecute').disabled=true}
  function chosen(){return{p_type:el('resetType').value,p_specialties:[...(groups.get(el('resetSpecialty').value)||[])],p_topic:el('resetTopic').value||null}}
  function errorMessage(e){
    const raw=String(e?.message||e||''),code=String(e?.code||'');
    if(code==='PGRST202'||(/Could not find the function/i.test(raw)&&/nexmir_cleanup_content/.test(raw)))return 'Falta instalar el borrado selectivo. En Supabase SQL Editor ejecuta supabase/CONTENT_CLEANUP_5_1_29.sql y vuelve a consultar. Instalar la función no elimina datos.';
    if(code==='42501'||/permission denied/i.test(raw))return 'Tu sesión no tiene permisos de administrador.';
    return raw;
  }
  function fillTopics(){
    const select=el('resetTopic'),keep=select.value,raw=groups.get(el('resetSpecialty').value);
    const topics=[...new Set(inventory.filter(x=>!raw||raw.has(x.specialty||'Sin clasificar')).map(x=>x.topic||'General'))].sort((a,b)=>a.localeCompare(b,'es'));
    select.innerHTML='<option value="">Todos los temas</option>'+topics.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    if(topics.includes(keep))select.value=keep;
  }
  function dialog(){
    if(el('contentResetDialog'))return;
    const d=document.createElement('dialog');d.id='contentResetDialog';d.className='resetDialog';
    d.innerHTML=`<div class="resetHead"><h2>Borrar contenido de NEXMIR</h2><button type="button" id="resetClose" class="secondary">Cerrar</button></div>
      <p>Selecciona qué se elimina. Puedes combinar el tipo de material con una especialidad y un tema. Se incluyen borradores y archivos.</p>
      <div class="resetFilters">
        <label>Tipo de contenido<select id="resetType"><option value="all">Todo el contenido de estudio</option><option value="flashcards">Solo flashcards</option><option value="theory">Solo teoría</option><option value="simulations">Solo preguntas de simulacros</option><option value="banks">Solo preguntas de bancos</option></select></label>
        <label>Especialidad<select id="resetSpecialty"><option value="">Todas las especialidades</option></select></label>
        <label>Tema<select id="resetTopic"><option value="">Todos los temas</option></select></label>
      </div>
      <p class="muted small">“Todo” borra flashcards, teoría, preguntas de bancos y simulacros, además de sus importaciones. Los filtros también abarcan contenido archivado. Se eliminan repasos, intentos, notas y marcadores asociados. Las cuentas, las imágenes físicas, Arcade y los resultados históricos de simulacros permanecen.</p>
      <button id="resetPreview" type="button" class="secondary">Consultar cantidades afectadas</button>
      <div id="resetResult" role="status" aria-live="polite"></div>
      <div id="resetConfirmArea" hidden><p id="resetConfirmHint"></p><input id="resetConfirm" autocomplete="off" placeholder="Escribe la frase de confirmación"><button id="resetExecute" type="button" class="secondary danger" disabled>Borrar definitivamente</button></div>`;
    document.body.append(d);
    el('resetClose').onclick=()=>{if(!busy)d.close()};
    d.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
    for(const key of ['resetType','resetSpecialty','resetTopic'])el(key).onchange=()=>{if(key==='resetSpecialty')fillTopics();invalidate()};
    el('resetConfirm').oninput=()=>el('resetExecute').disabled=busy||!preview||el('resetConfirm').value!==preview.confirmation;
    el('resetPreview').onclick=async()=>{
      if(busy)return;invalidate();busy=true;el('resetPreview').disabled=true;
      try{
        const args=chosen(),{data,error}=await sb.rpc('nexmir_cleanup_content',{...args,p_execute:false});
        if(error)throw error;
        const total=Number(data.counts?.content_items||0)+Number(data.counts?.questions||0);
        if(!total){el('resetResult').textContent='No hay contenido de este tipo en la selección.';return}
        preview={...data,args};
        el('resetResult').innerHTML='<h3>Vista previa: registros afectados</h3><table><tbody>'+Object.entries(data.counts||{}).filter(([,n])=>Number(n)>0).map(([k,n])=>`<tr><td>${esc(labels[k]||k)}</td><td>${Number(n).toLocaleString('es-ES')}</td></tr>`).join('')+'</tbody></table>';
        el('resetConfirmHint').textContent=`Para confirmar escribe exactamente: ${data.confirmation}`;
        el('resetConfirmArea').hidden=false;
      }catch(e){el('resetResult').textContent=errorMessage(e)}
      finally{busy=false;el('resetPreview').disabled=false}
    };
    el('resetExecute').onclick=async()=>{
      if(busy||!preview||el('resetConfirm').value!==preview.confirmation)return;
      if(JSON.stringify(chosen())!==JSON.stringify(preview.args)){invalidate();return}
      busy=true;el('resetExecute').disabled=true;el('resetPreview').disabled=true;
      for(const key of ['resetType','resetSpecialty','resetTopic'])el(key).disabled=true;
      try{
        const {data,error}=await sb.rpc('nexmir_cleanup_content',{...preview.args,p_execute:true,p_confirmation:el('resetConfirm').value,p_fingerprint:preview.fingerprint});
        if(error)throw error;
        if(!data?.executed)throw new Error('La base no confirmó el borrado.');
        alert('Contenido eliminado. Se recargará el panel para actualizar las listas.');location.reload();
      }catch(e){invalidate();el('resetResult').textContent=errorMessage(e)+' Si hubo un error de conexión, consulta otra vista previa antes de repetir.'}
      finally{busy=false;el('resetPreview').disabled=false;for(const key of ['resetType','resetSpecialty','resetTopic'])el(key).disabled=false}
    };
  }
  window.openContentReset=async()=>{
    if(!cloudMode||!sb||cloudRole!=='admin'){alert('Conecta Supabase con una cuenta de administrador para borrar contenido.');return}
    dialog();invalidate();el('resetType').value='all';el('resetSpecialty').innerHTML='<option value="">Todas las especialidades</option>';el('resetTopic').innerHTML='<option value="">Todos los temas</option>';
    el('contentResetDialog').showModal();el('resetResult').textContent='Cargando especialidades y temas…';
    try{
      const [cards,questions]=await Promise.all([
        fetchAllPages(()=>sb.from('content_items').select('id,specialty,topic').order('id')),
        fetchAllPages(()=>sb.from('questions').select('id,specialty,topic').order('id'))
      ]);
      inventory=[...cards,...questions];groups=new Map();
      for(const r of inventory){const raw=r.specialty||'Sin clasificar',name=explicitSpecialty(raw)||raw;if(!groups.has(name))groups.set(name,new Set());groups.get(name).add(raw)}
      el('resetSpecialty').innerHTML='<option value="">Todas las especialidades</option>'+[...groups.keys()].sort((a,b)=>a.localeCompare(b,'es')).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
      fillTopics();el('resetResult').textContent='';
    }catch(e){el('resetResult').textContent=errorMessage(e)}
  };
})();
