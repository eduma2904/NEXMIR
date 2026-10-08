(() => {
 'use strict';
 let rows=[], editing=null, busy=false, generation=0, topicSpecialty='', previewUrls={answer:null,clue:null};
 const id=s=>document.getElementById(s);
 const allowed=()=>cloudMode&&sb&&cloudUser&&cloudRole==='admin';
 const message=t=>{if(id('arcadeMessage'))id('arcadeMessage').textContent=t};
 const previous=go;go=function(view){previous(view);if(view==='arcade')load()};
 function updateTopics(clearChanged=false){
  const f=id('arcadeForm').elements,specialty=RemnoteTaxonomy.canonical(f.specialty.value.trim());
  if(clearChanged&&specialty!==topicSpecialty)f.topic.value='';
  topicSpecialty=specialty;
  const content=[...Object.values(state.db.cards||{}),...Object.values(state.db.theory||{})].map(x=>x.current).filter(Boolean);
  const defaults=specialty==='Neumología'?['EPOC','Neumonía','Asma','Bronquiectasias','Enfermedad intersticial pulmonar','Cáncer de pulmón','Patología pleural','Tromboembolismo pulmonar','Hipertensión pulmonar','Trastornos respiratorios del sueño']:[];
  const topics=[...new Set([...defaults,...content.concat(rows).filter(x=>RemnoteTaxonomy.canonical(x.specialty||'')===specialty).map(x=>x.topic)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  id('arcadeTopics').innerHTML=topics.map(x=>`<option value="${esc(x)}">`).join('');
 }
 function releasePreview(kind){for(const key of kind?[kind]:['answer','clue'])if(previewUrls[key]){URL.revokeObjectURL(previewUrls[key]);previewUrls[key]=null}}
 async function imagePreview(kind='answer'){
  releasePreview(kind);
  const clue=kind==='clue',file=id(clue?'arcadeClueImageFile':'arcadeImageFile').files?.[0],holder=id(clue?'arcadeClueImagePreview':'arcadeImagePreview');
  const path=editing?.[clue?'clue_image_path':'answer_image_path'],removed=id(clue?'arcadeRemoveClueImage':'arcadeRemoveImage').checked;
  if(file){
    previewUrls[kind]=URL.createObjectURL(file);
    holder.innerHTML=`<img src="${esc(previewUrls[kind])}" alt="Vista previa de imagen ${clue?'de la pregunta':'de la respuesta'}" class="arcadeAnswerImage">`;
  }else if(path&&!removed){
    try{
     const {data,error}=await sb.storage.from('arcade-images').createSignedUrl(path,3600);
     holder.innerHTML=error?'<span class="muted">No se pudo cargar la imagen.</span>':`<img src="${esc(data.signedUrl)}" alt="Imagen actual ${clue?'de la pregunta':'de la respuesta'}" class="arcadeAnswerImage">`;
    }catch{holder.innerHTML='<span class="muted">No se pudo cargar la imagen.</span>'}
  }else holder.innerHTML='';
 }
 const draftKey=()=>`nexmir_arcade_draft_v2:${getSbCfg().url||''}:${cloudUser?.id||''}`;
 function saveDraft(){if(!allowed()||!id('arcadeForm'))return;const f=id('arcadeForm').elements;try{localStorage.setItem(draftKey(),JSON.stringify({editingId:editing?.id||null,fields:Object.fromEntries(['specialty','topic','category','answer','clue','explanation'].map(k=>[k,f[k].value])),published:f.published.checked,at:Date.now()}))}catch{message('No se pudo guardar el borrador local. Guarda la pregunta en la nube.') }}
 function clearDraft(){try{localStorage.removeItem(draftKey())}catch{}}
 function restoreDraft(){let d;try{d=JSON.parse(localStorage.getItem(draftKey())||'null')}catch{}if(!d?.fields)return;
   if(d.editingId){const record=rows.find(x=>x.id===d.editingId);if(!record)return;editing=record;id('arcadeEditorTitle').textContent='Editar pregunta · borrador recuperado';id('arcadeSave').textContent='Guardar cambios';for(const [kind,path] of [['answer','answer_image_path'],['clue','clue_image_path']]){const remove=id(kind==='clue'?'arcadeRemoveClueImage':'arcadeRemoveImage');remove.parentElement.hidden=!record[path];imagePreview(kind)}}
   const f=id('arcadeForm').elements;for(const k of ['specialty','topic','category','answer','clue','explanation'])f[k].value=d.fields[k]||'';f.published.checked=!!d.published;
   updateTopics();updateAnswerCount();message('Borrador recuperado. Las imágenes pendientes deben seleccionarse de nuevo.');
 }
 function updateAnswerCount(){const input=id('arcadeForm').elements.answer,counter=id('arcadeAnswerCount');if(counter)counter.textContent=`${input.value.length}/160 caracteres · sin límite de palabras`}
 function imageFileError(file){
  if(!file)return '';
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return 'Usa una imagen JPG, PNG o WebP.';
  if(file.size>5*1024*1024)return 'La imagen debe pesar menos de 5 MB.';
  return '';
 }
 async function uploadImage(file){
  const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  const path=`arcade/${crypto.randomUUID()}.${extension}`;
  const {error}=await sb.storage.from('arcade-images').upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw error;
  return path;
 }
 function shell(){
  id('arcadeView').innerHTML=`<div class="pageHead"><div><div class="eyebrow">NEXMIR ARCADE</div><h1>Preguntas de los juegos</h1><p>Gestiona Código Vital por especialidad. Este banco no se mezcla con preguntas test ni flashcards.</p></div><button id="arcadeRefresh" class="secondary">Actualizar</button></div><p id="arcadeMessage" role="status" aria-live="polite"></p><div id="arcadeAdminBody" hidden><div class="cardBox"><h2 id="arcadeEditorTitle">Nueva pregunta</h2><form id="arcadeForm"><div class="grid2"><label class="fieldLabel">Juego<select name="game"><option value="codigo_vital">Código Vital</option></select></label><label class="fieldLabel">Especialidad<input name="specialty" list="arcadeSpecialties" required minlength="2" maxlength="160" placeholder="Neumología"><datalist id="arcadeSpecialties"></datalist></label></div><label class="fieldLabel">Tema (opcional)<input name="topic" list="arcadeTopics" maxlength="160" placeholder="Sin tema · p. ej., EPOC o neumonía"><datalist id="arcadeTopics"></datalist><small class="muted">Selecciona un tema sugerido o escribe uno nuevo. Puedes dejarlo vacío.</small></label><div class="grid2"><label class="fieldLabel">Categoría<input name="category" list="arcadeCategories" required minlength="2" maxlength="80" placeholder="Diagnósticos"><datalist id="arcadeCategories"><option value="Diagnósticos"><option value="Tratamiento clave"><option value="Criterios y pruebas"><option value="Escalas"><option value="Perlas MIR"><option value="Fármacos"><option value="Microorganismos"></datalist></label><label class="fieldLabel">Respuesta oculta<input name="answer" required minlength="2" maxlength="80" placeholder="Proteinosis alveolar"><small class="muted">Letras, espacios y guiones. Se admiten tildes y Ñ; no números.</small></label></div><label class="fieldLabel">Pista clínica<textarea name="clue" rows="4" required minlength="15" maxlength="1200" placeholder="Describe el caso y termina en una pregunta: ¿Cuál es el diagnóstico?"></textarea></label><label class="fieldLabel">Explicación al terminar<textarea name="explanation" rows="3" required minlength="10" maxlength="3000" placeholder="La perla clínica. Si son criterios que diferencian dos resultados, incluye todos los umbrales y qué corresponde a cada resultado."></textarea><small class="muted">Para criterios comparativos, explica qué clasifica cada resultado; por ejemplo, exudado y trasudado.</small></label><label class="fieldLabel">Imagen de la respuesta (opcional)<input id="arcadeImageFile" type="file" accept="image/png,image/jpeg,image/webp"><small class="muted">Aparece al resolver o terminar el caso; la respuesta escrita sigue siendo necesaria para el ahorcado. JPG, PNG o WebP, hasta 5 MB.</small></label><div id="arcadeImagePreview"></div><label class="arcadePublish"><input type="checkbox" id="arcadeRemoveImage"> Quitar imagen actual al guardar</label><label class="arcadePublish"><input type="checkbox" name="published"> Publicada: disponible para los estudiantes</label><p class="muted small">Borrador si está desmarcada. Comprueba que la pista conduzca a una sola respuesta.</p><div class="actions"><button class="primary" type="submit" id="arcadeSave">Guardar pregunta</button><button class="secondary" type="button" id="arcadePreviewBtn">Previsualizar</button><button class="ghost" type="button" id="arcadeCancel">Cancelar edición</button></div><div id="arcadePreview" class="cardBox" hidden></div></form></div><div class="toolbar"><label>Especialidad<select id="arcadeFilter"></select></label><label>Estado<select id="arcadeStatus"><option value="all">Todos</option><option value="published">Publicadas</option><option value="draft">Borradores</option></select></label><input id="arcadeSearch" type="search" aria-label="Buscar preguntas Arcade" placeholder="Buscar respuesta, pista o tema"></div><p id="arcadeCount" class="muted"></p><div id="arcadeList"></div></div>`;
  const form=id('arcadeForm'),answer=form.elements.answer,clue=form.elements.clue;
  id('arcadeEditorTitle').insertAdjacentHTML('afterend','<p class="muted small">El texto se conserva como borrador en este navegador hasta que lo guardes en Supabase. Por seguridad, vuelve a seleccionar archivos de imagen tras recargar.</p>');
  answer.maxLength=160;answer.parentElement.querySelector('small').textContent='Hasta 160 caracteres, sin límite de palabras. Solo letras, tildes, Ñ, espacios y guiones.';
  answer.insertAdjacentHTML('afterend','<small id="arcadeAnswerCount" class="muted"></small>');
  clue.closest('label').insertAdjacentHTML('afterend','<label class="fieldLabel">Imagen de la pregunta (opcional)<input id="arcadeClueImageFile" type="file" accept="image/png,image/jpeg,image/webp"><small class="muted">Visible junto al enunciado mientras juegas. JPG, PNG o WebP, hasta 5 MB.</small></label><div id="arcadeClueImagePreview"></div><label class="arcadePublish"><input type="checkbox" id="arcadeRemoveClueImage"> Quitar imagen del enunciado al guardar</label>');
  updateAnswerCount();
  id('arcadeRefresh').onclick=()=>{if(!busy&&(!editing||confirm('¿Descartar la edición y actualizar?')))load()};
 }
 async function load(){
  const ticket=++generation;rows=[];editing=null;shell();
  if(!allowed()){message('Inicia sesión como administrador para gestionar Arcade. Los moderadores no pueden modificar este banco.');return}
  message('Cargando preguntas…');
  try{
   const loaded=[];
   for(let offset=0;;offset+=500){const {data,error}=await sb.from('arcade_questions').select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+499);if(ticket!==generation||!allowed())return;if(error)throw error;loaded.push(...(data||[]));if(!data||data.length<500)break}
   rows=loaded;id('arcadeAdminBody').hidden=false;
   const extra=Object.values(state.db.cards||{}).map(x=>x.current?.specialty).filter(Boolean);
   const subjects=[...new Set([...RemnoteTaxonomy.subjects,...extra,...rows.map(x=>x.specialty)])].sort((a,b)=>a.localeCompare(b,'es'));
   id('arcadeSpecialties').innerHTML=subjects.map(x=>`<option value="${esc(x)}">`).join('');
   id('arcadeFilter').innerHTML='<option value="">Todas</option>'+subjects.map(x=>`<option>${esc(x)}</option>`).join('');
   id('arcadeForm').elements.specialty.addEventListener('input',()=>updateTopics(true));
   id('arcadeImageFile').onchange=()=>imagePreview('answer');id('arcadeRemoveImage').onchange=()=>imagePreview('answer');
   id('arcadeClueImageFile').onchange=()=>imagePreview('clue');id('arcadeRemoveClueImage').onchange=()=>imagePreview('clue');
   id('arcadeForm').addEventListener('input',()=>{updateAnswerCount();saveDraft()});id('arcadeForm').addEventListener('change',saveDraft);
   id('arcadeForm').onsubmit=save;id('arcadeCancel').onclick=()=>{clearDraft();reset()};id('arcadePreviewBtn').onclick=preview;
   for(const name of ['arcadeFilter','arcadeStatus','arcadeSearch'])id(name).addEventListener('input',list);
   reset();list();message(`${rows.length} preguntas cargadas.`);restoreDraft();
  }catch(error){message('No se pudo cargar Arcade. '+(/arcade_questions|schema cache|42P01/.test(error.message)?'Revisa que se hayan ejecutado supabase/ARCADE.sql, la migración 5.1.17 y supabase/ARCADE_5_1_18.sql; luego pulsa Actualizar.':String(error.message||error)))}
 }
 function reset(){if(busy)return;releasePreview();editing=null;id('arcadeForm').reset();id('arcadeEditorTitle').textContent='Nueva pregunta';id('arcadeSave').textContent='Guardar pregunta';id('arcadePreview').hidden=true;id('arcadeImagePreview').innerHTML='';id('arcadeClueImagePreview').innerHTML='';id('arcadeRemoveImage').parentElement.hidden=true;id('arcadeRemoveClueImage').parentElement.hidden=true;updateTopics();updateAnswerCount()}
 function values(){const f=id('arcadeForm').elements;return{game:'codigo_vital',specialty:RemnoteTaxonomy.canonical(f.specialty.value.trim()),category:f.category.value.trim(),topic:f.topic.value.trim()||null,answer:f.answer.value.trim().replace(/\s+/g,' '),clue:f.clue.value.trim(),explanation:f.explanation.value.trim(),published:f.published.checked}}
 function valid(v){if(v.topic&&v.topic.length>160)return 'El tema admite hasta 160 caracteres.';if(RemnoteTaxonomy.unclassified(v.specialty))return 'Elige una especialidad.';if(v.answer.length>160)return 'La respuesta admite como máximo 160 caracteres, pero no tiene límite de palabras.';if(!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ -]+$/.test(v.answer)||!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(v.answer))return 'La respuesta solo admite letras, espacios y guiones; no números ni signos.';if(!v.clue.endsWith('?')||!v.clue.includes('¿'))return 'La pista debe terminar con una pregunta entre ¿ y ?.';return ''}
 function preview(){if(!id('arcadeForm').reportValidity())return;const v=values(),error=valid(v)||imageFileError(id('arcadeImageFile').files?.[0])||imageFileError(id('arcadeClueImageFile').files?.[0]);if(error){message(error);return}const p=id('arcadePreview');p.hidden=false;p.innerHTML=`<strong>Vista previa · ${esc(v.specialty)} · ${esc(v.topic||'Sin tema')}</strong><p>${esc(v.clue)}</p>${id('arcadeClueImagePreview').innerHTML}<p class="arcadeLetters">${esc(v.answer.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'＿'))}</p><details><summary>Ver respuesta y explicación</summary><p><strong>${esc(v.answer)}</strong></p><p>${esc(v.explanation).replace(/\n/g,'<br>')}</p>${id('arcadeImagePreview').innerHTML}</details>`}
 function list(){
  const sp=id('arcadeFilter').value,status=id('arcadeStatus').value,search=id('arcadeSearch').value.toLocaleLowerCase('es');
  const filtered=rows.filter(x=>(!sp||x.specialty===sp)&&(status==='all'||x.published===(status==='published'))&&[x.answer,x.clue,x.topic].join(' ').toLocaleLowerCase('es').includes(search));
  id('arcadeCount').textContent=`${filtered.length} preguntas · ${rows.filter(x=>x.published).length} publicadas en total`;
  id('arcadeList').innerHTML=filtered.map(x=>`<article class="cardBox arcadeAdminRow"><div><span class="badge">${x.published?'Publicada':'Borrador'}</span><strong>${esc(x.answer)}</strong><p class="muted">${esc(x.specialty)} · ${esc(x.topic||'Sin tema')} · ${esc(x.category)}${x.clue_image_path?' · 🖼 Enunciado':''}${x.answer_image_path?' · 🖼 Respuesta':''}</p><p>${esc(x.clue)}</p></div><button class="secondary" data-edit="${esc(x.id)}">Editar</button></article>`).join('')||'<div class="empty">No hay preguntas con esos filtros.</div>';
  id('arcadeList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit));
 }
 function edit(key){if(busy||!allowed())return;editing=rows.find(x=>x.id===key);if(!editing)return;const f=id('arcadeForm').elements;for(const k of ['specialty','topic','category','answer','clue','explanation'])f[k].value=editing[k]||'';updateTopics();f.published.checked=editing.published;id('arcadeEditorTitle').textContent='Editar pregunta';id('arcadeSave').textContent='Guardar cambios';id('arcadePreview').hidden=true;for(const [kind,path] of [['answer','answer_image_path'],['clue','clue_image_path']]){const remove=id(kind==='clue'?'arcadeRemoveClueImage':'arcadeRemoveImage');remove.checked=false;remove.parentElement.hidden=!editing[path];id(kind==='clue'?'arcadeClueImageFile':'arcadeImageFile').value='';imagePreview(kind)}updateAnswerCount();saveDraft();id('arcadeForm').scrollIntoView({behavior:'smooth',block:'start'});f.answer.focus({preventScroll:true})}
 async function save(event){
  event.preventDefault();if(busy)return;if(!allowed()){message('Necesitas una sesión de administrador.');return}
  if(!id('arcadeForm').reportValidity())return;const v=values(),file=id('arcadeImageFile').files?.[0],clueFile=id('arcadeClueImageFile').files?.[0],error=valid(v)||imageFileError(file)||imageFileError(clueFile);if(error){message(error);return}
  busy=true;const selected=editing,uploadedPaths=[];id('arcadeSave').disabled=true;message('Guardando…');
  try{
   const answerPath=file?await uploadImage(file):null;if(answerPath)uploadedPaths.push(answerPath);
   const cluePath=clueFile?await uploadImage(clueFile):null;if(cluePath)uploadedPaths.push(cluePath);
   const payload={...v,answer_image_path:answerPath||(id('arcadeRemoveImage').checked?null:selected?.answer_image_path||null),clue_image_path:cluePath||(id('arcadeRemoveClueImage').checked?null:selected?.clue_image_path||null),updated_at:new Date().toISOString()};
   const query=selected?sb.from('arcade_questions').update(payload).eq('id',selected.id).eq('updated_at',selected.updated_at):sb.from('arcade_questions').insert(payload);
   const {data,error}=await query.select().single();if(error)throw error;
   rows=selected?rows.map(x=>x.id===data.id?data:x):[data,...rows];busy=false;clearDraft();reset();list();
   message(data.published?'Guardada y publicada. Aparecerá al volver a abrir Código Vital.':'Borrador guardado. No aparece en el juego.');
  }catch(error){if(uploadedPaths.length)try{await sb.storage.from('arcade-images').remove(uploadedPaths)}catch{}message((/topic|answer_image_path|clue_image_path/.test(error.message||'')&&/schema cache|column/.test(error.message||''))?'Actualiza la base de datos con supabase/ARCADE_5_1_18.sql y vuelve a guardar.':error.code==='PGRST116'?'La pregunta cambió desde que la abriste. Actualiza la lista antes de editar.':'No se guardó: '+String(error.message||error))}
  finally{busy=false;if(id('arcadeSave'))id('arcadeSave').disabled=false}
 }
 const logout=logoutCloud;logoutCloud=async function(){releasePreview();generation++;rows=[];editing=null;id('arcadeView').replaceChildren();return logout()};
})();
